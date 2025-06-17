
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
  fcmToken?: string | null;
  averageRating?: number; // New: Average rating for barbers
  ratingCount?: number; // New: Total number of ratings for barbers
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
  | 'cancelled';

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
  appointmentTimestamp: Timestamp | null;
  status: AppointmentStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  customerCheckedInAt?: Timestamp | null;
  barberCheckedInAt?: Timestamp | null;
  serviceActuallyStartedAt?: Timestamp | null;
  customerMarkedDoneAt?: Timestamp | null;
  barberMarkedDoneAt?: Timestamp | null;
  serviceActuallyCompletedAt?: Timestamp | null;
  customerRating?: number | null; // New: Rating given by customer for this appointment (1-5)
  ratingComment?: string | null; // New: Optional comment from customer
}

export interface UnavailableDate {
  id: string;
  barberId: string;
  date: string;
  reason?: string;
  createdAt?: Timestamp;
}

// New: Rating interface (can be expanded later if we store ratings in a separate collection)
export interface Rating {
  id: string; // Or appointmentId if it's 1-to-1 with appointment
  barberId: string;
  customerId: string;
  appointmentId: string;
  score: number; // 1-5
  comment?: string;
  createdAt: Timestamp;
}
