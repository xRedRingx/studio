/**
 * @fileoverview Firestore data conversion utilities.
 * This file provides helper functions to convert Firestore Timestamps to ISO strings
 * for serialization (e.g., storing in local storage) and to convert ISO strings
 * back to Timestamps when deserializing or preparing data for Firestore.
 */
'use client'; // Indicates this module is client-side, relevant for Next.js App Router.

import { Timestamp } from 'firebase/firestore'; // Firestore Timestamp type.

/**
 * Recursively converts Firestore Timestamps within an object or array to ISO 8601 date strings.
 * This is useful for serializing data that contains Timestamps, for example, when storing
 * Firestore documents in local storage or sending them over a network where Timestamps
 * might not be directly supported or desired.
 *
 * @param {any} data - The data to process (can be an object, array, Timestamp, or primitive).
 * @returns {any} The data with all Firestore Timestamps converted to ISO strings.
 *                If the input is not an object, array, or Timestamp, it's returned as is.
 */
export const convertTimestampsInObjectToISO = (data: any): any => {
  // Base cases: if data is null or not an object, return it directly.
  if (data === null || typeof data !== 'object') {
    return data;
  }
  // If data is a Firestore Timestamp, convert it to an ISO string.
  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }
  // If data is an array, recursively process each element.
  if (Array.isArray(data)) {
    return data.map(convertTimestampsInObjectToISO);
  }
  // If data is an object, create a new object and recursively process each property.
  const newData: { [key: string]: any } = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      newData[key] = convertTimestampsInObjectToISO(data[key]);
    }
  }
  return newData;
};

/**
 * Recursively converts ISO 8601 date strings within an object or array back to Firestore Timestamps.
 * This is useful when deserializing data (e.g., from local storage) that was previously
 * processed by `convertTimestampsInObjectToISO`, or when preparing data from external sources
 * for storage in Firestore.
 *
 * @param {any} data - The data to process (can be an object, array, string, or primitive).
 * @returns {any} The data with recognized ISO date strings converted to Firestore Timestamps.
 *                If a string is not a valid ISO date string, or if the input is not an
 *                object, array, or string, it's returned as is.
 */
export const convertISOStringsInObjectToTimestamps = (data: any): any => {
  // Base cases: if data is null or not an object or array, check if it's a potential ISO string.
  if (data === null || typeof data !== 'object') {
    // Check if the string matches a common ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ).
    // This regex is a basic check and might not cover all valid ISO formats.
    if (typeof data === 'string' && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z/.test(data)) {
      try {
        const dateObj = new Date(data);
        // Additional check to ensure the parsed date is valid (Date constructor can be lenient).
        if (!isNaN(dateObj.getTime())) {
            return Timestamp.fromDate(dateObj); // Convert valid Date object to Firestore Timestamp.
        }
      } catch (e) {
        // If parsing fails (e.g., invalid date string format), ignore and return original data.
      }
    }
    return data; // Return data as is if not a recognized ISO string or not a string.
  }
  // If data is an array, recursively process each element.
  if (Array.isArray(data)) {
    return data.map(convertISOStringsInObjectToTimestamps);
  }
  // If data is an object, create a new object and recursively process each property.
  const newData: { [key: string]: any } = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      newData[key] = convertISOStringsInObjectToTimestamps(data[key]);
    }
  }
  return newData;
};
