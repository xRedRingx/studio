
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// import { getMessaging } from 'firebase/messaging'; // For FCM

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAuK2VB18SED5t94WfUkHwyKk9mkBWKaDg",
  authDomain: "queueflow-af838.firebaseapp.com",
  projectId: "queueflow-af838",
  storageBucket: "queueflow-af838.firebasestorage.app",
  messagingSenderId: "651130356443",
  appId: "1:651130356443:web:e305899614ceb29d14c2fe",
  measurementId: "G-W7NHKX5MVH"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const firestore = getFirestore(app);
// const messaging = typeof window !== 'undefined' ? getMessaging(app) : null; // For FCM

export { app, auth, firestore };
