/**
 * @fileoverview Application-wide constants.
 * This file defines constants used throughout the BarberFlow application,
 * such as keys for local storage items and the application name.
 */

// Key used for storing the user's selected role (customer/barber) in local storage.
// This helps persist the role choice across sessions or after logout.
export const LOCAL_STORAGE_ROLE_KEY = 'barberflow_user_role';

// Key used for storing the authenticated user's session data (AppUser object) in local storage.
// This can help in quickly rehydrating user state on page loads, though Firestore listeners
// are the primary source of truth for real-time user data.
export const LOCAL_STORAGE_USER_KEY = 'barberflow_user_session';

// The official name of the application.
export const APP_NAME = 'BarberFlow';
