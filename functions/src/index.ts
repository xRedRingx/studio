import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

// Initialize the Firebase Admin SDK.
// This will use the service account associated with your Firebase project
// when deployed. For local emulation, ensure your environment is set up with
// the appropriate credentials (e.g., using GOOGLE_APPLICATION_CREDENTIALS).
admin.initializeApp();

const db = admin.firestore();

// --- Configuration ---
// This section contains the core settings for the reminder logic.

// Send a reminder this many minutes before the appointment's start time.
const REMINDER_MINUTES_BEFORE = 30;

// The scheduled function runs every 15 minutes. The window needs to be wide
// enough to catch appointments without missing any due to slight timing
// variations in function execution, but not so wide that it causes overlaps.
// A 15-minute window matches the function's schedule interval.
const REMINDER_WINDOW_MINUTES = 15;

/**
 * A scheduled Cloud Function that sends push notification reminders for
 * upcoming appointments.
 *
 * This function is configured to run on a schedule (e.g., every 15 minutes).
 * It queries for appointments that are due for a reminder, fetches the
 * corresponding customer's FCM token, and sends a push notification via
 * Firebase Cloud Messaging.
 *
 * Key Improvements in this version:
 * 1.  **Idempotency**: The function now checks for a `reminderSent` flag on
 * each appointment and only sends a reminder if it hasn't been sent before.
 * It then updates this flag to prevent duplicate notifications.
 * 2.  **Required Index**: This function requires a composite index in
 * Firestore to work correctly. A comment below details the index you must
 * create in your Firestore console.
 * 3.  **Error Handling**: Corrected a syntax error in the main try/catch
 * block and improved logic for handling invalid FCM tokens.
 * 4.  **Clarity**: Simplified the time window calculation for better
 * readability.
 */
export const sendAppointmentReminders = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "UTC", // Change this to your preferred timezone
  },
  async (event) => {
    console.log("Scheduled function triggered: Checking for appointment " +
      "reminders. Trigger time: " + event.scheduleTime);

    try {
      const now = new Date();

      // --- Calculate Reminder Time Window ---
      // We are looking for appointments that are scheduled to start in the
      // near future. The window starts from the target reminder time and
      // extends for the duration of our check interval.
      // Example: If it's 9:00 AM and REMINDER_MINUTES_BEFORE is 30, the
      // window will start at 9:30 AM and end at 9:45 AM (if
      // REMINDER_WINDOW_MINUTES is 15).
      const windowStart = new Date(now.getTime() +
        REMINDER_MINUTES_BEFORE * 60 * 1000);
      const windowEnd = new Date(windowStart.getTime() +
        REMINDER_WINDOW_MINUTES * 60 * 1000);

      const reminderWindowStartTimestamp = admin.firestore.Timestamp
        .fromDate(windowStart);
      const reminderWindowEndTimestamp = admin.firestore.Timestamp
        .fromDate(windowEnd);

      console.log("Current time: " + now.toISOString());
      console.log("Checking for appointments with 'appointmentTimestamp' " +
        "between: " + windowStart.toISOString() + " and " +
        windowEnd.toISOString());

      // --- Important: Firestore Index Required! ---
      // This query will fail without a composite index in Firestore.
      // Go to your Firebase Console -> Firestore Database -> Indexes ->
      // Add Index.
      // Collection ID: 'appointments'
      // Fields to index:
      // 1. status (Ascending)
      // 2. reminderSent (Ascending)
      // 3. appointmentTimestamp (Ascending)
      // Query scope: Collection
      const appointmentsSnapshot = await db.collection("appointments")
        .where("status", "==", "upcoming") // Only for appointments that
        // haven't been completed or canceled.
        .where("reminderSent", "==", false) // **CRITICAL**: Ensures we
        // don't send duplicate reminders.
        .where("appointmentTimestamp", ">=", reminderWindowStartTimestamp)
        .where("appointmentTimestamp", "<=", reminderWindowEndTimestamp)
        .get();

      if (appointmentsSnapshot.empty) {
        console.log("No appointments found in the current window " +
          "requiring a reminder.");
        return;
      }

      console.log("Found " + appointmentsSnapshot.docs.length +
        " appointments to remind.");

      const reminderPromises: Promise<void>[] = [];

      for (const doc of appointmentsSnapshot.docs) {
        const appointment = doc.data();
        const appointmentId = doc.id;

        const {
          customerId, serviceName, barberName, startTime,
        } = appointment;

        if (!customerId) {
          console.warn("Appointment " + appointmentId + " is missing a " +
            "customerId. Skipping.");
          continue;
        }

        // The logic to send a notification is wrapped in a promise.
        const sendPromise = processAndSendReminder(
          customerId,
          appointmentId,
          {serviceName, barberName, startTime},
        );
        reminderPromises.push(sendPromise);
      }

      await Promise.all(reminderPromises);
      console.log("Finished processing all reminders for this batch.");
    } catch (error) {
      console.error("A critical error occurred in the " +
        "sendAppointmentReminders function:", error);
      // We return to indicate the function execution is complete,
      // even if it failed, to prevent it from retrying indefinitely in
      // some configurations.
    }
  }
);

