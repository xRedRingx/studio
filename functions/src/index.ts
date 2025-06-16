import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// --- Configuration for Testing ---
const REMINDER_MINUTES_BEFORE = 30; // Test: send reminder 24 min before
const REMINDER_WINDOW_MINUTES = 2;
const TIMEZONE = "Africa/Algiers"; // GMT+1

/**
 * Sends appointment reminders to customers via FCM push notifications.
 * Runs every minute and checks for appointments that need reminders.
 */
export const sendAppointmentReminders = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: TIMEZONE,
  },
  async (event) => {
    console.log(`Function triggered at: ${new Date().toISOString()}`);
    console.log(`Event scheduleTime: ${event.scheduleTime}`);

    try {
      // Get current time in the target timezone
      const now = new Date();
      console.log(`Server time (UTC): ${now.toISOString()}`);
      console.log(`Server time (Local GMT+1): ${new Date(now.getTime() +
        60 * 60 * 1000).toISOString().replace("Z", "GMT+1")}`);

      // Calculate the reminder window
      // We want appointments that start in REMINDER_MINUTES_BEFORE from now
      const reminderTargetStart = new Date(now.getTime() +
        REMINDER_MINUTES_BEFORE * 60 * 1000);
      const reminderTargetEnd = new Date(now.getTime() +
        (REMINDER_MINUTES_BEFORE + REMINDER_WINDOW_MINUTES) * 60 * 1000);

      console.log("Looking for appointments between:");
      console.log(`  Window Start: ${reminderTargetStart.toISOString()}`);
      console.log(`  Window End: ${reminderTargetEnd.toISOString()}`);

      const windowStartTimestamp = admin.firestore.Timestamp
        .fromDate(reminderTargetStart);
      const windowEndTimestamp = admin.firestore.Timestamp
        .fromDate(reminderTargetEnd);

      // Query for appointments in the reminder window
      // Modified query to handle missing reminderSent field
      const appointmentsSnapshot = await db.collection("appointments")
        .where("status", "==", "upcoming")
        .where("appointmentTimestamp", ">=", windowStartTimestamp)
        .where("appointmentTimestamp", "<=", windowEndTimestamp)
        .get();

      if (appointmentsSnapshot.empty) {
        console.log("No appointments found in the current reminder window.");
        return;
      }

      // Filter out appointments that already have reminderSent: true
      const appointmentsNeedingReminders = appointmentsSnapshot.docs.filter(
        (doc) => {
          const data = doc.data();
          return data.reminderSent !== true;
        },
      );

      if (appointmentsNeedingReminders.length === 0) {
        console.log("No appointments need reminders (all already sent).");
        return;
      }

      const appointmentCount = appointmentsNeedingReminders.length;
      console.log(`Found ${appointmentCount} appointment(s) needing ` +
        "reminders:");

      // Log all found appointments for debugging
      appointmentsNeedingReminders.forEach((doc) => {
        const appt = doc.data();
        const apptTimestamp = appt.appointmentTimestamp as
          admin.firestore.Timestamp;
        const apptDate = apptTimestamp.toDate();
        console.log(`  - Appointment ID: ${doc.id}`);
        console.log(`    Customer: ${appt.customerName || appt.customerId}`);
        console.log(`    Appointment Time: ${apptDate.toISOString()}`);
        console.log(`    Service: ${appt.serviceName}`);
        console.log(`    ReminderSent: ${appt.reminderSent || "undefined"}`);
      });

      // Process all reminders
      const reminderPromises: Promise<void>[] = [];
      for (const doc of appointmentsNeedingReminders) {
        const appointment = doc.data();
        const appointmentId = doc.id;

        if (!appointment.customerId) {
          console.warn(`Appointment ${appointmentId} missing customerId. ` +
            "Skipping.");
          continue;
        }

        const sendPromise = processAndSendReminder(
          appointment.customerId,
          appointmentId,
          {
            serviceName: appointment.serviceName,
            barberName: appointment.barberName,
            appointmentTimestamp: appointment.appointmentTimestamp,
          },
        );
        reminderPromises.push(sendPromise);
      }

      await Promise.all(reminderPromises);
      console.log("Finished processing all reminders for this batch.");
    } catch (error) {
      console.error("Critical error in sendAppointmentReminders:", error);
      throw error; // Re-throw to ensure Cloud Functions logs the error
    }
  },
);

