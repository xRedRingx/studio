
import type { User as FirebaseUserAuth } from 'firebase/auth';

export type UserRole = 'customer' | 'barber';

export interface FirebaseUser extends FirebaseUserAuth {}

// AppUser for phone + OTP authentication.
// Password is not stored in the AppUser model as it's handled by OTP.
export interface AppUser extends FirebaseUser {
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  email?: string | null; // Optional actual email
  phoneNumber: string; // Primary identifier for login
}

export interface BarberService {
  id: string;
  name: string;
  price: number;
  duration: number; // in minutes
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface DayAvailability {
  day: DayOfWeek;
  isOpen: boolean;
  startTime: string; // e.g., "09:00 AM"
  endTime: string;   // e.g., "05:00 PM"
}

export interface Appointment {
  id: string;
  customerName: string;
  serviceName: string;
  startTime: string; // e.g., "10:00 AM"
  endTime: string; // e.g., "10:30 AM"
  status: 'upcoming' | 'checked-in' | 'completed' | 'next';
  date: string; // YYYY-MM-DD
}

