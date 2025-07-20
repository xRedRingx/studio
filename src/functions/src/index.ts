
/**
 * @fileoverview This file contains all Firebase Cloud Functions for the BarberFlow application.
 * It includes scheduled functions for reminders and Firestore-triggered functions for
 * real-time notifications about bookings, cancellations, and appointment shifts.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import type { AppUser, Appointment, BarberService } from "../../src/types";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// --- Configuration ---
const REMINDER_MINUTES_BEFORE = 30;
const REMINDER_WINDOW_MINUTES = 5;
const TIMEZONE = "Africa/Algiers";

// =================================================================================
// 1. SCHEDULED FUNCTION - Send Appointment Reminders
// =================================================================================

/**
 * A scheduled Cloud Function that sends push notification reminders for upcoming appointments.
 *
 * @remarks
 * Firebase Index Required for `appointments` collection:
 * - `status` (Ascending)
 * - `reminderSent` (Ascending)
 * - `appointmentTimestamp` (Ascending)
 */
export const sendAppointmentReminders = onSchedule(
  {
    schedule: `every ${REMINDER_WINDOW_MINUTES} minutes`,
    timeZone: TIMEZONE,
  },
  async (event) => {
    console.log(`[Reminders] Function triggered at: ${new Date().toISOString()}`);

    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + REMINDER_MINUTES_BEFORE * 60 * 1000);
      const windowEnd = new Date(windowStart.getTime() + REMINDER_WINDOW_MINUTES * 60 * 1000);

      const reminderWindowStartTimestamp = admin.firestore.Timestamp.fromDate(windowStart);
      const reminderWindowEndTimestamp = admin.firestore.Timestamp.fromDate(windowEnd);

      const appointmentsSnapshot = await db.collection("appointments")
        .where("status", "==", "upcoming")
        .where("reminderSent", "==", false)
        .where("appointmentTimestamp", ">=", reminderWindowStartTimestamp)
        .where("appointmentTimestamp", "<=", reminderWindowEndTimestamp)
        .get();

      if (appointmentsSnapshot.empty) {
        console.log("[Reminders] No appointments found in the current reminder window.");
        return;
      }

      console.log(`[Reminders] Found ${appointmentsSnapshot.docs.length} appointments needing reminders.`);
      for (const doc of appointmentsSnapshot.docs) {
        const appointment = doc.data() as Appointment;
        const { customerId, serviceName, barberName, startTime } = appointment;
        if (!customerId) continue;

        const customer = await getUserData(customerId);
        if (customer?.fcmToken) {
          const message = {
            notification: {
              title: "⏰ Appointment Reminder!",
              body: `Hi ${customer.firstName || "Customer"}, your ${serviceName} appointment with ${barberName} is in about ${REMINDER_MINUTES_BEFORE} minutes at ${startTime}.`,
            },
            token: customer.fcmToken,
          };
          await sendNotification(customerId, message, `reminder for appointment ${doc.id}`);
          await doc.ref.update({ reminderSent: true });
        } else {
            await doc.ref.update({ reminderSent: true, reminderSkippedReason: "No FCM token" });
        }
      }
    } catch (error) {
      console.error("[Reminders] Critical error in sendAppointmentReminders:", error);
    }
  }
);


// =================================================================================
// 2. FIRESTORE TRIGGER - New Booking & Cancellation Handlers
// =================================================================================

/**
 * Function: onAppointmentCreate
 * Triggered when a new appointment document is created.
 * Sends a notification to the barber and creates a public, anonymized "booked slot"
 * for client-side availability checks.
 */
export const onAppointmentCreate = onDocumentCreated("appointments/{appointmentId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.log("[New Booking] No data associated with the event.");
        return;
    }
    const appointment = snapshot.data() as Appointment;
    const appointmentId = snapshot.id;
    const { barberId, customerName, serviceName, date, startTime, endTime } = appointment;

    // --- Action 1: Notify Barber ---
    console.log(`[New Booking] New appointment created: ${appointmentId}. Notifying barber ${barberId}.`);
    const barber = await getUserData(barberId);
    if (barber?.fcmToken) {
        const message = {
            notification: {
                title: "✅ New Booking!",
                body: `${customerName} booked ${serviceName} for ${date} at ${startTime}.`,
            },
            token: barber.fcmToken,
        };
        await sendNotification(barberId, message, `new booking notification for ${appointmentId}`);
    }

    // --- Action 2: Create Public Booked Slot ---
    // This creates an anonymized document that clients can safely read to check for availability.
    const publicSlotRef = db.doc(`publicBarberData/${barberId}/bookedSlots/${appointmentId}`);
    try {
        await publicSlotRef.set({
            startTime: startTime,
            endTime: endTime,
            date: date,
        });
        console.log(`[New Booking] Created public booked slot for appointment ${appointmentId}.`);
    } catch (error) {
        console.error(`[New Booking] Failed to create public booked slot for ${appointmentId}:`, error);
    }
});


