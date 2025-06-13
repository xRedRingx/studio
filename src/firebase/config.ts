
// config.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// Import initializeFirestore for settings, and also getFirestore if it's needed elsewhere without re-init
import { initializeFirestore, CACHE_SIZE_UNLIMITED, memoryLocalCache, persistentLocalCache } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging'; // Added


const firebaseConfig = {
  apiKey: "AIzaSyAuK2VB18SED5t94WfUkHwyKk9mkBWKaDg",
  authDomain: "queueflow-af838.firebaseapp.com",
  projectId: "queueflow-af838",
  storageBucket: "queueflow-af838.appspot.com",
  messagingSenderId: "651130356443",
  appId: "1:651130356443:web:e305899614ceb29d14c2fe",
  measurementId: "G-W7NHKX5MVH"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Initialize Firestore with local cache settings
// Using initializeFirestore to apply settings correctly.
const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
  // Or for in-memory only:
  // localCache: memoryLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED })
});

// Initialize Firebase Messaging
const messaging = (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator)
  ? getMessaging(app)
  : null;


export { app, auth, firestore, messaging };

