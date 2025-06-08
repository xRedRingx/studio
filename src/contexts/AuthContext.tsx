
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, // Using this for phone+password workaround
  signInWithEmailAndPassword, // Using this for phone+password workaround
  signOut as firebaseSignOut,
  type UserCredential, 
  type AuthError,
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
  signUp: (data: { // Updated for phone + password
    firstName: string;
    lastName: string;
    phoneNumber: string; // Will be used as 'email' for Firebase
    password: string;
    email?: string; // Optional, for Firestore record
    role: UserRole;
  }) => Promise<UserCredential>; 
  signIn: (data: { // Updated for phone + password
    phoneNumber: string; // Will be used as 'email' for Firebase
    password: string;
  }) => Promise<UserCredential>; 
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [initialRoleChecked, setInitialRoleChecked] = useState(false);

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
            // Ensure phoneNumber is present, either from appData or firebaseUser (which stores it in 'email' field)
            phoneNumber: appUserData.phoneNumber || firebaseUser.email || '', 
          };
          setUser(appUser);
          if (appUser.role && !role) {
             setRoleContextAndStorage(appUser.role);
          }
        } else {
          // User exists in Firebase Auth but not Firestore (shouldn't happen with this flow if signUp is robust)
          const minimalAppUser: AppUser = {
            ...firebaseUser,
            phoneNumber: firebaseUser.email || 'UNKNOWN_PHONE_AS_EMAIL', // Firebase stores phone in email field here
            role: role || undefined, 
          };
          setUser(minimalAppUser);
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
    phoneNumber: string; // This will be used as 'email' for Firebase auth
    password: string;
    email?: string; // Actual email, optional for Firestore
    role: UserRole;
  }) => {
    const { firstName, lastName, phoneNumber, password, email, role: userRole } = data;
    // Using phoneNumber as the 'email' for Firebase's email/password auth system
    const userCredential = await createUserWithEmailAndPassword(auth, phoneNumber, password);
    const firebaseUser = userCredential.user;

    await setDoc(doc(firestore, "users", firebaseUser.uid), {
      uid: firebaseUser.uid,
      phoneNumber: phoneNumber, // Store the actual phone number
      email: email || null, // Store the optional actual email
      role: userRole,
      firstName,
      lastName,
      createdAt: new Date().toISOString(),
    });
    setRoleContextAndStorage(userRole);
    // The firebaseUser object will have phoneNumber in its 'email' field.
    // The AppUser merges this with Firestore data.
    setUser({ 
      ...firebaseUser, 
      phoneNumber: phoneNumber, // ensure appUser.phoneNumber is the actual phone number
      role: userRole, 
      firstName, 
      lastName, 
      email: email || undefined 
    } as AppUser);
    return userCredential;
  };

  const signIn = async (data: { phoneNumber: string; password: string }) => {
    const { phoneNumber, password } = data;
    // Using phoneNumber as the 'email' for Firebase's email/password auth system
    const userCredential = await signInWithEmailAndPassword(auth, phoneNumber, password);
    // onAuthStateChanged will handle setting the user state
    return userCredential;
  };

  const signOut = () => {
    return firebaseSignOut(auth).then(() => {
      setUser(null); 
    });
  };

  return (
    <AuthContext.Provider value={{ user, role, loadingAuth, initialRoleChecked, setRole: setRoleContextAndStorage, signUp, signIn, signOut }}>
      {children}
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
