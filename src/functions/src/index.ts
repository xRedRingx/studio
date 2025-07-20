/**
 * @fileoverview This file contains all Firebase Cloud Functions for the BarberFlow application.
 * It includes scheduled functions for reminders and Firestore-triggered functions for
 * real-time notifications about bookings, cancellations, and appointment shifts.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import type { AppUser, Appointment } from "../../src/types";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// --- Configuration ---
const REMINDER_MINUTES_BEFORE = 30;
const REMINDER_WINDOW_MINUTES = 5;
const TIMEZONE = "Africa/Algiers";

// Helper Functions
const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || !timeStr.includes(' ')) return 0;
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (hours === 12) hours = modifier.toUpperCase() === 'AM' ? 0 : 12;
    else if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
    return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    const period = h < 12 || h === 24 ? 'AM' : 'PM';
    return `${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

const formatDateToYYYYMMDD = (date: Date): string => date.toISOString().split('T')[0];

// =================================================================================
// 1. SCHEDULED FUNCTION - Send Appointment Reminders
// =================================================================================

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
// 2. FIRESTORE TRIGGERS - Booking, Cancellation, Deletion
// =================================================================================

export const onAppointmentCreate = onDocumentCreated("appointments/{appointmentId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const appointment = snapshot.data() as Appointment;
    const appointmentId = snapshot.id;
    const { barberId, customerName, serviceName, date, startTime, endTime } = appointment;

    console.log(`[New Booking] Notifying barber ${barberId}.`);
    const barber = await getUserData(barberId);
    if (barber?.fcmToken) {
        const message = {
            notification: { title: "✅ New Booking!", body: `${customerName} booked ${serviceName} for ${date} at ${startTime}.` },
            token: barber.fcmToken,
        };
        await sendNotification(barberId, message, `new booking notification for ${appointmentId}`);
    }

    const publicSlotRef = db.doc(`publicBarberData/${barberId}/bookedSlots/${appointmentId}`);
    try {
        await publicSlotRef.set({ startTime, endTime, date });
        console.log(`[New Booking] Created public booked slot for ${appointmentId}.`);
    } catch (error) {
        console.error(`[New Booking] Failed to create public booked slot for ${appointmentId}:`, error);
    }
});

export const onAppointmentUpdate = onDocumentUpdated("appointments/{appointmentId}", async (event) => {
    const { before, after } = event.data!;
    const beforeData = before.data() as Appointment;
    const afterData = after.data() as Appointment;

    const hasBecomeCancelled = beforeData.status !== 'cancelled' && afterData.status === 'cancelled';
    const hasBecomeInactive = !['completed', 'no-show'].includes(beforeData.status) && ['completed', 'no-show'].includes(afterData.status);

    if (hasBecomeCancelled) {
        const { barberId, customerId, customerName, barberName, serviceName } = afterData;
        console.log(`[Cancellation] Notifying for appointment ${after.id}.`);
        if (barberId) {
            const barber = await getUserData(barberId);
            if (barber?.fcmToken) {
                const message = { notification: { title: "Appointment Cancelled", body: `Your appointment with ${customerName} for ${serviceName} has been cancelled.` }, token: barber.fcmToken };
                await sendNotification(barberId, message, `cancellation for ${after.id}`);
            }
        }
        if (customerId) {
            const customer = await getUserData(customerId);
            if (customer?.fcmToken) {
                const message = { notification: { title: "Appointment Cancelled", body: `Your appointment with ${barberName} for ${serviceName} has been cancelled.` }, token: customer.fcmToken };
                await sendNotification(customerId, message, `cancellation for ${after.id}`);
            }
        }
    }

    if (hasBecomeCancelled || hasBecomeInactive) {
        const publicSlotRef = db.doc(`publicBarberData/${afterData.barberId}/bookedSlots/${after.id}`);
        try {
            await publicSlotRef.delete();
            console.log(`[Inactive] Deleted public booked slot for ${after.id}.`);
        } catch (error) {
            console.warn(`[Inactive] Could not delete public booked slot for ${after.id}:`, error);
        }
    }
});

export const onAppointmentDelete = onDocumentDeleted("appointments/{appointmentId}", async (event) => {
    const deletedAppointment = event.data?.data() as Appointment;
    if (!deletedAppointment) return;

    const publicSlotRef = db.doc(`publicBarberData/${deletedAppointment.barberId}/bookedSlots/${event.params.appointmentId}`);
    try {
        await publicSlotRef.delete();
        console.log(`[Delete] Deleted public booked slot for ${event.params.appointmentId}.`);
    } catch (error) {
        console.warn(`[Delete] Could not delete public booked slot for ${event.params.appointmentId}:`, error);
    }
});

// =================================================================================
// 3. FIRESTORE TRIGGER & CALLABLE - Barber Busy Mode / Appointment Shift
// =================================================================================

export const onBarberUpdate = onDocumentUpdated("users/{userId}", async (event) => {
    const { before, after } = event.data!;
    const beforeData = before.data() as AppUser;
    const afterData = after.data() as AppUser;

    if (beforeData.isTemporarilyUnavailable === true && afterData.isTemporarilyUnavailable === false) {
        const busyStartTime = beforeData.unavailableSince?.toDate();
        const busyEndTime = afterData.updatedAt?.toDate();

        if (!busyStartTime || !busyEndTime) {
            console.log(`[Shift Notify] Barber ${after.id} is now available, but missing timestamps.`);
            return;
        }

        const busyDurationMinutes = Math.round((busyEndTime.getTime() - busyStartTime.getTime()) / (1000 * 60));

        if (busyDurationMinutes <= 0) {
            console.log(`[Shift Notify] Barber ${after.id} available. No significant duration.`);
            return;
        }

        console.log(`[Shift Notify] Barber ${after.id} available after ${busyDurationMinutes} mins. Notifying.`);

        const appointmentsSnapshot = await db.collection("appointments")
            .where('barberId', '==', after.id)
            .where('date', '==', formatDateToYYYYMMDD(new Date()))
            .where('status', 'in', ['upcoming', 'customer-initiated-check-in', 'barber-initiated-check-in'])
            .where('appointmentTimestamp', '>=', beforeData.unavailableSince!)
            .get();

        if (appointmentsSnapshot.empty) {
            console.log(`[Shift Notify] No upcoming appointments to notify for barber ${after.id}.`);
            return;
        }

        for (const doc of appointmentsSnapshot.docs) {
            const appointment = doc.data() as Appointment;
            const customerId = appointment.customerId;
            if (customerId) {
                const customer = await getUserData(customerId);
                if (customer?.fcmToken) {
                    const message = {
                        notification: {
                            title: "🗓️ Your Appointment Time Has Shifted",
                            body: `Your barber was briefly unavailable. Your appointment has been moved by about ${busyDurationMinutes} minutes. Your new start time is ${appointment.startTime}.`,
                        },
                        token: customer.fcmToken,
                    };
                    await sendNotification(customerId, message, `shift notification for ${doc.id}`);
                }
            }
        }
    }
});

export const toggleBarberTemporaryStatus = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const barberId = request.auth.uid;
    const { isTemporarilyUnavailable } = request.data;
    const now = admin.firestore.Timestamp.now();
    const barberRef = db.doc(`users/${barberId}`);
    const batch = db.batch();

    try {
        const barberSnap = await barberRef.get();
        if (!barberSnap.exists) {
            throw new HttpsError('not-found', 'Barber profile not found.');
        }
        const barberData = barberSnap.data() as AppUser;

        if (isTemporarilyUnavailable) {
            batch.update(barberRef, { isTemporarilyUnavailable: true, unavailableSince: now, updatedAt: now });
        } else {
            batch.update(barberRef, { isTemporarilyUnavailable: false, unavailableSince: null, updatedAt: now });
            const busyStartTime = barberData.unavailableSince?.toDate();
            if (busyStartTime) {
                const busyDurationMs = now.toDate().getTime() - busyStartTime.getTime();
                const busyDurationMinutes = Math.round(busyDurationMs / (1000 * 60));

                if (busyDurationMinutes > 0) {
                    const appointmentsSnapshot = await db.collection("appointments")
                        .where('barberId', '==', barberId)
                        .where('date', '==', formatDateToYYYYMMDD(new Date()))
                        .where('status', 'in', ['upcoming', 'customer-initiated-check-in', 'barber-initiated-check-in'])
                        .where('appointmentTimestamp', '>=', barberData.unavailableSince!)
                        .get();

                    appointmentsSnapshot.forEach(doc => {
                        const appointment = doc.data() as Appointment;
                        const serviceDuration = timeToMinutes(appointment.endTime) - timeToMinutes(appointment.startTime);
                        const newStartTimeMinutes = timeToMinutes(appointment.startTime) + busyDurationMinutes;
                        const newEndTimeMinutes = newStartTimeMinutes + serviceDuration;
                        const newTimestamp = admin.firestore.Timestamp.fromDate(new Date(appointment.appointmentTimestamp!.toDate().getTime() + busyDurationMs));
                        
                        batch.update(doc.ref, {
                            startTime: minutesToTime(newStartTimeMinutes),
                            endTime: minutesToTime(newEndTimeMinutes),
                            appointmentTimestamp: newTimestamp,
                            updatedAt: now,
                        });
                    });
                }
            }
        }
        await batch.commit();
        return { success: true, message: `Status updated to ${isTemporarilyUnavailable ? 'unavailable' : 'available'}.` };
    } catch (error) {
        console.error("Error in toggleBarberTemporaryStatus:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'An internal error occurred while updating status.');
    }
});


// =================================================================================
// HELPER FUNCTIONS
// =================================================================================

async function getUserData(userId: string): Promise<AppUser | null> {
  const userDoc = await db.collection("users").doc(userId).get();
  return userDoc.exists ? userDoc.data() as AppUser : null;
}

async function sendNotification(userId: string, message: admin.messaging.Message, contextLog: string): Promise<void> {
    try {
        await messaging.send(message);
        console.log(`[Notification] Successfully sent ${contextLog} to user ${userId}.`);
    } catch (error: any) {
        console.error(`[Notification] Error sending ${contextLog} to user ${userId}:`, error);
        if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {
            console.log(`[Notification] Invalid FCM token for user ${userId}. Removing it.`);
            await db.collection("users").doc(userId).update({ fcmToken: admin.firestore.FieldValue.delete() });
        }
    }
}