/**
 * Function: onAppointmentUpdate
 * Triggered when an appointment document is updated.
 * Handles two main cases:
 * 1. If status changes to 'cancelled', it sends notifications and deletes the public booked slot.
 * 2. If status changes to 'completed' or 'no-show', it also deletes the public booked slot.
 */
export const onAppointmentUpdate = onDocumentUpdated("appointments/{appointmentId}", async (event) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data() as Appointment;
    const after = change.after.data() as Appointment;
    const appointmentId = change.after.id;

    const hasBecomeCancelled = before.status !== 'cancelled' && after.status === 'cancelled';
    const hasBecomeInactive = !['completed', 'no-show'].includes(before.status) && ['completed', 'no-show'].includes(after.status);

    // --- Case 1: Appointment was just cancelled ---
    if (hasBecomeCancelled) {
        const { barberId, customerId, customerName, barberName, serviceName } = after;
        console.log(`[Cancellation] Appointment ${appointmentId} was cancelled. Notifying parties.`);

        // Notify the Barber
        if (barberId) {
            const barber = await getUserData(barberId);
            if (barber?.fcmToken) {
                const message = {
                    notification: { title: "Appointment Cancelled", body: `Your appointment with ${customerName} for ${serviceName} has been cancelled.` },
                    token: barber.fcmToken,
                };
                await sendNotification(barberId, message, `cancellation for ${appointmentId}`);
            }
        }

        // Notify the Customer
        if (customerId) {
            const customer = await getUserData(customerId);
            if (customer?.fcmToken) {
                const message = {
                    notification: { title: "Appointment Cancelled", body: `Your appointment with ${barberName} for ${serviceName} has been cancelled.` },
                    token: customer.fcmToken,
                };
                await sendNotification(customerId, message, `cancellation for ${appointmentId}`);
            }
        }
    }

    // --- Case 2: Appointment just became inactive (cancelled, completed, no-show) ---
    // This is to clean up the public booked slots.
    if (hasBecomeCancelled || hasBecomeInactive) {
        const publicSlotRef = db.doc(`publicBarberData/${after.barberId}/bookedSlots/${appointmentId}`);
        try {
            await publicSlotRef.delete();
            console.log(`[Inactive] Deleted public booked slot for inactive appointment ${appointmentId}.`);
        } catch (error) {
            // It's okay if it fails (e.g., doesn't exist), just log it.
            console.warn(`[Inactive] Could not delete public booked slot for ${appointmentId}:`, error);
        }
    }
});

/**
 * Function: onAppointmentDelete
 * Triggered when an appointment document is deleted directly (less common, but for cleanup).
 * Deletes the corresponding public booked slot.
 */
export const onAppointmentDelete = onDocumentDeleted("appointments/{appointmentId}", async (event) => {
    const deletedAppointment = event.data?.data() as Appointment;
    if (!deletedAppointment) return;

    const { barberId } = deletedAppointment;
    const appointmentId = event.params.appointmentId;
    
    const publicSlotRef = db.doc(`publicBarberData/${barberId}/bookedSlots/${appointmentId}`);
    try {
        await publicSlotRef.delete();
        console.log(`[Delete] Deleted public booked slot for deleted appointment ${appointmentId}.`);
    } catch (error) {
        console.warn(`[Delete] Could not delete public booked slot for ${appointmentId}:`, error);
    }
});


// =================================================================================
// 3. FIRESTORE TRIGGER - Barber Busy Mode / Appointment Shift Notifications
// =================================================================================

/**
 * Function: onBarberUpdate
 * Triggered when a barber's user document is updated.
 * Specifically handles the case when a barber goes from "temporarily unavailable" back to "available".
 * If so, it finds affected customers and notifies them of their appointment shifts.
 */