/**
 * Fetches user data, constructs, and sends a single FCM notification.
 * It also handles updating the appointment document to prevent duplicate
 * sends.
 * @param {string} customerId The ID of the user to notify.
 * @param {string} appointmentId The ID of the appointment document.
 * @param {object} appointmentDetails Contains details needed for the
 * notification message.
 */
async function processAndSendReminder(
  customerId: string,
  appointmentId: string,
  appointmentDetails: {
    serviceName: string;
    barberName: string;
    startTime: string;
  }
): Promise<void> {
  const userDocRef = db.collection("users").doc(customerId);
  const appointmentDocRef = db.collection("appointments").doc(appointmentId);

  try {
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      console.warn("User document not found for customerId: " +
        customerId + " (Appointment ID: " + appointmentId + ")");
      return;
    }

    const userData = userDocSnap.data() as {
      fcmToken?: string | null;
      firstName?: string;
    };
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log("No FCM token found for customer " + customerId +
        " (Appointment ID: " + appointmentId + "). Setting reminderSent to " +
        "true to prevent retries.");
      // Mark as sent even if no token, to prevent this logic from
      // re-running for this user.
      await appointmentDocRef.update({reminderSent: true});
      return;
    }

    const customerFirstName = userData.firstName || "Customer";
    const {serviceName, barberName, startTime} = appointmentDetails;

    const messagePayload = {
      notification: {
        title: "Appointment Reminder!",
        body: "Hi " + customerFirstName + ", your appointment for " +
          serviceName + " with " + barberName + " is in about " +
          REMINDER_MINUTES_BEFORE + " minutes at " + startTime + ".",
        // You can add more rich notification features here.
        // icon: "https://your-app-url.com/icon.png",
        // click_action: "https://your-app-url.com/appointments"
      },
      token: fcmToken,
    };

    console.log("Sending reminder for appointment " + appointmentId + " to " +
      "user " + customerId + ".");

    // Send the message via FCM.
    await admin.messaging().send(messagePayload);
    console.log("Successfully sent message for appointment " +
      appointmentId + ".");

    // **CRITICAL**: Update the appointment to mark the reminder as sent.
    await appointmentDocRef.update({reminderSent: true});
    console.log("Updated 'reminderSent' flag for appointment " +
      appointmentId + ".");
  } catch (error: unknown) {
    console.error("Error processing reminder for appointment " +
      appointmentId + ":", error);

    // If the token is no longer valid, remove it from the user's document.
    const errorCode = (error as {code?: string}).code;
    if (errorCode === "messaging/registration-token-not-registered" ||
        errorCode === "messaging/invalid-registration-token") {
      console.log("FCM token for user " + customerId + " is invalid. " +
        "Removing it from Firestore.");
      await userDocRef.update({fcmToken: admin.firestore.FieldValue.delete()});
    }

    // We do NOT update "reminderSent" here, allowing the function to retry
    // on the next run in case the error was transient (e.g., a temporary
    // network issue with FCM).
  }
}
