
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

// Initialize the Firebase Admin SDK.
admin.initializeApp();
const db = admin.firestore();

// --- Configuration ---
// TEMPORARY FASTER SETTINGS FOR TESTING:
const REMINDER_MINUTES_BEFORE = 2; // Send reminder 2 mins before
const REMINDER_WINDOW_MINUTES = 2; // Query for appointments in a 2-min window around the target

/**
 * A scheduled Cloud Function that sends push notification reminders for
 * upcoming appointments.
 */
export const sendAppointmentReminders = onSchedule(
  {
    schedule: "every 1 minutes", // Runs every minute FOR TESTING
    timeZone: "Africa/Algiers", // User's preferred timezone for scheduling
  },
  async (event) => {
    console.log(`Function triggered by scheduler. Event scheduleTime (UTC): ${event.scheduleTime}, Event timeZone: ${event.timeZone}`);

    try {
      const now = new Date();
      console.log(`Function's current Date() object: ${now.toString()} (This reflects the function server's perceived time and timezone)`);

      const windowStart = new Date(now.getTime() +
        REMINDER_MINUTES_BEFORE * 60 * 1000);
      const windowEnd = new Date(windowStart.getTime() +
        REMINDER_WINDOW_MINUTES * 60 * 1000);

      const reminderWindowStartTimestamp = admin.firestore.Timestamp
        .fromDate(windowStart);
      const reminderWindowEndTimestamp = admin.firestore.Timestamp
        .fromDate(windowEnd);

      console.log(`Current time (UTC from now.toISOString()): ${now.toISOString()}`);
      console.log("Calculated Query Window (UTC from Timestamps):");
      console.log(`  Start: ${reminderWindowStartTimestamp.toDate().toISOString()} (Timestamp sec: ${reminderWindowStartTimestamp.seconds})`);
      console.log(`  End:   ${reminderWindowEndTimestamp.toDate().toISOString()} (Timestamp sec: ${reminderWindowEndTimestamp.seconds})`);
      console.log("Checking for appointments with 'appointmentTimestamp' (UTC) between these values.");


      // --- Important: Firestore Index Required! ---
      // Collection ID: 'appointments'
      // Fields to index:
      // 1. status (Ascending)
      // 2. reminderSent (Ascending)
      // 3. appointmentTimestamp (Ascending)
      // Query scope: Collection
      const appointmentsSnapshot = await db.collection("appointments")
        .where("status", "==", "upcoming")
        .where("reminderSent", "==", false)
        .where("appointmentTimestamp", ">=", reminderWindowStartTimestamp)
        .where("appointmentTimestamp", "<=", reminderWindowEndTimestamp)
        .get();

      if (appointmentsSnapshot.empty) {
        console.log("No appointments found in the current window requiring a reminder.");
        return;
      }

      console.log(`Found ${appointmentsSnapshot.docs.length} appointments to remind.`);
      appointmentsSnapshot.forEach(doc => {
        const appt = doc.data();
        const apptTimestamp = (appt.appointmentTimestamp as admin.firestore.Timestamp);
        console.log(`  - Found Appt ID: ${doc.id}, Timestamp: ${apptTimestamp.toDate().toISOString()} (sec: ${apptTimestamp.seconds}), Cust: ${appt.customerName}`);
      });


      const reminderPromises: Promise<void>[] = [];
      for (const doc of appointmentsSnapshot.docs) {
        const appointment = doc.data();
        const appointmentId = doc.id;
        const { customerId, serviceName, barberName, startTime } = appointment;

        if (!customerId) {
          console.warn(`Appointment ${appointmentId} is missing a customerId. Skipping.`);
          continue;
        }

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
      console.error("A critical error occurred in the sendAppointmentReminders function:", error);
    }
  }
);

async function processAndSendReminder(
  customerId: string,
  appointmentId: string,
  appointmentDetails: {
    serviceName: string;
    barberName: string;
    startTime: string; // This is the local time string, e.g., "10:00 AM"
  }
): Promise<void> {
  const userDocRef = db.collection("users").doc(customerId);
  const appointmentDocRef = db.collection("appointments").doc(appointmentId);

  try {
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
      console.warn(`User document not found for customerId: ${customerId} (Appointment ID: ${appointmentId})`);
      await appointmentDocRef.update({reminderSent: true, reminderSkippedReason: "User document not found"});
      return;
    }

    const userData = userDocSnap.data() as {
      fcmToken?: string | null;
      firstName?: string;
    };
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log(`No FCM token for customer ${customerId} (Appt ID: ${appointmentId}). Marking reminderSent=true.`);
      await appointmentDocRef.update({reminderSent: true, reminderSkippedReason: "No FCM token"});
      return;
    }

    const customerFirstName = userData.firstName || "Customer";
    const {serviceName, barberName, startTime} = appointmentDetails;

    // The reminder message uses the local startTime string from the appointment
    const messagePayload = {
      notification: {
        title: "Appointment Reminder!",
        body: `Hi ${customerFirstName}, your appointment for ${serviceName} with ${barberName} is in about ${REMINDER_MINUTES_BEFORE} minutes at ${startTime}.`,
      },
      token: fcmToken,
    };

    console.log(`Attempting to send reminder for appointment ${appointmentId} to user ${customerId}.`);
    await admin.messaging().send(messagePayload);
    console.log(`Successfully sent message for appointment ${appointmentId}.`);

    await appointmentDocRef.update({reminderSent: true});
    console.log(`Updated 'reminderSent' flag for appointment ${appointmentId}.`);

  } catch (error: unknown) {
    console.error(`Error processing reminder for appointment ${appointmentId}:`, error);
    const errorCode = (error as {code?: string}).code;
    if (errorCode === "messaging/registration-token-not-registered" ||
        errorCode === "messaging/invalid-registration-token") {
      console.log(`FCM token for user ${customerId} is invalid. Removing it.`);
      await userDocRef.update({fcmToken: admin.firestore.FieldValue.delete()});
      // Mark as sent even if token was invalid, to avoid retrying with a known bad token
      await appointmentDocRef.update({reminderSent: true, reminderSkippedReason: "Invalid FCM token"});
    }
    // For other errors, don't mark reminderSent, allow retry.
  }
}
