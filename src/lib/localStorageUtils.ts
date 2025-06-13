
'use client';

import { convertTimestampsInObjectToISO, convertISOStringsInObjectToTimestamps } from './firestoreUtils';

// Local Storage Keys
export const LS_UNAVAILABLE_DATES_KEY = 'barber_availability_page_unavailable_dates';
export const LS_SCHEDULE_KEY = 'barber_schedule_page_schedule';
export const LS_SERVICES_KEY_BARBER_SERVICES_PAGE = 'barber_services_page_services'; // Renamed for clarity
export const LS_SERVICES_KEY_DASHBOARD = 'barber_dashboard_services';
export const LS_APPOINTMENTS_KEY_DASHBOARD = 'barber_dashboard_appointments';
export const LS_MY_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD = 'customer_dashboard_my_appointments';
export const LS_AVAILABLE_BARBERS_KEY_CUSTOMER_DASHBOARD = 'customer_dashboard_available_barbers';


/**
 * Retrieves an item from localStorage and revives ISO date strings to Timestamps.
 * @param key The key of the item to retrieve.
 * @returns The retrieved item with Timestamps, or null if not found or error.
 */
export const getItemWithTimestampRevival = <T>(key: string): T | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const serializedState = localStorage.getItem(key);
    if (serializedState === null) {
      return null;
    }
    // No need to pass reviver to JSON.parse, as convertISOStringsInObjectToTimestamps will be called on the parsed object.
    const parsedState = JSON.parse(serializedState);
    return convertISOStringsInObjectToTimestamps(parsedState) as T;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return null;
  }
};

/**
 * Sets an item in localStorage, converting Timestamps to ISO date strings.
 * @param key The key of the item to set.
 * @param value The value to set.
 */
export const setItemWithTimestampConversion = (key: string, value: any): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    // Convert Timestamps before stringifying
    const valueWithConvertedTimestamps = convertTimestampsInObjectToISO(value);
    const serializedState = JSON.stringify(valueWithConvertedTimestamps);
    localStorage.setItem(key, serializedState);
  } catch (error) {
    console.warn(`Error setting localStorage key "${key}":`, error);
  }
};

/**
 * Retrieves a simple item from localStorage without special revival.
 * @param key The key of the item to retrieve.
 * @returns The retrieved item, or null if not found or error.
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
 * Sets a simple item in localStorage without special conversion.
 * @param key The key of the item to set.
 * @param value The value to set.
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
