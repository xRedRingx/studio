/**
 * @fileoverview TypeScript type definitions for the BarberFlow application.
 * This file centralizes all custom types used across the project, ensuring
 * type safety and better code maintainability.
 */

import type { User as FirebaseUserAuth } from 'firebase/auth'; // Base Firebase Auth user type.
import type { Timestamp } from 'firebase/firestore'; // Firestore Timestamp type.

/**
 * Defines the possible roles a user can have in the application.
 * @typedef {'customer' | 'barber'} UserRole
 */
export type UserRole = 'customer' | 'barber';

/**
 * Extends the base FirebaseUserAuth type.
 * Useful for type hinting when dealing directly with Firebase Auth user objects.
 * @interface FirebaseUser
 * @extends {FirebaseUserAuth}
 */
export interface FirebaseUser extends FirebaseUserAuth {}

/**
 * Defines the structure for application user data stored in Firestore.
 * This extends basic auth information with application-specific fields.
 * @interface AppUser
 * @property {string} uid - The unique ID of the user (from Firebase Auth).
 * @property {UserRole} [role] - The role of the user in the application.
 * @property {string} [firstName] - User's first name.
 * @property {string} [lastName] - User's last name.
 * @property {string} email - User's email address.
 * @property {string | null} [phoneNumber] - User's phone number (optional).
 * @property {string | null} [address] - User's address (optional).
 * @property {string | null} [bio] - Barber's biography (optional, barber-specific).
 * @property {string[] | null} [specialties] - Barber's list of specialties (optional, barber-specific).
 * @property {boolean} [isAcceptingBookings] - Whether a barber is currently accepting online bookings (barber-specific).
 * @property {boolean} [isTemporarilyUnavailable] - Whether a barber is temporarily unavailable (barber-specific).
 * @property {Timestamp | null} [unavailableSince] - Timestamp indicating when the barber became temporarily unavailable (barber-specific).
 * @property {string | null} [fcmToken] - Firebase Cloud Messaging token for push notifications (optional).
 * @property {Timestamp} [createdAt] - Timestamp of when the user document was created.
 * @property {Timestamp} [updatedAt] - Timestamp of when the user document was last updated.
 * @property {string | null} [displayName] - User's display name (often derived from first/last name or email).
 * @property {boolean} [emailVerified] - Whether the user's email address has been verified by Firebase Auth.
 */
export interface AppUser {
  uid: string;
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  email: string;
  phoneNumber?: string | null;
  address?: string | null;
  bio?: string | null; // Barber specific
  specialties?: string[] | null; // Barber specific
  isAcceptingBookings?: boolean; // Barber specific
  isTemporarilyUnavailable?: boolean; // Barber specific
  unavailableSince?: Timestamp | null; // Barber specific
  fcmToken?: string | null; // For push notifications
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  displayName?: string | null;
  emailVerified?: boolean;
}

/**
 * Defines the structure for a barber's service.
 * @interface BarberService
 * @property {string} id - The unique ID of the service document.
 * @property {string} barberId - The ID of the barber offering this service.
 * @property {string} name - The name of the service (e.g., "Men's Haircut").
 * @property {number} price - The price of the service.
 * @property {number} duration - The duration of the service in minutes.
 * @property {Timestamp} [createdAt] - Timestamp of when the service was created.
 * @property {Timestamp} [updatedAt] - Timestamp of when the service was last updated.
 */