export const onBarberUpdate = onDocumentUpdated("users/{userId}", async (event) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data() as AppUser;
    const after = change.after.data() as AppUser;
    const barberId = change.after.id;

    // Check if the barber was temporarily unavailable and now is available.
    if (before.isTemporarilyUnavailable === true && after.isTemporarilyUnavailable === false) {
        // Ensure that the timestamps are valid Firestore Timestamps before proceeding
        const busyStartTime = before.unavailableSince instanceof admin.firestore.Timestamp ? before.unavailableSince.toDate() : null;
        const busyEndTime = after.updatedAt instanceof admin.firestore.Timestamp ? after.updatedAt.toDate() : null;

        if (!busyStartTime || !busyEndTime) {
            console.log(`[Shift Notify] Barber ${barberId} is now available, but missing valid timestamps. Cannot calculate shift.`);
            return;
        }

        const busyDurationMinutes = Math.round((busyEndTime.getTime() - busyStartTime.getTime()) / (1000 * 60));

        if (busyDurationMinutes <= 0) {
            console.log(`[Shift Notify] Barber ${barberId} available. No significant busy duration (${busyDurationMinutes} mins). No notifications sent.`);
            return;
        }

        console.log(`[Shift Notify] Barber ${barberId} is now available after being busy for ${busyDurationMinutes} minutes. Checking for appointments to notify.`);

        const todayStr = new Date().toISOString().split('T')[0];
        // Find all of today's appointments for this barber that were not completed/cancelled
        // and were scheduled to start after the busy period began.
        const appointmentsSnapshot = await db.collection("appointments")
            .where('barberId', '==', barberId)
            .where('date', '==', todayStr)
            .where('status', 'in', ['upcoming', 'customer-initiated-check-in', 'barber-initiated-check-in'])
            .where('appointmentTimestamp', '>=', before.unavailableSince)
            .get();

        if (appointmentsSnapshot.empty) {
            console.log(`[Shift Notify] No upcoming appointments found for barber ${barberId} to notify.`);
            return;
        }

        console.log(`[Shift Notify] Found ${appointmentsSnapshot.docs.length} appointments to notify about shifting.`);
        for (const doc of appointmentsSnapshot.docs) {
            const appointment = doc.data() as Appointment;
            // The appointment document was already updated by the frontend context function
            // when the barber's status was toggled. This function's job is just to notify.
            const newStartTime = appointment.startTime;
            const customerId = appointment.customerId;

            if (customerId) {
                const customer = await getUserData(customerId);
                if (customer?.fcmToken) {
                    const message = {
                        notification: {
                            title: "🗓️ Your Appointment Time Has Shifted",
                            body: `Your barber was briefly unavailable. Your appointment has been moved by about ${busyDurationMinutes} minutes. Your new start time is ${newStartTime}.`,
                        },
                        token: customer.fcmToken,
                    };
                    await sendNotification(customerId, message, `shift notification for appointment ${doc.id}`);
                }
            }
        }
    }
});


// =================================================================================
// HELPER FUNCTIONS
// =================================================================================

/**
 * Fetches a user's data from the 'users' collection in Firestore.
 * @param {string} userId - The ID of the user to fetch.
 * @returns {Promise<AppUser | null>} The user's data or null if not found.
 */
async function getUserData(userId: string): Promise<AppUser | null> {
  const userDoc = await db.collection("users").doc(userId).get();
  return userDoc.exists ? userDoc.data() as AppUser : null;
}

/**
 * Sends a push notification payload using Firebase Cloud Messaging.
 * Includes error handling for invalid or unregistered FCM tokens.
 * @param {string} userId - The recipient's user ID (for logging and token removal).
 * @param {admin.messaging.Message} message - The message payload to send.
 * @param {string} contextLog - A string for logging to identify the notification's context.
 * @returns {Promise<void>}
 */
async function sendNotification(userId: string, message: admin.messaging.Message, contextLog: string): Promise<void> {
    try {
        await messaging.send(message);
        console.log(`[Notification] Successfully sent ${contextLog} to user ${userId}.`);
    } catch (error: any) {
        console.error(`[Notification] Error sending ${contextLog} to user ${userId}:`, error);
        // If the error is due to an invalid token, remove it from the user's document.
        if (
            error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered'
        ) {
            console.log(`[Notification] Invalid FCM token for user ${userId}. Removing it.`);
            await db.collection("users").doc(userId).update({ fcmToken: admin.firestore.FieldValue.delete() });
        }
    }
}
