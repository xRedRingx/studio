
// config.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, CACHE_SIZE_UNLIMITED, memoryLocalCache, persistentLocalCache } from 'firebase/firestore'; // Import cache options


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
// Using persistentLocalCache for web, with memoryLocalCache as a fallback if persistence isn't available.
// CACHE_SIZE_UNLIMITED allows the cache to grow as needed.
const firestore = getFirestore(app, {
  localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
  // Or for in-memory only:
  // localCache: memoryLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED })
});


export { app, auth, firestore };
