
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUserType,
} from 'firebase/auth';
import { auth, firestore } from '@/firebase/config';
import type { AppUser, UserRole, FirebaseUser } from '@/types';
import { LOCAL_STORAGE_ROLE_KEY } from '@/lib/constants';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

// Helper to create a dummy email for Firebase Auth from a phone number
const formatPhoneNumberForAuth = (phoneNumber: string): string => {
  // Ensure phone number is somewhat clean and append a dummy domain
  // Firebase might be picky about characters in the local part of an email
  const cleanedPhoneNumber = phoneNumber.replace(/[^0-9a-zA-Z]/g, '');
  return `${cleanedPhoneNumber}@barberflow.app`;
};

interface AuthContextType {
  user: AppUser | null;
  role: UserRole | null;
  loadingAuth: boolean;
  initialRoleChecked: boolean;
  isProcessingAuth: boolean;
  setRole: (role: UserRole) => void;
  registerWithPhoneNumberAndPassword: (
    userDetails: {
      firstName: string;
      lastName: string;
      phoneNumber: string;
      password_original_do_not_use: string; // Renamed to avoid clash with potential 'password' prop name
      role: UserRole;
    }
  ) => Promise<void>;
  signInWithPhoneNumberAndPassword: (phoneNumber: string, password_original_do_not_use: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [initialRoleChecked, setInitialRoleChecked] = useState(false);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    const storedRole = localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) as UserRole | null;
    if (storedRole) {
      setRoleState(storedRole);
    }
    setInitialRoleChecked(true);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUserType | null) => {
      if (firebaseUser) {
        const userDocRef = doc(firestore, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const appUserData = userDocSnap.data() as Omit<AppUser, keyof FirebaseUser>;
          const appUser: AppUser = {
            ...(firebaseUser as unknown as FirebaseUser), // Firebase user props
            ...appUserData, // Firestore props (firstName, lastName, role, actual phoneNumber)
            email: appUserData.email === undefined ? null : appUserData.email, // email from firestore if exists
            phoneNumber: appUserData.phoneNumber, // CRITICAL: Use actual phoneNumber from Firestore
          };
          setUser(appUser);
          if (appUser.role && (!role || role !== appUser.role)) {
             setRoleContextAndStorage(appUser.role);
          }
        } else {
          // This case might happen if Firestore doc creation failed during registration
          // or if it's a new sign-in method for an existing Firebase Auth user without a doc
          console.warn("AuthContext: User document not found in Firestore for UID:", firebaseUser.uid);
          // Create a minimal user object if doc is missing.
          // The role might be from localStorage if set previously.
           const minimalAppUser: AppUser = {
            ...(firebaseUser as unknown as FirebaseUser),
            // Attempt to use the role from context, or undefined if not set
            role: role || undefined,
            // Phone number might be part of firebaseUser if verified by other means,
            // or we might not have it if only email/password was used.
            // For this app, we rely on Firestore for the canonical phone number.
            phoneNumber: firebaseUser.phoneNumber || 'UNKNOWN (fetch error)',
            email: firebaseUser.email, // This will be the dummy email
          };
          setUser(minimalAppUser);
           toast({ title: "Account Issue", description: "User details not fully loaded. Please contact support if this persists.", variant: "destructive" });
        }
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [role]); // Removed pendingUserDetails as it's no longer used

  const setRoleContextAndStorage = (newRole: UserRole) => {
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, newRole);
    setRoleState(newRole);
  };

  const createUserDocument = async (
    firebaseUser: FirebaseUserType,
    firstName: string,
    lastName: string,
    userRole: UserRole,
    actualPhoneNumber: string // Explicitly pass the real phone number
  ) => {
    const userDocData = {
      uid: firebaseUser.uid,
      dummyEmail: firebaseUser.email, // Store the dummy email used for Firebase Auth
      phoneNumber: actualPhoneNumber, // Store the REAL phone number
      role: userRole,
      firstName,
      lastName,
      createdAt: Timestamp.now(), // Use Firestore Timestamp
      updatedAt: Timestamp.now(),
    };

    await setDoc(doc(firestore, "users", firebaseUser.uid), userDocData);

    // Construct the AppUser for local state
    const appUser: AppUser = {
      ...(firebaseUser as unknown as FirebaseUser), // Base FirebaseUser properties
      ...userDocData, // Spread the Firestore data
      email: firebaseUser.email, // This will be the dummyEmail, AppUser.email can store this
    };
    setUser(appUser);
    if (appUser.role) setRoleContextAndStorage(appUser.role);
  };

  const registerWithPhoneNumberAndPassword = async (
    userDetails: {
      firstName: string;
      lastName: string;
      phoneNumber: string;
      password_original_do_not_use: string;
      role: UserRole;
    }
  ) => {
    setIsProcessingAuth(true);
    const { firstName, lastName, phoneNumber, password_original_do_not_use, role: userRole } = userDetails;
    const dummyEmail = formatPhoneNumberForAuth(phoneNumber);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, dummyEmail, password_original_do_not_use);
      const firebaseUser = userCredential.user;
      await createUserDocument(firebaseUser, firstName, lastName, userRole, phoneNumber);
      toast({ title: "Registration Successful!", description: "Your account has been created." });
      // onAuthStateChanged will handle setting the user state and navigation
    } catch (error: any) {
      console.error("AuthContext: Error registering user:", error);
      let description = "Failed to register. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
        description = "This phone number is already associated with an account.";
      } else if (error.code === 'auth/weak-password') {
        description = "The password is too weak. Please choose a stronger password.";
      } else if (error.code === 'auth/invalid-email') {
        description = "The phone number format is invalid for authentication setup. Please check and try again.";
      }
      toast({ title: "Registration Error", description, variant: "destructive" });
      throw error; // Re-throw to be caught by the form
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const signInWithPhoneNumberAndPassword = async (phoneNumber: string, password_original_do_not_use: string) => {
    setIsProcessingAuth(true);
    const dummyEmail = formatPhoneNumberForAuth(phoneNumber);
    try {
      await signInWithEmailAndPassword(auth, dummyEmail, password_original_do_not_use);
      // onAuthStateChanged will handle setting the user state and navigation
      toast({ title: "Login Successful!", description: "Welcome back!" });
    } catch (error: any)      {
      console.error("AuthContext: Error signing in:", error);
      let description = "Failed to sign in. Please check your phone number and password.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = "Invalid phone number or password.";
      } else if (error.code === 'auth/invalid-email') {
        description = "The phone number format is invalid. Please check and try again.";
      }
      toast({ title: "Login Error", description, variant: "destructive" });
      throw error; // Re-throw to be caught by the form
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const signOutUser = async () => {
    setIsProcessingAuth(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      // Role is intentionally not cleared from localStorage to remember user preference
    } catch (error: any) {
      console.error("AuthContext: Error signing out:", error);
      toast({ title: "Sign Out Error", description: "Could not sign out. Please try again.", variant: "destructive" });
    } finally {
      setIsProcessingAuth(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      loadingAuth,
      initialRoleChecked,
      isProcessingAuth,
      setRole: setRoleContextAndStorage,
      registerWithPhoneNumberAndPassword,
      signInWithPhoneNumberAndPassword,
      signOut: signOutUser,
    }}>
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
