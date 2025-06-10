
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { auth, firestore } from '@/firebase/config';
import type { AppUser, UserRole } from '@/types';
import { LOCAL_STORAGE_ROLE_KEY, LOCAL_STORAGE_USER_KEY } from '@/lib/constants';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  type User as FirebaseUser // Renamed to avoid conflict with AppUser
} from 'firebase/auth';
import { collection, doc, getDoc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: AppUser | null;
  role: UserRole | null;
  loadingAuth: boolean; 
  initialRoleChecked: boolean; 
  isProcessingAuth: boolean; 
  setRole: (role: UserRole) => void;
  registerWithEmailAndPassword: (
    userDetails: Omit<AppUser, 'uid' | 'createdAt' | 'updatedAt' | 'displayName' | 'photoURL' | 'emailVerified'> & { password_original_do_not_use: string }
  ) => Promise<void>;
  signInWithEmailAndPassword: (email: string, password_original_do_not_use: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to create or update user document in Firestore
const createUserDocument = async (firebaseUser: FirebaseUser, additionalData: Partial<AppUser> = {}) => {
  if (!firebaseUser) return;

  const userRef = doc(firestore, `users/${firebaseUser.uid}`);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    const { email, displayName, photoURL, emailVerified } = firebaseUser;
    const createdAt = serverTimestamp();
    try {
      await setDoc(userRef, {
        uid: firebaseUser.uid,
        email,
        displayName: displayName || `${additionalData.firstName} ${additionalData.lastName}` || email,
        photoURL,
        emailVerified,
        createdAt,
        updatedAt: createdAt,
        role: additionalData.role || null,
        firstName: additionalData.firstName || '',
        lastName: additionalData.lastName || '',
        phoneNumber: additionalData.phoneNumber || null,
        ...additionalData, // Spread additional data like role, firstName, lastName
      });
    } catch (error) {
      console.error("Error creating user document: ", error);
      throw error;
    }
  }
  // If user doc exists, you might want to merge or update it here if needed
  // For this example, we primarily create it on registration.
  // When fetching user data on login, we'll just get the existing doc.
};


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

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoadingAuth(true);
      if (firebaseUser) {
        // User is signed in via Firebase Auth
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const firestoreUser = userDocSnap.data() as AppUser;
          const appUser: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || firestoreUser.email, // Prefer Firebase Auth email
            displayName: firebaseUser.displayName || firestoreUser.displayName,
            photoURL: firebaseUser.photoURL,
            emailVerified: firebaseUser.emailVerified,
            role: firestoreUser.role,
            firstName: firestoreUser.firstName,
            lastName: firestoreUser.lastName,
            phoneNumber: firestoreUser.phoneNumber,
            createdAt: firestoreUser.createdAt, // Firestore Timestamps
            updatedAt: firestoreUser.updatedAt, // Firestore Timestamps
          };
          setUser(appUser);
          persistUserSession(appUser); // Persist merged user data
          if (appUser.role) setRoleContextAndStorage(appUser.role);
        } else {
          // This case should ideally not happen if createUserDocument is called on registration.
          // If it does, it means there's a Firebase Auth user without a corresponding Firestore doc.
          // You might want to create it here or log an error.
          console.warn("AuthContext: Firebase user exists but no Firestore document found. User might need to complete registration.");
          setUser(null); // Or a minimal AppUser object from firebaseUser
          clearUserSession();
        }
      } else {
        // User is signed out
        setUser(null);
        clearUserSession();
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);


  const setRoleContextAndStorage = (newRole: UserRole) => {
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, newRole);
    setRoleState(newRole);
  };

  const persistUserSession = (appUser: AppUser) => {
    const storableUser = {
      ...appUser,
      createdAt: appUser.createdAt instanceof Timestamp ? appUser.createdAt.toDate().toISOString() : appUser.createdAt,
      updatedAt: appUser.updatedAt instanceof Timestamp ? appUser.updatedAt.toDate().toISOString() : appUser.updatedAt,
    };
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(storableUser));
  };

  const clearUserSession = () => {
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
  };

  const registerWithEmailAndPassword = async (
     userDetails: Omit<AppUser, 'uid' | 'createdAt' | 'updatedAt' | 'displayName' | 'photoURL' | 'emailVerified'> & { password_original_do_not_use: string }
  ) => {
    setIsProcessingAuth(true);
    const { email, password_original_do_not_use, firstName, lastName, role: userRole, phoneNumber } = userDetails;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password_original_do_not_use);
      const firebaseUser = userCredential.user;
      
      // Prepare data for Firestore document
      const firestoreData: Partial<AppUser> = {
        firstName,
        lastName,
        role: userRole,
        phoneNumber: phoneNumber || null,
        email, // Ensure email is part of Firestore doc too
      };
      await createUserDocument(firebaseUser, firestoreData);

      // Fetch the newly created document to get the full AppUser object
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        throw new Error("Failed to retrieve newly created user document from Firestore.");
      }
      const createdUser = userDocSnap.data() as AppUser;
      
      setUser(createdUser);
      if (createdUser.role) setRoleContextAndStorage(createdUser.role);
      persistUserSession(createdUser);

      toast({ title: "Registration Successful!", description: "Your account has been created." });
    } catch (error: any) {
      console.error("AuthContext: Error registering user:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast({ title: "Registration Error", description: "This email is already registered.", variant: "destructive" });
      } else {
        toast({ title: "Registration Error", description: error.message || "Failed to register. Please try again.", variant: "destructive" });
      }
      throw error;
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const newSignInWithEmailAndPassword = async (email: string, password_original_do_not_use: string) => {
    setIsProcessingAuth(true);
    try {
      await signInWithEmailAndPassword(auth, email, password_original_do_not_use);
      // onAuthStateChanged will handle setting user state and persisting session
      toast({ title: "Login Successful!", description: "Welcome back!" });
    } catch (error: any) {
      console.error("AuthContext: Error signing in:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
         toast({ title: "Login Error", description: "Invalid email or password.", variant: "destructive" });
      } else {
         toast({ title: "Login Error", description: error.message || "Failed to sign in. Please try again.", variant: "destructive" });
      }
      throw error;
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const signOutUser = async () => {
    setIsProcessingAuth(true);
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will handle clearing user state and session
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
      registerWithEmailAndPassword,
      signInWithEmailAndPassword: newSignInWithEmailAndPassword,
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
