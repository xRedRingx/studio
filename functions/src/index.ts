
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// --- Configuration for Faster Testing ---
const REMINDER_MINUTES_BEFORE = 2;
const REMINDER_WINDOW_MINUTES = 2;

export const sendAppointmentReminders = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Africa/Algiers",
  },
  async (event) => {
    console.log(`Function triggered by scheduler. Event scheduleTime (UTC): ${
      event.scheduleTime}`);
    if ((event as any).timeZone) {
        console.log(`Event's target timezone: ${(event as any).timeZone}`);
    }

    try {
      const now = new Date();
      console.log(`Function's current Date() object: ${now.toString()} ` +
        "(This reflects the function server's perceived time and timezone)");

      const windowStart = new Date(now.getTime() +
        REMINDER_MINUTES_BEFORE * 60 * 1000);
      const windowEnd = new Date(windowStart.getTime() +
        REMINDER_WINDOW_MINUTES * 60 * 1000);

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

      // Temporarily removed .where("reminderSent", "==", false) for diagnostics
      const appointmentsSnapshot = await db.collection("appointments")
        .where("status", "==", "upcoming")
        // .where("reminderSent", "==", false) 
        .where("appointmentTimestamp", ">=", reminderWindowStartTimestamp)
        .where("appointmentTimestamp", "<=", reminderWindowEndTimestamp)
        .get();

      if (appointmentsSnapshot.empty) {
        console.log("No appointments found in the current window " +
          "requiring a reminder (with reminderSent filter temporarily removed).");
        return;
      }

      console.log(`Found ${appointmentsSnapshot.docs.length} appointments ` +
        "to remind (with reminderSent filter temporarily removed).");
      appointmentsSnapshot.forEach((doc) => {
        const appt = doc.data();
        const apptTimestamp = (appt.appointmentTimestamp as
          admin.firestore.Timestamp);
        console.log(`  - Found Appt ID: ${doc.id}, Timestamp: ${
          apptTimestamp.toDate().toISOString()} (sec: ${
          apptTimestamp.seconds}), Cust: ${appt.customerName}, ReminderSent: ${appt.reminderSent}`);
      });

      const reminderPromises: Promise<void>[] = [];
      for (const doc of appointmentsSnapshot.docs) {
        const appointment = doc.data();
        const appointmentId = doc.id;
        const {customerId, serviceName, barberName, startTime} = appointment;

        if (!customerId) {
          console.warn(`Appointment ${appointmentId} is missing a ` +
            "customerId. Skipping.");
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
      console.error("A critical error occurred in the " +
        "sendAppointmentReminders function:", error);
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
    const apptSnap = await appointmentDocRef.get();
    if (apptSnap.exists() && apptSnap.data()?.reminderSent === true) {
        console.log(`ProcessAndSendReminder: Skipping Appt ID: ${appointmentId}, reminderSent is already true.`);
        return;
    }

    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
      console.warn(`User document not found for customerId: ${customerId} ` +
        `(Appointment ID: ${appointmentId})`);
      // Mark as sent to avoid retrying for a user that doesn't exist
      await appointmentDocRef.update({
        reminderSent: true,
        reminderSkippedReason: "User document not found",
      });
      return;
    }

    const userData = userDocSnap.data() as {
      fcmToken?: string | null;
      firstName?: string;
    };
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log(`No FCM token for customer ${customerId} ` +
        `(Appt ID: ${appointmentId}). Marking reminderSent=true.`);
      await appointmentDocRef.update({
        reminderSent: true,
        reminderSkippedReason: "No FCM token",
      });
      return;
    }

    const customerFirstName = userData.firstName || "Customer";
    const {serviceName, barberName, startTime} = appointmentDetails;

    const messagePayload = {
      notification: {
        title: "Appointment Reminder!",
        body: `Hi ${customerFirstName}, your appointment for ${serviceName} ` +
          `with ${barberName} is in about ${REMINDER_MINUTES_BEFORE} ` +
          `minutes at ${startTime}.`,
      },
      token: fcmToken,
    };

    console.log(`Attempting to send reminder for appointment ${
      appointmentId} to user ${customerId}.`);
    await admin.messaging().send(messagePayload);
    console.log(`Successfully sent message for appointment ${appointmentId}.`);

    await appointmentDocRef.update({reminderSent: true});
    console.log(`Updated 'reminderSent' flag for appointment ${
      appointmentId}.`);
  } catch (error: unknown) {
    console.error(`Error processing reminder for appointment ${
      appointmentId}:`, error);
    const errorCode = (error as {code?: string}).code;
    if (errorCode === "messaging/registration-token-not-registered" ||
        errorCode === "messaging/invalid-registration-token") {
      console.log(`FCM token for user ${customerId} is invalid. ` +
        "Removing it.");
      await userDocRef.update({fcmToken: admin.firestore.FieldValue.delete()});
      // Mark as sent even if token was invalid, to avoid retrying with a
      // known bad token
      await appointmentDocRef.update({
        reminderSent: true,
        reminderSkippedReason: "Invalid FCM token",
      });
    }
    // For other errors, don't mark reminderSent, allow retry.
  }
}