/**
 * Processes and sends a reminder notification for a specific appointment.
 * @param {string} customerId - The customer's user ID
 * @param {string} appointmentId - The appointment document ID
 * @param {object} appointmentDetails - Appointment details object
 * @return {Promise<void>} Promise that resolves when processing is complete
 */
async function processAndSendReminder(
  customerId: string,
  appointmentId: string,
  appointmentDetails: {
    serviceName: string;
    barberName: string;
    appointmentTimestamp: admin.firestore.Timestamp;
  },
): Promise<void> {
  console.log(`Processing reminder for appointment ${appointmentId}, ` +
    `customer ${customerId}`);

  const userDocRef = db.collection("users").doc(customerId);
  const appointmentDocRef = db.collection("appointments").doc(appointmentId);

  try {
    // Double-check that reminder hasn't been sent already
    const apptSnap = await appointmentDocRef.get();
    if (!apptSnap.exists) {
      console.warn(`Appointment ${appointmentId} no longer exists. ` +
        "Skipping.");
      return;
    }

    const currentApptData = apptSnap.data();
    if (currentApptData?.reminderSent === true) {
      console.log(`Reminder already sent for appointment ${appointmentId}. ` +
        "Skipping.");
      return;
    }

    // Get user data
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
      console.warn(`User ${customerId} not found. Marking reminder as sent.`);
      await appointmentDocRef.update({
        reminderSent: true,
        reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
        reminderSkippedReason: "User document not found",
      });
      return;
    }

    const userData = userDocSnap.data() as {
      fcmToken?: string | null;
      firstName?: string;
      lastName?: string;
    };

    const fcmToken = userData.fcmToken;
    if (!fcmToken) {
      console.log(`No FCM token for user ${customerId}. ` +
        "Marking reminder as sent.");
      await appointmentDocRef.update({
        reminderSent: true,
        reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
        reminderSkippedReason: "No FCM token",
      });
      return;
    }

    // Prepare the message
    const customerName = userData.firstName || "Customer";
    const {serviceName, barberName} = appointmentDetails;

    // Format the appointment time nicely
    const appointmentTime = appointmentDetails.appointmentTimestamp.toDate();
    const timeString = appointmentTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TIMEZONE,
    });

    const notificationBody = `Hi ${customerName}! Your ${serviceName} ` +
      `appointment with ${barberName} is in ${REMINDER_MINUTES_BEFORE} ` +
      `minutes at ${timeString}. Time to head to the barber!`;

    const messagePayload = {
      notification: {
        title: "⏰ Appointment Reminder",
        body: notificationBody,
      },
      data: {
        type: "appointment_reminder",
        appointmentId: appointmentId,
        customerId: customerId,
        appointmentTime: appointmentTime.toISOString(),
      },
      token: fcmToken,
      android: {
        notification: {
          priority: "high" as const,
          defaultSound: true,
          channelId: "appointment_reminders",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    console.log(`Sending reminder to ${customerId} for appointment ` +
      `${appointmentId}`);
    console.log(`Message: ${messagePayload.notification.body}`);

    // Send the notification
    const response = await admin.messaging().send(messagePayload);
    console.log(`✅ Successfully sent reminder. Message ID: ${response}`);

    // Mark as sent
    await appointmentDocRef.update({
      reminderSent: true,
      reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
      reminderMessageId: response,
    });

    console.log("✅ Updated reminderSent flag for appointment " +
      `${appointmentId}`);
  } catch (error: unknown) {
    console.error("❌ Error processing reminder for appointment " +
      `${appointmentId}:`, error);

    // Handle specific FCM errors
    const errorWithCode = error as {code?: string};
    if (errorWithCode.code) {
      console.log(`FCM Error code: ${errorWithCode.code}`);

      const invalidTokenCodes = [
        "messaging/registration-token-not-registered",
        "messaging/invalid-registration-token",
      ];

      if (invalidTokenCodes.includes(errorWithCode.code)) {
        console.log(`Invalid FCM token for user ${customerId}. ` +
          "Removing token.");

        // Remove the invalid token
        await userDocRef.update({
          fcmToken: admin.firestore.FieldValue.delete(),
        });

        // Mark reminder as sent to avoid retrying
        await appointmentDocRef.update({
          reminderSent: true,
          reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
          reminderSkippedReason: "Invalid FCM token: " +
            `${errorWithCode.code}`,
        });

        return;
      }
    }

    // For other errors, don't mark as sent so it can retry
    console.log("Will retry sending reminder for appointment " +
      `${appointmentId} on next run`);
    throw error; // Re-throw to be caught by the main function
  }
}
