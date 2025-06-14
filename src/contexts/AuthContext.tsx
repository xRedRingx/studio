
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
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  updateProfile as updateFirebaseUserProfile, 
  type User as FirebaseUser
} from 'firebase/auth';
import { collection, doc, getDoc, setDoc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore'; 

// uploadProfileImage is no longer directly used by updateUserProfile here
// import { uploadProfileImage } from '@/firebase/storageUtils'; 
import { useToast } from '@/hooks/use-toast';


interface AuthContextType {
  user: AppUser | null;
  role: UserRole | null;
  loadingAuth: boolean; 
  initialRoleChecked: boolean; 
  isProcessingAuth: boolean; 
  setIsProcessingAuth: React.Dispatch<React.SetStateAction<boolean>>; 
  setUser: React.Dispatch<React.SetStateAction<AppUser | null>>; 
  setRole: (role: UserRole) => void;
  registerWithEmailAndPassword: (
    userDetails: Omit<AppUser, 'uid' | 'createdAt' | 'updatedAt' | 'displayName' | 'photoURL' | 'emailVerified' | 'fcmToken'> & { password_original_do_not_use: string }
  ) => Promise<void>;
  signInWithEmailAndPassword: (email: string, password_original_do_not_use: string) => Promise<void>;
  sendPasswordResetLink: (email: string) => Promise<void>;
  updateUserProfile: ( // newPhotoFile parameter removed
    userId: string, 
    updates: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address'>>
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserAcceptingBookings: (userId: string, isAccepting: boolean) => Promise<void>;
  updateUserFCMToken: (userId: string, token: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
        photoURL: additionalData.photoURL || photoURL || null, 
        emailVerified,
        createdAt,
        updatedAt: createdAt,
        role: additionalData.role || null,
        firstName: additionalData.firstName || '',
        lastName: additionalData.lastName || '',
        phoneNumber: additionalData.phoneNumber || null,
        address: additionalData.address || null, 
        isAcceptingBookings: additionalData.role === 'barber' ? (additionalData.isAcceptingBookings !== undefined ? additionalData.isAcceptingBookings : true) : undefined,
        fcmToken: null, 
        ...additionalData,
      });
    } catch (error) {
      console.error("Error creating user document: ", error);
      throw error;
    }
  }
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
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const firestoreUser = userDocSnap.data() as AppUser;
          const appUser: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || firestoreUser.email,
            displayName: firebaseUser.displayName || firestoreUser.displayName,
            photoURL: firebaseUser.photoURL || firestoreUser.photoURL || null, 
            emailVerified: firebaseUser.emailVerified,
            role: firestoreUser.role,
            firstName: firestoreUser.firstName,
            lastName: firestoreUser.lastName,
            phoneNumber: firestoreUser.phoneNumber,
            address: firestoreUser.address, 
            isAcceptingBookings: firestoreUser.role === 'barber' ? (firestoreUser.isAcceptingBookings !== undefined ? firestoreUser.isAcceptingBookings : true) : undefined,
            fcmToken: firestoreUser.fcmToken || null,
            createdAt: firestoreUser.createdAt,
            updatedAt: firestoreUser.updatedAt,
          };
          setUser(appUser);
          persistUserSession(appUser);
          if (firestoreUser.role && firestoreUser.role !== role) {
             setRoleContextAndStorage(firestoreUser.role);
          } else if (firestoreUser.role) {
             setRoleState(firestoreUser.role);
          }

        } else {
          // If user exists in Auth but not Firestore, create their Firestore doc
          // This can happen if registration was interrupted or for first-time Google/other provider sign-in
          // where we haven't created a local profile yet.
           const roleFromStorage = localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) as UserRole | null;
           const basicProfileData: Partial<AppUser> = {
              role: roleFromStorage, // Use role from localStorage if available
              photoURL: firebaseUser.photoURL,
           };
          await createUserDocument(firebaseUser, basicProfileData);
          // Attempt to refetch the user document
          const newUserDocSnap = await getDoc(userDocRef);
          if (newUserDocSnap.exists()) {
            const firestoreUser = newUserDocSnap.data() as AppUser;
            const appUser: AppUser = {
                uid: firebaseUser.uid, email: firebaseUser.email!, displayName: firebaseUser.displayName, photoURL: firebaseUser.photoURL, emailVerified: firebaseUser.emailVerified,
                ...firestoreUser // Spread the rest from Firestore
            };
            setUser(appUser);
            persistUserSession(appUser);
            if (appUser.role && appUser.role !== role) setRoleContextAndStorage(appUser.role);
            else if (appUser.role) setRoleState(appUser.role);
          } else {
            console.warn("AuthContext: Firebase user exists but no Firestore document found even after attempting creation.");
            setUser(null);
            clearUserSession();
          }
        }
      } else {
        setUser(null);
        clearUserSession();
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [role]); // role dependency is important here


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
    // Note: We are NOT clearing LOCAL_STORAGE_ROLE_KEY here anymore
  };

  const registerWithEmailAndPassword = async (
     userDetails: Omit<AppUser, 'uid' | 'createdAt' | 'updatedAt' | 'displayName' | 'photoURL' | 'emailVerified' | 'fcmToken'> & { password_original_do_not_use: string }
  ) => {
    setIsProcessingAuth(true);
    const { email, password_original_do_not_use, firstName, lastName, role: userRole, phoneNumber, address, isAcceptingBookings } = userDetails;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password_original_do_not_use);
      const firebaseUser = userCredential.user;
      
      const firestoreData: Partial<AppUser> = {
        firstName,
        lastName,
        role: userRole,
        phoneNumber: phoneNumber || null,
        address: address || null, 
        email,
        photoURL: firebaseUser.photoURL || null, // Use photoURL from Firebase Auth if available, else null
        isAcceptingBookings: userRole === 'barber' ? (isAcceptingBookings !== undefined ? isAcceptingBookings : true) : undefined,
        fcmToken: null, 
      };
      await createUserDocument(firebaseUser, firestoreData);

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
      // User state and role will be set by onAuthStateChanged listener
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

  const sendPasswordResetLink = async (email: string) => {
    setIsProcessingAuth(true);
    try {
      await firebaseSendPasswordResetEmail(auth, email);
      // No toast here if user not found, as per Firebase recommendation
    } catch (error: any) {
      console.error("AuthContext: Error sending password reset email:", error);
      if (error.code !== 'auth/user-not-found') { 
         toast({ title: "Password Reset Error", description: error.message || "Could not send reset link. Please try again.", variant: "destructive" });
      } 
      throw error; 
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const updateUserProfile = async (
    userId: string, 
    updates: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address'>>
    // newPhotoFile parameter removed
  ) => {
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
        toast({ title: "Error", description: "Authentication error. Please re-login.", variant: "destructive" });
        throw new Error("User not authenticated or mismatched ID.");
    }
    try {
      const userRef = doc(firestore, 'users', userId);
      const dataToUpdate: any = { ...updates, updatedAt: Timestamp.now() };

      if (updates.phoneNumber === '' || updates.phoneNumber === undefined) {
        dataToUpdate.phoneNumber = null;
      }
      if (updates.address === '' || updates.address === undefined) {
        dataToUpdate.address = null;
      }
      
      // photoURL is not updated via this function anymore. It's managed by Firebase Auth directly.
      // We rely on onAuthStateChanged to pick up photoURL changes from Firebase Auth.
      
      await updateDoc(userRef, dataToUpdate);

      setUser(prevUser => {
        if (!prevUser) return null;
        const updatedUser = { 
            ...prevUser, 
            ...dataToUpdate, 
            // photoURL will be updated by onAuthStateChanged if Firebase Auth profile changes
            updatedAt: dataToUpdate.updatedAt 
        }; 
        persistUserSession(updatedUser);
        return updatedUser;
      });
    } catch (error: any) {
      console.error("AuthContext: Error updating user profile:", error);
      throw error;
    } 
  };

  const updateUserAcceptingBookings = async (userId: string, isAccepting: boolean) => {
    try {
      const userRef = doc(firestore, 'users', userId);
      await updateDoc(userRef, {
        isAcceptingBookings: isAccepting,
        updatedAt: Timestamp.now(),
      });

      setUser(prevUser => {
        if (!prevUser || prevUser.uid !== userId) return prevUser;
        const updatedUser = { ...prevUser, isAcceptingBookings: isAccepting, updatedAt: Timestamp.now() };
        persistUserSession(updatedUser);
        return updatedUser;
      });
    } catch (error: any) {
      console.error("AuthContext: Error updating isAcceptingBookings status:", error);
      toast({ title: "Update Error", description: error.message || "Could not update booking status.", variant: "destructive" });
      throw error;
    }
  };

  const updateUserFCMToken = async (userId: string, token: string | null) => {
    try {
      const userRef = doc(firestore, 'users', userId);
      await updateDoc(userRef, {
        fcmToken: token,
        updatedAt: Timestamp.now(),
      });
      setUser(prevUser => {
        if (!prevUser || prevUser.uid !== userId) return prevUser;
        const updatedUser = { ...prevUser, fcmToken: token, updatedAt: Timestamp.now() };
        persistUserSession(updatedUser);
        return updatedUser;
      });
       toast({ title: "Notifications", description: token ? "Notifications enabled." : "Notifications disabled." });
    } catch (error: any) {
      console.error("AuthContext: Error updating FCM token:", error);
      toast({ title: "Notification Error", description: "Could not update notification preference.", variant: "destructive" });
      throw error;
    }
  };


  const signOutUser = async () => {
    setIsProcessingAuth(true);
    try {
      await firebaseSignOut(auth);
      // User and role will be cleared by onAuthStateChanged
      // We no longer clear the role from localStorage here, so the app remembers it for the next login.
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
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
      setIsProcessingAuth, 
      setUser, 
      setRole: setRoleContextAndStorage,
      registerWithEmailAndPassword,
      signInWithEmailAndPassword: newSignInWithEmailAndPassword,
      sendPasswordResetLink,
      updateUserProfile, 
      signOut: signOutUser,
      updateUserAcceptingBookings,
      updateUserFCMToken,
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

    