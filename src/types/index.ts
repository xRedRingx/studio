
import type { User as FirebaseUserAuth } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'customer' | 'barber';

export interface FirebaseUser extends FirebaseUserAuth {}

export interface AppUser {
  uid: string;
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  email: string;
  phoneNumber?: string | null;
  address?: string | null;
  isAcceptingBookings?: boolean;
  fcmToken?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  displayName?: string | null;
  emailVerified?: boolean;
}

export interface BarberService {
  id: string;
  barberId: string;
  name: string;
  price: number;
  duration: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface DayAvailability {
  day: DayOfWeek;
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

export interface BarberScheduleDoc {
  barberId: string;
  schedule: DayAvailability[];
  updatedAt?: Timestamp;
}

export type AppointmentStatus =
  | 'upcoming' // Initial state
  | 'customer-initiated-check-in' // Customer clicked check-in
  | 'barber-initiated-check-in'   // Barber recorded customer arrival / Walk-in initial
  | 'in-progress'                 // Both customer and barber confirmed check-in / Service started
  | 'customer-initiated-completion'// Customer clicked mark done
  | 'barber-initiated-completion'  // Barber clicked mark done
  | 'completed'                   // Both confirmed service is done
  | 'cancelled';                  // Appointment cancelled

export interface Appointment {
  id:string;
  barberId: string;
  barberName: string;
  customerId?: string | null;
  customerName: string;
  serviceId: string;
  serviceName: string;
  price: number;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g., "10:00 AM"
  endTime: string; // Original estimated end time, e.g., "10:30 AM"
  appointmentTimestamp: Timestamp | null; // New field for combined date/time
  status: AppointmentStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;

  // New fields for mutual check-in/out
  customerCheckedInAt?: Timestamp | null;
  barberCheckedInAt?: Timestamp | null;
  serviceActuallyStartedAt?: Timestamp | null; // When status becomes 'in-progress'
  customerMarkedDoneAt?: Timestamp | null;
  barberMarkedDoneAt?: Timestamp | null;
  serviceActuallyCompletedAt?: Timestamp | null; // When status becomes 'completed'
}

export interface UnavailableDate {
  id: string;
  barberId: string;
  date: string;
  reason?: string;
  createdAt?: Timestamp;
}

