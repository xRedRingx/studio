
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

// Initialize the Firebase Admin SDK.
admin.initializeApp();

const db = admin.firestore();

// --- Configuration ---
// MODIFIED FOR FASTER TESTING:
const REMINDER_MINUTES_BEFORE = 2; // Send reminder 2 minutes before
const REMINDER_WINDOW_MINUTES = 2; // Check a 2-minute window

export const sendAppointmentReminders = onSchedule(
  {
    // MODIFIED FOR FASTER TESTING:
    schedule: "every 1 minutes", // Runs every minute
    timeZone: "UTC",
  },
  async (event) => {
    console.log(`Scheduled function triggered. Trigger time: ${event.scheduleTime}`);

    try {
      const now = new Date(); // UTC by default on server

      const windowStart = new Date(now.getTime() + REMINDER_MINUTES_BEFORE * 60 * 1000);
      const windowEnd = new Date(windowStart.getTime() + REMINDER_WINDOW_MINUTES * 60 * 1000);

      const reminderWindowStartTimestamp = admin.firestore.Timestamp.fromDate(windowStart);
      const reminderWindowEndTimestamp = admin.firestore.Timestamp.fromDate(windowEnd);

      console.log(`Current UTC time: ${now.toISOString()}`);
      console.log(`Querying for appointments with 'appointmentTimestamp' (UTC) between:`);
      console.log(`  Window Start ISO: ${windowStart.toISOString()}`);
      console.log(`  Window End ISO: ${windowEnd.toISOString()}`);
      console.log(`  Query Start Timestamp (seconds.nanos): ${reminderWindowStartTimestamp.seconds}.${reminderWindowStartTimestamp.nanoseconds}`);
      console.log(`  Query End Timestamp (seconds.nanos): ${reminderWindowEndTimestamp.seconds}.${reminderWindowEndTimestamp.nanoseconds}`);

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

      const reminderPromises: Promise<void>[] = [];
      for (const doc of appointmentsSnapshot.docs) {
        const appointment = doc.data();
        const appointmentId = doc.id;

        // Log the timestamp of the found appointment for comparison
        const appTimestamp = appointment.appointmentTimestamp as admin.firestore.Timestamp | undefined;
        if (appTimestamp) {
            console.log(`  Processing Appointment ID: ${appointmentId}, Timestamp (seconds.nanos): ${appTimestamp.seconds}.${appTimestamp.nanoseconds}, Status: ${appointment.status}, ReminderSent: ${appointment.reminderSent === true}`);
        } else {
            console.log(`  Processing Appointment ID: ${appointmentId} - (Timestamp missing or null), Status: ${appointment.status}, ReminderSent: ${appointment.reminderSent === true}`);
        }


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
    startTime: string;
  }
): Promise<void> {
  const userDocRef = db.collection("users").doc(customerId);
  const appointmentDocRef = db.collection("appointments").doc(appointmentId);

  try {
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
      console.warn(`User document not found for customerId: ${customerId} (Appointment ID: ${appointmentId})`);
      await appointmentDocRef.update({ reminderSent: true, reminderSentAt: admin.firestore.FieldValue.serverTimestamp(), reminderNote: "User not found" });
      return;
    }

    const userData = userDocSnap.data() as { fcmToken?: string | null; firstName?: string; };
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log(`No FCM token for customer ${customerId} (Appt ID: ${appointmentId}). Marking reminderSent=true.`);
      await appointmentDocRef.update({ reminderSent: true, reminderSentAt: admin.firestore.FieldValue.serverTimestamp(), reminderNote: "No FCM token" });
      return;
    }

    const customerFirstName = userData.firstName || "Customer";
    const {serviceName, barberName, startTime} = appointmentDetails;

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

    await appointmentDocRef.update({ reminderSent: true, reminderSentAt: admin.firestore.FieldValue.serverTimestamp(), reminderNote: "Reminder sent successfully" });
    console.log(`Updated 'reminderSent' flag for appointment ${appointmentId}.`);

  } catch (error: unknown) {
    console.error(`Error processing reminder for appointment ${appointmentId}:`, error);
    const errorCode = (error as {code?: string}).code;
    if (errorCode === "messaging/registration-token-not-registered" || errorCode === "messaging/invalid-registration-token") {
      console.log(`FCM token for user ${customerId} is invalid. Removing it and marking reminder as sent (to avoid retries on bad token).`);
      await userDocRef.update({ fcmToken: admin.firestore.FieldValue.delete() });
      await appointmentDocRef.update({ reminderSent: true, reminderSentAt: admin.firestore.FieldValue.serverTimestamp(), reminderNote: "FCM token invalid, removed token" });
    }
    // For other errors, don't set reminderSent, allowing retry.
  }
}
