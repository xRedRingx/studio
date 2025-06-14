
import type { User as FirebaseUserAuth } from 'firebase/auth'; // Keep for potential other Firebase interactions if any
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'customer' | 'barber';

// This interface might still be useful for other Firebase services, but not primary auth.
export interface FirebaseUser extends FirebaseUserAuth {}

// AppUser will now represent the user data stored in Firestore.
// Firebase Auth will manage the core user identity (uid, email, emailVerified, displayName from Firebase profile).
export interface AppUser {
  uid: string; // Firebase Auth UID
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  email: string; // Primary identifier from Firebase Auth
  phoneNumber?: string | null; // Optional, stored in Firestore
  address?: string | null; // New: Barber's physical address
  isAcceptingBookings?: boolean; // New: For barbers to toggle online booking visibility
  fcmToken?: string | null; // FCM registration token
  createdAt?: Timestamp; // Firestore timestamp
  updatedAt?: Timestamp; // Firestore timestamp
  // Fields from Firebase Auth user object that we might merge for convenience
  displayName?: string | null; // Firebase Auth display name
  // photoURL is removed
  emailVerified?: boolean; // Firebase Auth email verification status
}

export interface BarberService {
  id: string; // Firestore document ID
  barberId: string; // ID of the barber who offers this service
  name: string;
  price: number;
  duration: number; // in minutes
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface DayAvailability {
  day: DayOfWeek;
  isOpen: boolean;
  startTime: string; // e.g., "09:00 AM"
  endTime: string;   // e.g., "05:00 PM"
}

// This will be the structure stored in Firestore for a barber's schedule
export interface BarberScheduleDoc {
  barberId: string;
  schedule: DayAvailability[];
  updatedAt?: Timestamp;
}

export interface Appointment {
  id:string; // Firestore document ID
  barberId: string; // ID of the barber
  barberName: string; // Name of the barber
  customerId?: string | null; // ID of the customer who booked, optional for walk-ins
  customerName: string; // Name of the customer (could be from AppUser or entered for walk-in)
  serviceId: string; // ID of the service
  serviceName: string;
  price: number;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g., "10:00 AM"
  endTime: string; // e.g., "10:30 AM"
  status: 'upcoming' | 'checked-in' | 'completed' | 'next' | 'cancelled';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UnavailableDate {
  id: string; // Firestore document ID, typically the date string 'YYYY-MM-DD'
  barberId: string; // ID of the barber
  date: string; // YYYY-MM-DD format
  reason?: string; // Optional reason
  createdAt?: Timestamp;
}
