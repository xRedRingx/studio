
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { firestore } from '@/firebase/config';
import type { AppUser, UserRole } from '@/types';
import { LOCAL_STORAGE_ROLE_KEY, LOCAL_STORAGE_USER_KEY } from '@/lib/constants';
import { collection, query, where, getDocs, addDoc, Timestamp, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: AppUser | null;
  role: UserRole | null;
  loadingAuth: boolean; // For checking localStorage session
  initialRoleChecked: boolean; // For initial role from localStorage
  isProcessingAuth: boolean; // For login/register operations
  setRole: (role: UserRole) => void;
  registerWithDetails: (
    userDetails: Omit<AppUser, 'uid' | 'createdAt' | 'updatedAt' | 'displayName' | 'photoURL' | 'emailVerified'> & { password_original_do_not_use: string }
  ) => Promise<void>;
  signInWithPhoneAndPassword: (phoneNumber: string, password_original_do_not_use: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true); // True while checking localStorage
  const [initialRoleChecked, setInitialRoleChecked] = useState(false);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check for stored role preference
    const storedRole = localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) as UserRole | null;
    if (storedRole) {
      setRoleState(storedRole);
    }
    setInitialRoleChecked(true);

    // Check for persisted user session
    try {
      const storedUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser) as AppUser;
        // Convert string timestamps back to Firestore Timestamps if necessary or handle as strings
        if (parsedUser.createdAt && typeof parsedUser.createdAt === 'string') {
            parsedUser.createdAt = Timestamp.fromDate(new Date(parsedUser.createdAt));
        }
        if (parsedUser.updatedAt && typeof parsedUser.updatedAt === 'string') {
            parsedUser.updatedAt = Timestamp.fromDate(new Date(parsedUser.updatedAt));
        }
        setUser(parsedUser);
        if (parsedUser.role) {
            setRoleContextAndStorage(parsedUser.role); // Ensure role context aligns with stored user
        }
      }
    } catch (error) {
        console.error("AuthContext: Error parsing stored user from localStorage", error);
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY); // Clear corrupted data
    }
    setLoadingAuth(false); // Done checking localStorage
  }, []);

  const setRoleContextAndStorage = (newRole: UserRole) => {
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, newRole);
    setRoleState(newRole);
  };

  const persistUserSession = (appUser: AppUser) => {
    // Convert Timestamps to ISO strings for localStorage
    const storableUser = {
        ...appUser,
        createdAt: appUser.createdAt instanceof Timestamp ? appUser.createdAt.toDate().toISOString() : appUser.createdAt,
        updatedAt: appUser.updatedAt instanceof Timestamp ? appUser.updatedAt.toDate().toISOString() : appUser.updatedAt,
    };
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(storableUser));
  };

  const clearUserSession = () => {
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    // Optionally, clear role preference on full sign out, or keep it.
    // localStorage.removeItem(LOCAL_STORAGE_ROLE_KEY);
  };

  const registerWithDetails = async (
     userDetails: Omit<AppUser, 'uid' | 'createdAt' | 'updatedAt' | 'displayName' | 'photoURL' | 'emailVerified'> & { password_original_do_not_use: string }
  ) => {
    setIsProcessingAuth(true);
    const { firstName, lastName, phoneNumber, password_original_do_not_use, role: userRole } = userDetails;

    try {
      // Check if phone number already exists
      const usersRef = collection(firestore, "users");
      const q = query(usersRef, where("phoneNumber", "==", phoneNumber));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        toast({ title: "Registration Error", description: "This phone number is already registered.", variant: "destructive" });
        setIsProcessingAuth(false);
        throw new Error("Phone number already registered.");
      }

      // **SECURITY WARNING**: Storing password directly. NOT FOR PRODUCTION.
      const newUserDocData = {
        firstName,
        lastName,
        phoneNumber,
        password: password_original_do_not_use, // Storing plain text password - VERY INSECURE
        role: userRole,
        createdAt: serverTimestamp(), // Use serverTimestamp for initial creation
        updatedAt: serverTimestamp(), // Use serverTimestamp for initial creation
        email: userDetails.email || null,
        displayName: `${firstName} ${lastName}`,
        photoURL: null,
        emailVerified: false,
      };

      const docRef = await addDoc(usersRef, newUserDocData);
      
      // Fetch the newly created document to get server-generated timestamps
      const newDocSnap = await getDoc(docRef);
      if (!newDocSnap.exists()) {
          throw new Error("Failed to retrieve newly created user document.");
      }
      const createdUser: AppUser = {
        ...newDocSnap.data() as Omit<AppUser, 'uid'>, // Cast to ensure fields match, but uid is separate
        uid: docRef.id,
      };

      setUser(createdUser);
      if (createdUser.role) setRoleContextAndStorage(createdUser.role);
      persistUserSession(createdUser);

      toast({ title: "Registration Successful!", description: "Your account has been created." });
    } catch (error: any) {
      console.error("AuthContext: Error registering user:", error);
      if (error.message !== "Phone number already registered." && error.message !== "Failed to retrieve newly created user document.") {
        toast({ title: "Registration Error", description: "Failed to register. Please try again.", variant: "destructive" });
      }
      throw error;
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const signInWithPhoneAndPassword = async (phoneNumber: string, password_original_do_not_use: string) => {
    setIsProcessingAuth(true);
    try {
      const usersRef = collection(firestore, "users");
      const q = query(usersRef, where("phoneNumber", "==", phoneNumber));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ title: "Login Error", description: "Invalid phone number or password.", variant: "destructive" });
        setIsProcessingAuth(false);
        throw new Error("User not found.");
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // **SECURITY WARNING**: Comparing plain text passwords. NOT FOR PRODUCTION.
      if (userData.password !== password_original_do_not_use) {
        toast({ title: "Login Error", description: "Invalid phone number or password.", variant: "destructive" });
        setIsProcessingAuth(false);
        throw new Error("Incorrect password.");
      }
      
      const loggedInUser: AppUser = {
        uid: userDoc.id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber,
        role: userData.role,
        // Timestamps and other fields should be directly from userData
        createdAt: userData.createdAt, // Already a Timestamp from Firestore
        updatedAt: userData.updatedAt, // Already a Timestamp from Firestore
        email: userData.email || null,
        displayName: userData.displayName || `${userData.firstName} ${userData.lastName}`,
        photoURL: userData.photoURL || null,
        emailVerified: userData.emailVerified || false,
        // Do not include password in the AppUser state for the context
      };

      setUser(loggedInUser);
      if (loggedInUser.role) setRoleContextAndStorage(loggedInUser.role);
      persistUserSession(loggedInUser);

      toast({ title: "Login Successful!", description: "Welcome back!" });
    } catch (error: any) {
      console.error("AuthContext: Error signing in:", error);
      if (error.message !== "User not found." && error.message !== "Incorrect password.") {
         toast({ title: "Login Error", description: "Failed to sign in. Please try again.", variant: "destructive" });
      }
      throw error;
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const signOutUser = async () => {
    setIsProcessingAuth(true);
    setUser(null);
    clearUserSession();
    setIsProcessingAuth(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      loadingAuth,
      initialRoleChecked,
      isProcessingAuth,
      setRole: setRoleContextAndStorage,
      registerWithDetails,
      signInWithPhoneAndPassword,
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

