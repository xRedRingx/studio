
'use client';

import { Timestamp } from 'firebase/firestore';

/**
 * Recursively converts Firestore Timestamps within an object or array to ISO strings.
 * @param data The data to process.
 * @returns The data with Timestamps converted to ISO strings.
 */
export const convertTimestampsInObjectToISO = (data: any): any => {
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(convertTimestampsInObjectToISO);
  }
  const newData: { [key: string]: any } = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      newData[key] = convertTimestampsInObjectToISO(data[key]);
    }
  }
  return newData;
};

/**
 * Recursively converts ISO date strings within an object or array back to Firestore Timestamps.
 * @param data The data to process.
 * @returns The data with ISO strings converted to Timestamps where applicable.
 */
export const convertISOStringsInObjectToTimestamps = (data: any): any => {
  if (data === null || typeof data !== 'object') {
    // Check if the string matches the ISO format we expect (YYYY-MM-DDTHH:mm:ss.sssZ)
    if (typeof data === 'string' && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z/.test(data)) {
      try {
        const dateObj = new Date(data);
        // Additional check to ensure it's a valid date, as new Date can parse some invalid strings loosely
        if (!isNaN(dateObj.getTime())) {
            return Timestamp.fromDate(dateObj);
        }
      } catch (e) {
        // Ignore and return original data if parsing fails
      }
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(convertISOStringsInObjectToTimestamps);
  }
  const newData: { [key: string]: any } = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      newData[key] = convertISOStringsInObjectToTimestamps(data[key]);
    }
  }
  return newData;
};

