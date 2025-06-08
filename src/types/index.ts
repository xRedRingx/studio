import type { User as FirebaseUserAuth } from 'firebase/auth';

export type UserRole = 'customer' | 'barber';

export interface FirebaseUser extends FirebaseUserAuth {}

export interface AppUser extends FirebaseUser {
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}
