
'use client';

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './config'; // Your Firebase config file where `storage` is initialized

/**
 * Uploads a profile image to Firebase Storage and returns its download URL.
 * @param userId The ID of the user.
 * @param file The image file to upload.
 * @returns A promise that resolves with the download URL of the uploaded image.
 */
export const uploadProfileImage = async (userId: string, file: File): Promise<string> => {
  if (!userId || !file) {
    throw new Error('User ID and file are required for upload.');
  }

  // Create a storage reference: e.g., profile_pictures/userId/filename.jpg
  const filePath = `profile_pictures/${userId}/${Date.now()}_${file.name}`; // Add timestamp to avoid overwrites with same name
  const storageRef = ref(storage, filePath);

  try {
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile image:', error);
    // Better to throw a more specific error or handle it appropriately
    throw new Error('Failed to upload image. Please try again.');
  }
};
