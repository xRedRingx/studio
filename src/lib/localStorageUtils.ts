/**
 * @fileoverview Local Storage Utilities.
 * This file provides helper functions for interacting with browser `localStorage`.
 * It includes functions for getting and setting items, with specific utilities
 * for handling Firestore Timestamps by converting them to/from ISO strings
 * during serialization and deserialization.
 * It also defines constants for various local storage keys used across the application.
 */
'use client'; // Indicates this module is client-side, relevant for Next.js App Router.

// Import Timestamp conversion utilities.
import { convertTimestampsInObjectToISO, convertISOStringsInObjectToTimestamps } from './firestoreUtils';

// --- Local Storage Keys ---
// These constants define the keys used for storing specific pieces of data in local storage.
// Using constants helps avoid typos and makes it easier to manage keys.

// Key for caching unavailable dates on the barber's availability page.
export const LS_UNAVAILABLE_DATES_KEY = 'barber_availability_page_unavailable_dates';
// Key for caching the barber's work schedule on the schedule page.
export const LS_SCHEDULE_KEY = 'barber_schedule_page_schedule';
// Key for caching services on the barber's "Manage Services" page.
export const LS_SERVICES_KEY_BARBER_SERVICES_PAGE = 'barber_services_page_services';
// Key for caching services specifically for the barber's dashboard (might be a subset or different view).
export const LS_SERVICES_KEY_DASHBOARD = 'barber_dashboard_services';
// Key for caching appointments for the barber's dashboard.
export const LS_APPOINTMENTS_KEY_DASHBOARD = 'barber_dashboard_appointments';
// Key for caching the customer's own appointments on their dashboard.
export const LS_MY_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD = 'customer_dashboard_my_appointments';
// Key for caching the list of available barbers on the customer's dashboard.
export const LS_AVAILABLE_BARBERS_KEY_CUSTOMER_DASHBOARD = 'customer_dashboard_available_barbers';

/**
 * Retrieves an item from localStorage and revives ISO date strings within it to Firestore Timestamps.
 * This is useful for data that was originally fetched from Firestore and cached.
 *
 * @template T - The expected type of the retrieved item.
 * @param {string} key - The key of the item to retrieve from localStorage.
 * @returns {T | null} The retrieved and revived item, or `null` if the item is not found,
 *                     localStorage is unavailable, or an error occurs during parsing/revival.
 */
export const getItemWithTimestampRevival = <T>(key: string): T | null => {
  // Check if window (and thus localStorage) is available (for SSR or non-browser environments).
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const serializedState = localStorage.getItem(key);
    if (serializedState === null) { // Item not found in localStorage.
      return null;
    }
    // Parse the JSON string.
    const parsedState = JSON.parse(serializedState);
    // Convert ISO strings back to Timestamps.
    return convertISOStringsInObjectToTimestamps(parsedState) as T;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return null; // Return null on error.
  }
};

/**
 * Sets an item in localStorage, first converting any Firestore Timestamps within the value to ISO date strings.
 * This prepares Firestore-originated data for safe JSON serialization.
 *
 * @param {string} key - The key of the item to set in localStorage.
 * @param {any} value - The value to set. Firestore Timestamps within this value will be converted.
 */
export const setItemWithTimestampConversion = (key: string, value: any): void => {
  if (typeof window === 'undefined') { // Check for localStorage availability.
    return;
  }
  try {
    // Convert Timestamps to ISO strings before JSON stringification.
    const valueWithConvertedTimestamps = convertTimestampsInObjectToISO(value);
    const serializedState = JSON.stringify(valueWithConvertedTimestamps);
    localStorage.setItem(key, serializedState);
  } catch (error) {
    console.warn(`Error setting localStorage key "${key}":`, error);
  }
};

/**
 * Retrieves a simple item from localStorage without any special Timestamp revival.
 * Useful for data that doesn't contain Firestore Timestamps or where such conversion isn't needed.
 *
 * @template T - The expected type of the retrieved item.
 * @param {string} key - The key of the item to retrieve.
 * @returns {T | null} The retrieved item, or `null` if not found, localStorage is unavailable, or an error occurs.
 */
export const getSimpleItem = <T>(key: string): T | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const serializedState = localStorage.getItem(key);
    if (serializedState === null) {
      return null;
    }
    return JSON.parse(serializedState) as T;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return null;
  }
};

/**
 * Sets a simple item in localStorage without any special Timestamp conversion.
 *
 * @param {string} key - The key of the item to set.
 * @param {any} value - The value to set.
 */
export const setSimpleItem = (key: string, value: any): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const serializedState = JSON.stringify(value);
    localStorage.setItem(key, serializedState);
  } catch (error) {
    console.warn(`Error setting localStorage key "${key}":`, error);
  }
};
