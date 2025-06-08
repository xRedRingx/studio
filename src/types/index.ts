
import type { User as FirebaseUserAuth } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'customer' | 'barber';

export interface FirebaseUser extends FirebaseUserAuth {}

// AppUser for phone + OTP authentication.
export interface AppUser extends FirebaseUser {
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phoneNumber: string;
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
  id: string; // Firestore document ID
  barberId: string; // ID of the barber
  // customerId?: string; // Optional: ID of the customer who booked
  customerName: string;
  serviceName: string;
  startTime: string; // e.g., "10:00 AM"
  endTime: string; // e.g., "10:30 AM"
  status: 'upcoming' | 'checked-in' | 'completed' | 'next';
  date: string; // YYYY-MM-DD
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
