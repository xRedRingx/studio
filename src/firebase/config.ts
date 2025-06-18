/**
 * @fileoverview Firebase Configuration and Initialization.
 * This file initializes the Firebase app with the project's configuration settings.
 * It exports instances of Firebase services like Authentication, Firestore, and Messaging
 * for use throughout the application.
 * Firestore is configured with persistent local cache for offline capabilities.
 */
import { initializeApp, getApps, getApp } from 'firebase/app'; // Core Firebase app initialization.
import { getAuth } from 'firebase/auth'; // Firebase Authentication service.
// Firestore services: initializeFirestore for settings, getFirestore for the instance.
import { initializeFirestore, CACHE_SIZE_UNLIMITED, memoryLocalCache, persistentLocalCache } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging'; // Firebase Cloud Messaging service.
// Firebase Storage is no longer used actively in this version of the app.
// import { getStorage } from 'firebase/storage';

// Firebase project configuration object.
// These values are specific to your Firebase project and can be found in the Firebase console.
const firebaseConfig = {
  apiKey: "AIzaSyAuK2VB18SED5t94WfUkHwyKk9mkBWKaDg",
  authDomain: "queueflow-af838.firebaseapp.com",
  projectId: "queueflow-af838",
  storageBucket: "queueflow-af838.appspot.com",
  messagingSenderId: "651130356443",
  appId: "1:651130356443:web:e305899614ceb29d14c2fe",
  measurementId: "G-W7NHKX5MVH" // For Google Analytics for Firebase.
};

// Initialize Firebase App.
// Checks if an app is already initialized to prevent re-initialization (important for Next.js HMR).
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Authentication and get a reference to the service.
const auth = getAuth(app);

// Initialize Firebase Firestore with persistent local cache.
// This allows the app to work offline to some extent by caching Firestore data locally.
// `CACHE_SIZE_UNLIMITED` allows the cache to grow as needed (consider implications for disk space).
const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
  // Alternatively, for a memory-only cache (cleared on session end):
  // localCache: memoryLocalCache(),
});

// Initialize Firebase Cloud Messaging.
// Checks if running in a browser environment that supports service workers, as FCM relies on them.
const messaging = (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator)
  ? getMessaging(app) // Initialize messaging if supported.
  : null; // Set to null if not supported (e.g., during server-side rendering or in unsupported browsers).

// Firebase Storage is no longer initialized here as it's not actively used
// for features like profile picture uploads in this version of the app.
// const storage = getStorage(app);

// Export the initialized Firebase services for use in other parts of the application.
export { app, auth, firestore, messaging }; // `storage` removed from exports.
