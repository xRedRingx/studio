
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  // createUserWithEmailAndPassword, // Removed
  // signInWithEmailAndPassword, // Removed
  signOut as firebaseSignOut,
  // sendPasswordResetEmail as firebaseSendPasswordResetEmail, // Removed
  type UserCredential, // Still useful for type structure, though not directly from phone auth
  type AuthError,
  // For Phone Auth (actual implementation would need these)
  // RecaptchaVerifier, 
  // signInWithPhoneNumber 
} from 'firebase/auth';
import { auth, firestore } from '@/firebase/config';
import type { AppUser, UserRole, FirebaseUser } from '@/types';
import { LOCAL_STORAGE_ROLE_KEY } from '@/lib/constants';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: AppUser | null;
  role: UserRole | null;
  loadingAuth: boolean;
  initialRoleChecked: boolean;
  setRole: (role: UserRole) => void;
  // Updated signatures for signUp and signIn
  signUp: (data: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email?: string; // Optional
    role: UserRole;
  }) => Promise<void>; // Simplified return for simulation
  signIn: (phoneNumber: string) => Promise<void>; // Simplified return for simulation
  signOut: () => Promise<void>;
  // sendPasswordResetEmail is removed
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [initialRoleChecked, setInitialRoleChecked] = useState(false);

  // Placeholder for RecaptchaVerifier if we were fully implementing
  // useEffect(() => {
  //   if (typeof window !== 'undefined' && !window.recaptchaVerifier) {
  //     window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { // 'recaptcha-container' is an example ID
  //       'size': 'invisible',
  //       'callback': (response: any) => {
  //         // reCAPTCHA solved, allow signInWithPhoneNumber.
  //       }
  //     });
  //   }
  // }, []);


  useEffect(() => {
    const storedRole = localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) as UserRole | null;
    if (storedRole) {
      setRoleState(storedRole);
    }
    setInitialRoleChecked(true);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userDocRef = doc(firestore, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const appUserData = userDocSnap.data() as Omit<AppUser, keyof FirebaseUser>;
          const appUser: AppUser = {
            ...firebaseUser,
            ...appUserData,
            phoneNumber: appUserData.phoneNumber || firebaseUser.phoneNumber || '', // Ensure phoneNumber is present
          };
          setUser(appUser);
          if (appUser.role && !role) {
             setRoleContextAndStorage(appUser.role);
          }
        } else {
           // This case might happen if user was created with phone auth but doc not yet written
           // or if user data is missing. For simulation, we'll assume some defaults.
          const simulatedAppUser: AppUser = {
            ...firebaseUser,
            phoneNumber: firebaseUser.phoneNumber || 'UNKNOWN_PHONE', // Fallback
            role: role || undefined, // Use existing role if available
          };
          setUser(simulatedAppUser);
        }
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [role]);

  const setRoleContextAndStorage = (newRole: UserRole) => {
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, newRole);
    setRoleState(newRole);
  };
  
  const signUp = async (data: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email?: string;
    role: UserRole;
  }) => {
    const { firstName, lastName, phoneNumber, email, role: userRole } = data;
    console.log("Attempting sign up with phone:", phoneNumber);
    // --- START Firebase Phone Auth Simulation ---
    // In a real app, this is where you would initiate phone auth:
    // 1. Setup RecaptchaVerifier
    // 2. Call signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier)
    // 3. This returns a confirmationResult object.
    // 4. Prompt user for OTP and call confirmationResult.confirm(otp)
    // For this prototype, we'll simulate a successful sign-up.
    
    // Simulate a Firebase user object.
    const simulatedFirebaseUser: FirebaseUser = {
      uid: `simulated_${Date.now()}`, // Unique ID for simulation
      providerId: 'phone',
      phoneNumber: phoneNumber,
      displayName: `${firstName} ${lastName}`,
      email: email || null, // Email is optional
      emailVerified: false, // Not relevant for phone
      isAnonymous: false,
      metadata: {}, // empty for simulation
      providerData: [], // empty for simulation
      refreshToken: 'simulated_token',
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => 'simulated_id_token',
      getIdTokenResult: async () => ({ token: 'simulated_id_token', claims: {}, expirationTime: '', issuedAtTime: '', signInProvider: null, signInSecondFactor: null}),
      reload: async () => {},
      toJSON: () => ({}),
      photoURL: null,
    };

    await setDoc(doc(firestore, "users", simulatedFirebaseUser.uid), {
      uid: simulatedFirebaseUser.uid,
      phoneNumber: phoneNumber,
      email: email || null,
      role: userRole,
      firstName,
      lastName,
      createdAt: new Date().toISOString(),
    });
    setRoleContextAndStorage(userRole);
    setUser({ ...simulatedFirebaseUser, role: userRole, firstName, lastName, email: email || undefined } as AppUser);
    console.log("Simulated sign up successful for:", phoneNumber);
    // --- END Firebase Phone Auth Simulation ---
    // Actual UserCredential is not returned in this simulation
  };

  const signIn = async (phoneNumber: string) => {
    console.log("Attempting sign in with phone:", phoneNumber);
    // --- START Firebase Phone Auth Simulation ---
    // Similar to signUp, this would involve OTP flow.
    // We'll simulate finding an existing user.
    // In a real scenario, after OTP verification, onAuthStateChanged would trigger.
    // For simulation, we'll try to construct a user object if one might exist in Firestore (though we don't query here for simplicity).
    
    const simulatedFirebaseUser: FirebaseUser = { // A generic simulated user for login
      uid: `simulated_login_${Date.now()}`,
      providerId: 'phone',
      phoneNumber: phoneNumber,
      displayName: "Simulated User", // In real app, fetch this
      email: null,
      emailVerified: false,
      isAnonymous: false,
      metadata: {},
      providerData: [],
      refreshToken: 'simulated_token',
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => 'simulated_id_token',
      getIdTokenResult: async () => ({ token: 'simulated_id_token', claims: {}, expirationTime: '', issuedAtTime: '', signInProvider: null, signInSecondFactor: null}),
      reload: async () => {},
      toJSON: () => ({}),
      photoURL: null,
    };
    // For simulation, directly set user. In real app, onAuthStateChanged handles this after OTP.
    // We assume a role is already stored or can be fetched.
    const userDocRef = doc(firestore, "users", simulatedFirebaseUser.uid); // This UID is fake, just for demo
    const userDocSnap = await getDoc(userDocRef); // This will likely not exist, fine for demo
    
    if (userDocSnap.exists()) {
       setUser({ ...simulatedFirebaseUser, ...(userDocSnap.data() as AppUser) });
    } else {
      // If no user doc found, create a minimal user object for the session
      // This part is highly dependent on how you'd want to handle "login" for a new phone number in a real app without prior signup simulation
      const tempAppUser: AppUser = {
        ...simulatedFirebaseUser,
        phoneNumber: phoneNumber, // ensure phone number is set
        role: role || undefined, // use existing role or undefined
        firstName: "User", // Placeholder
        lastName: "", // Placeholder
      }
      setUser(tempAppUser);
    }
    console.log("Simulated sign in successful for:", phoneNumber);
    // --- END Firebase Phone Auth Simulation ---
  };

  const signOut = () => {
    // Real Firebase sign out
    return firebaseSignOut(auth).then(() => {
      setUser(null); // Clear local user state
      // Role is kept in localStorage by default as per current logic
    });
  };

  // sendPasswordResetEmail is removed

  return (
    <AuthContext.Provider value={{ user, role, loadingAuth, initialRoleChecked, setRole: setRoleContextAndStorage, signUp, signIn, signOut }}>
      {children}
      {/* Add a visible reCAPTCHA container if not using invisible reCAPTCHA. Required for phone auth. */}
      {/* <div id="recaptcha-container"></div> */}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