export interface BarberService {
  id: string;
  barberId: string;
  name: string;
  price: number;
  duration: number; // in minutes
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Defines the days of the week.
 * @typedef {'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'} DayOfWeek
 */
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

/**
 * Defines the availability structure for a single day in a barber's schedule.
 * @interface DayAvailability
 * @property {DayOfWeek} day - The day of the week.
 * @property {boolean} isOpen - Whether the barber is open on this day.
 * @property {string} startTime - The start time of work if open (e.g., "09:00 AM").
 * @property {string} endTime - The end time of work if open (e.g., "05:00 PM").
 */
export interface DayAvailability {
  day: DayOfWeek;
  isOpen: boolean;
  startTime: string; // e.g., "09:00 AM"
  endTime:string;   // e.g., "05:00 PM"
}

/**
 * Defines the structure for a barber's weekly schedule document in Firestore.
 * @interface BarberScheduleDoc
 * @property {string} barberId - The ID of the barber this schedule belongs to.
 * @property {DayAvailability[]} schedule - An array defining availability for each day of the week.
 * @property {Timestamp} [updatedAt] - Timestamp of when the schedule was last updated.
 */
export interface BarberScheduleDoc {
  barberId: string;
  schedule: DayAvailability[];
  updatedAt?: Timestamp;
}

/**
 * Defines the possible statuses for an appointment.
 * @typedef { | 'upcoming' | 'customer-initiated-check-in' | 'barber-initiated-check-in' | 'in-progress' | 'customer-initiated-completion' | 'barber-initiated-completion' | 'completed' | 'cancelled' | 'no-show'} AppointmentStatus
 */
export type AppointmentStatus =
  | 'upcoming' // Scheduled, not yet started.
  | 'customer-initiated-check-in' // Customer has checked in, waiting for barber.
  | 'barber-initiated-check-in'   // Barber noted customer arrival, waiting for customer confirmation or direct start.
  | 'in-progress'                 // Service is currently being performed.
  | 'customer-initiated-completion' // Customer marked service as done, waiting for barber confirmation.
  | 'barber-initiated-completion'   // Barber marked service as done, waiting for customer confirmation.
  | 'completed'                   // Service successfully completed.
  | 'cancelled'                   // Appointment was cancelled.
  | 'no-show';                    // Customer did not show up for the appointment.

/**
 * Defines the structure for an appointment document in Firestore.
 * @interface Appointment
 * @property {string} id - The unique ID of the appointment document.
 * @property {string} barberId - The ID of the barber for this appointment.
 * @property {string} barberName - The name of the barber.
 * @property {string | null} [customerId] - The ID of the customer (null for walk-ins).
 * @property {string} customerName - The name of the customer.
 * @property {string} serviceId - The ID of the service booked.
 * @property {string} serviceName - The name of the service.
 * @property {number} price - The price of the service at the time of booking.
 * @property {string} date - The date of the appointment in YYYY-MM-DD format.
 * @property {string} startTime - The scheduled start time (e.g., "10:00 AM").
 * @property {string} endTime - The originally estimated end time (e.g., "10:30 AM").
 * @property {Timestamp | null} appointmentTimestamp - Firestore Timestamp representing the exact start date and time (UTC).
 * @property {AppointmentStatus} status - The current status of the appointment.
 * @property {Timestamp} [createdAt] - Timestamp of when the appointment was created.
 * @property {Timestamp} [updatedAt] - Timestamp of when the appointment was last updated.
 * @property {Timestamp | null} [customerCheckedInAt] - Timestamp of when the customer checked in.
 * @property {Timestamp | null} [barberCheckedInAt] - Timestamp of when the barber acknowledged customer arrival or checked them in.
 * @property {Timestamp | null} [serviceActuallyStartedAt] - Timestamp of when the service actually began.
 * @property {Timestamp | null} [customerMarkedDoneAt] - Timestamp of when the customer marked the service as done.
 * @property {Timestamp | null} [barberMarkedDoneAt] - Timestamp of when the barber marked the service as done.
 * @property {Timestamp | null} [serviceActuallyCompletedAt] - Timestamp of when the service was mutually confirmed as completed.
 * @property {Timestamp | null} [noShowMarkedAt] - Timestamp of when the appointment was marked as a no-show.
 */
export interface Appointment {
  id:string;
  barberId: string;
  barberName: string;
  customerId?: string | null; // Null for walk-ins
  customerName: string;
  serviceId: string;
  serviceName: string;
  price: number;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g., "10:00 AM"
  endTime: string; // Original estimated end time, e.g., "10:30 AM"
  appointmentTimestamp: Timestamp | null; // Firestore Timestamp for exact date/time, crucial for queries & time-sensitive logic
  status: AppointmentStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  // Timestamps for tracking appointment flow
  customerCheckedInAt?: Timestamp | null;
  barberCheckedInAt?: Timestamp | null;
  serviceActuallyStartedAt?: Timestamp | null; // When both confirm check-in or barber starts walk-in
  customerMarkedDoneAt?: Timestamp | null;
  barberMarkedDoneAt?: Timestamp | null;
  serviceActuallyCompletedAt?: Timestamp | null; // When both confirm completion
  noShowMarkedAt?: Timestamp | null;
}

/**
 * Defines the structure for an unavailable date entry for a barber.
 * @interface UnavailableDate
 * @property {string} id - The unique ID of the unavailable date entry (typically the date string itself).
 * @property {string} barberId - The ID of the barber this entry belongs to.
 * @property {string} date - The date that is unavailable, in YYYY-MM-DD format.
 * @property {string} [reason] - An optional reason for the unavailability.
 * @property {Timestamp} [createdAt] - Timestamp of when this entry was created.
 */
export interface UnavailableDate {
  id: string; // Usually the date string YYYY-MM-DD for simplicity if date is unique per barber.
  barberId: string;
  date: string; // YYYY-MM-DD
  reason?: string;
  createdAt?: Timestamp;
}

/**
 * Defines the structure for a spending entry made by a barber.
 * @interface SpendingEntry
 * @property {string} id - The unique ID of the spending entry document.
 * @property {string} barberId - The ID of the barber who made this spending entry.
 * @property {string} date - The date of the spending, in YYYY-MM-DD format.
 * @property {string} description - A description of the spending.
 * @property {number} amount - The amount spent.
 * @property {Timestamp} createdAt - Timestamp of when this entry was created.
 */
export interface SpendingEntry {
  id: string;
  barberId: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  createdAt: Timestamp;
}
