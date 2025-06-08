'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  type UserCredential,
  type AuthError
} from 'firebase/auth';
import { auth, firestore } from '@/firebase/config'; // Assuming firestore might be used later
import type { AppUser, UserRole, FirebaseUser } from '@/types';
import { LOCAL_STORAGE_ROLE_KEY } from '@/lib/constants';
import { doc, setDoc, getDoc } from 'firebase/firestore'; // For saving additional user info

interface AuthContextType {
  user: AppUser | null;
  role: UserRole | null;
  loadingAuth: boolean;
  initialRoleChecked: boolean;
  setRole: (role: UserRole) => void;
  signUp: (data: Record<string,any>) => Promise<UserCredential>;
  signIn: (email: string, pass: string) => Promise<UserCredential>;
  signOut: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
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
    setInitialRoleChecked(true); // Mark that initial role check from localStorage is done

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Fetch additional user data from Firestore if necessary
        const userDocRef = doc(firestore, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const appUser: AppUser = {
            ...firebaseUser,
            ...userDocSnap.data() as Partial<AppUser> // role, firstName, etc.
          };
          setUser(appUser);
          if (appUser.role && !role) { // If role in Firestore and not in local, update local
             setRoleContextAndStorage(appUser.role);
          }
        } else {
          // Default to FirebaseUser if no extra data, or handle as new user setup
          setUser(firebaseUser as AppUser);
        }
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [role]); // Added role to dependency array to re-sync if it changes elsewhere.

  const setRoleContextAndStorage = (newRole: UserRole) => {
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, newRole);
    setRoleState(newRole);
  };
  
  const signUp = async (data: Record<string,any>) => {
    const { email, password, firstName, lastName, phoneNumber, role: userRole } = data;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    // Save additional user info to Firestore
    await setDoc(doc(firestore, "users", firebaseUser.uid), {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      role: userRole,
      firstName,
      lastName,
      phoneNumber,
      createdAt: new Date().toISOString(),
    });
    setRoleContextAndStorage(userRole);
    // Manually set user state here or let onAuthStateChanged handle it
    setUser({ ...firebaseUser, role: userRole, firstName, lastName, phoneNumber } as AppUser);
    return userCredential;
  };

  const signIn = (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const signOut = () => {
    // Optionally clear role from localStorage on sign out, or keep it for next login
    // localStorage.removeItem(LOCAL_STORAGE_ROLE_KEY);
    // setRoleState(null);
    return firebaseSignOut(auth);
  };

  const sendPasswordResetEmail = (email: string) => {
    return firebaseSendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ user, role, loadingAuth, initialRoleChecked, setRole: setRoleContextAndStorage, signUp, signIn, signOut, sendPasswordResetEmail }}>
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
