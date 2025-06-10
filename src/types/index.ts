
import type { User as FirebaseUserAuth } from 'firebase/auth'; // Keep for potential other Firebase interactions if any
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'customer' | 'barber';

// This interface might still be useful for other Firebase services, but not primary auth.
export interface FirebaseUser extends FirebaseUserAuth {}

// AppUser will now represent the user data stored in Firestore, including the password (for prototype).
export interface AppUser {
  uid: string; // Document ID in Firestore, can be auto-generated or derived
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  phoneNumber: string;
  password?: string; // Storing password directly for prototype - NOT SECURE FOR PRODUCTION
  email?: string | null; // Optional: if you decide to collect it later
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  // Remove Firebase Auth specific fields if they are no longer sourced from there
  // e.g., photoURL, displayName (if not explicitly set from our fields)
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
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
  customerId: string; // ID of the customer who booked
  customerName: string;
  serviceId: string; // ID of the service
  serviceName: string;
  price: number;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g., "10:00 AM"
  endTime: string; // e.g., "10:30 AM"
  status: 'upcoming' | 'checked-in' | 'completed' | 'next';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
