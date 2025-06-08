
import type { User as FirebaseUserAuth } from 'firebase/auth';

export type UserRole = 'customer' | 'barber';

export interface FirebaseUser extends FirebaseUserAuth {}

// AppUser now primarily uses phoneNumber for identification in forms,
// but for Firebase email/password auth, phoneNumber will be passed as 'email'.
// Password is handled by Firebase, not stored directly in AppUser fields after auth.
export interface AppUser extends FirebaseUser {
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  // Email is optional and generally not used for login in this setup
  email?: string | null; 
  // This phoneNumber from the form will be used as the 'email' for Firebase auth
  phoneNumber: string; 
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
