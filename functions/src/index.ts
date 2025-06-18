/**
 * @fileoverview This file contains Firebase Cloud Functions for the BarberFlow application.
 * It includes a scheduled function to send appointment reminders.
 */

import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

// Initialize the Firebase Admin SDK to interact with Firebase services.
admin.initializeApp();
const db = admin.firestore(); // Firestore database instance.

// --- Configuration for Reminder Logic ---
// These constants define how far in advance reminders are sent and the window for querying appointments.
// For production, these values should be adjusted (e.g., 30-60 minutes before).
const REMINDER_MINUTES_BEFORE = 2; // Send reminder X minutes before the appointment.
const REMINDER_WINDOW_MINUTES = 2; // Query for appointments within a Y-minute window starting from REMINDER_MINUTES_BEFORE.

/**
 * A scheduled Cloud Function that sends push notification reminders for upcoming appointments.
 * This function runs periodically based on the defined schedule.
 *
 * @remarks
 * The function queries for 'upcoming' appointments that haven't had a reminder sent
 * and fall within a specific time window before their scheduled start.
 *
 * Firebase Index Required for `appointments` collection:
 * - `status` (Ascending)
 * - `reminderSent` (Ascending)
 * - `appointmentTimestamp` (Ascending)
 * Query scope: Collection
 */
export const sendAppointmentReminders = onSchedule(
  {
    schedule: "every 1 minutes", // Cron schedule expression (runs every minute for testing).
    timeZone: "Africa/Algiers", // Specifies the timezone for the schedule. User's preferred timezone.
  },
  async (event) => {
    console.log(`Function triggered by scheduler. Event scheduleTime (UTC): ${
      event.scheduleTime}`);
    // Log the event's timezone if available (it might be on the event object)
    if ((event as any).timeZone) {
        console.log(`Event's target timezone: ${(event as any).timeZone}`);
    }

    try {
      const now = new Date(); // Current execution time of the function server.
      console.log(`Function's current Date() object: ${now.toString()} ` +
        "(This reflects the function server's perceived time and timezone)");

      // --- Calculate Reminder Time Window ---
      // This window determines which appointments are eligible for a reminder.
      // It's calculated based on the function's current execution time.
      // Firestore Timestamps are always UTC.
      const windowStart = new Date(now.getTime() +
        REMINDER_MINUTES_BEFORE * 60 * 1000);
      const windowEnd = new Date(windowStart.getTime() +
        REMINDER_WINDOW_MINUTES * 60 * 1000);

      // Convert window boundaries to Firestore Timestamp objects for querying.
      const reminderWindowStartTimestamp = admin.firestore.Timestamp
        .fromDate(windowStart);
      const reminderWindowEndTimestamp = admin.firestore.Timestamp
        .fromDate(windowEnd);

      console.log(`Current time (UTC from now.toISOString()): ${
        now.toISOString()}`);
      console.log("Calculated Query Window (UTC from Timestamps):");
      console.log(`  Start: ${
        reminderWindowStartTimestamp.toDate().toISOString()} (Timestamp sec: ${
        reminderWindowStartTimestamp.seconds})`);
      console.log(`  End:   ${
        reminderWindowEndTimestamp.toDate().toISOString()} (Timestamp sec: ${
        reminderWindowEndTimestamp.seconds})`);
      console.log("Checking for appointments with 'appointmentTimestamp' " +
        "(UTC) between these values.");

      // Query Firestore for appointments that meet the criteria:
      // - Status is 'upcoming'.
      // - Reminder has not been sent yet (`reminderSent` is false).
      // - `appointmentTimestamp` falls within the calculated reminder window.
      const appointmentsSnapshot = await db.collection("appointments")
        .where("status", "==", "upcoming")
        .where("reminderSent", "==", false) // Ensures we only target appointments that haven't received a reminder.
        .where("appointmentTimestamp", ">=", reminderWindowStartTimestamp)
        .where("appointmentTimestamp", "<=", reminderWindowEndTimestamp)
        .get();

      if (appointmentsSnapshot.empty) {
        console.log("No appointments found in the current window " +
          "requiring a reminder.");
        return; // No appointments to process, exit the function.
      }

      console.log(`Found ${appointmentsSnapshot.docs.length} appointments ` +
        "to remind.");
      // Log details of found appointments for debugging.
      appointmentsSnapshot.forEach((doc) => {
        const appt = doc.data();
        const apptTimestamp = (appt.appointmentTimestamp as
          admin.firestore.Timestamp);
        console.log(`  - Found Appt ID: ${doc.id}, Timestamp: ${
          apptTimestamp.toDate().toISOString()} (sec: ${
          apptTimestamp.seconds}), Cust: ${appt.customerName}`);
      });

      // Process each found appointment and send a reminder.
      const reminderPromises: Promise<void>[] = [];
      for (const doc of appointmentsSnapshot.docs) {
        const appointment = doc.data();
        const appointmentId = doc.id;
        // Destructure required appointment details.
        const {customerId, serviceName, barberName, startTime} = appointment;

        if (!customerId) {
          console.warn(`Appointment ${appointmentId} is missing a ` +
            "customerId. Skipping.");
          continue; // Skip if customerId is missing.
        }

        // Add the promise returned by processAndSendReminder to an array.
        const sendPromise = processAndSendReminder(
          customerId,
          appointmentId,
          {serviceName, barberName, startTime},
        );
        reminderPromises.push(sendPromise);
      }

      // Wait for all reminder sending operations to complete.
      await Promise.all(reminderPromises);
      console.log("Finished processing all reminders for this batch.");
    } catch (error) {
      console.error("A critical error occurred in the " +
        "sendAppointmentReminders function:", error);
      // Errors are logged for monitoring in Firebase Cloud Functions logs.
    }
  }
);

