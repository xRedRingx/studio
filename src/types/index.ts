
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
  bio?: string | null;
  specialties?: string[] | null;
  isAcceptingBookings?: boolean;
  isTemporarilyUnavailable?: boolean; // New: Tracks if barber is currently busy
  unavailableSince?: Timestamp | null; // New: Timestamp for when barber became busy
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
  | 'upcoming'
  | 'customer-initiated-check-in'
  | 'barber-initiated-check-in'
  | 'in-progress'
  | 'customer-initiated-completion'
  | 'barber-initiated-completion'
  | 'completed'
  | 'cancelled'
  | 'no-show';

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
  startTime: string; // e.g., "10:00 AM" - This will be updated if shifted
  endTime: string; // Original estimated end time, e.g., "10:30 AM" - This will be updated
  appointmentTimestamp: Timestamp | null; // This will be updated if shifted
  status: AppointmentStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  customerCheckedInAt?: Timestamp | null;
  barberCheckedInAt?: Timestamp | null;
  serviceActuallyStartedAt?: Timestamp | null;
  customerMarkedDoneAt?: Timestamp | null;
  barberMarkedDoneAt?: Timestamp | null;
  serviceActuallyCompletedAt?: Timestamp | null;
  noShowMarkedAt?: Timestamp | null;
}

export interface UnavailableDate {
  id: string;
  barberId: string;
  date: string;
  reason?: string;
  createdAt?: Timestamp;
}