/**
 * Processes and sends a reminder notification for a specific appointment.
 * Fetches user data to get the FCM token and constructs the notification message.
 * Updates the appointment document to mark the reminder as sent.
 * Handles cases where the user or FCM token is not found, or if the token is invalid.
 *
 * @param {string} customerId The ID of the customer to send the reminder to.
 * @param {string} appointmentId The ID of the appointment.
 * @param {object} appointmentDetails Details of the appointment for the message.
 * @param {string} appointmentDetails.serviceName The name of the service.
 * @param {string} appointmentDetails.barberName The name of the barber.
 * @param {string} appointmentDetails.startTime The local start time of the appointment (e.g., "10:00 AM").
 * @return {Promise<void>} A promise that resolves when the reminder processing is complete.
 */
async function processAndSendReminder(
  customerId: string,
  appointmentId: string,
  appointmentDetails: {
    serviceName: string;
    barberName: string;
    startTime: string; // This is the local time string, e.g., "10:00 AM"
  }
): Promise<void> {
  // Document references for the user and appointment.
  const userDocRef = db.collection("users").doc(customerId);
  const appointmentDocRef = db.collection("appointments").doc(appointmentId);

  try {
    // Fetch the user document to get their FCM token and name.
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
      console.warn(`User document not found for customerId: ${customerId} ` +
        `(Appointment ID: ${appointmentId})`);
      // Mark reminder as sent to avoid retrying for a non-existent user.
      await appointmentDocRef.update({
        reminderSent: true,
        reminderSkippedReason: "User document not found",
      });
      return;
    }

    const userData = userDocSnap.data() as {
      fcmToken?: string | null; // FCM registration token for push notifications.
      firstName?: string;       // Customer's first name for personalization.
    };
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log(`No FCM token for customer ${customerId} ` +
        `(Appt ID: ${appointmentId}). Marking reminderSent=true.`);
      // Mark reminder as sent if no token is available.
      await appointmentDocRef.update({
        reminderSent: true,
        reminderSkippedReason: "No FCM token",
      });
      return;
    }

    // Personalize the notification message.
    const customerFirstName = userData.firstName || "Customer"; // Default to "Customer" if name is not set.
    const {serviceName, barberName, startTime} = appointmentDetails;

    // Construct the push notification payload.
    // The reminder message uses the local `startTime` string from the appointment for user readability.
    const messagePayload = {
      notification: {
        title: "Appointment Reminder!",
        body: `Hi ${customerFirstName}, your appointment for ${serviceName} ` +
          `with ${barberName} is in about ${REMINDER_MINUTES_BEFORE} ` +
          `minutes at ${startTime}.`,
      },
      token: fcmToken, // Target FCM token for the specific user device.
    };

    console.log(`Attempting to send reminder for appointment ${
      appointmentId} to user ${customerId}.`);
    // Send the message using Firebase Cloud Messaging (FCM).
    await admin.messaging().send(messagePayload);
    console.log(`Successfully sent message for appointment ${appointmentId}.`);

    // Update the appointment document to mark the reminder as sent.
    await appointmentDocRef.update({reminderSent: true});
    console.log(`Updated 'reminderSent' flag for appointment ${
      appointmentId}.`);
  } catch (error: unknown) {
    console.error(`Error processing reminder for appointment ${
      appointmentId}:`, error);
    const errorCode = (error as {code?: string}).code; // Extract error code if available.

    // Handle specific FCM errors, such as an invalid or unregistered token.
    if (errorCode === "messaging/registration-token-not-registered" ||
        errorCode === "messaging/invalid-registration-token") {
      console.log(`FCM token for user ${customerId} is invalid. ` +
        "Removing it from their user document.");
      // Remove the invalid token from the user's document.
      await userDocRef.update({fcmToken: admin.firestore.FieldValue.delete()});
      // Mark reminder as sent even if token was invalid to prevent retrying with a known bad token.
      await appointmentDocRef.update({
        reminderSent: true,
        reminderSkippedReason: "Invalid FCM token",
      });
    }
    // For other types of errors, do not mark `reminderSent` as true,
    // allowing the system to retry sending the reminder on the next function execution.
  }
}
