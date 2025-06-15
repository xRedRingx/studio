
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
  type User as FirebaseUser
} from 'firebase/auth';
import { collection, doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

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
    userDetails: Omit<AppUser, 'uid' | 'createdAt' | 'updatedAt' | 'displayName' | 'emailVerified' | 'fcmToken'> & { password_original_do_not_use: string }
  ) => Promise<void>;
  signInWithEmailAndPassword: (email: string, password_original_do_not_use: string) => Promise<void>;
  sendPasswordResetLink: (email: string) => Promise<void>;
  updateUserProfile: (
    userId: string,
    updates: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address'>>
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserAcceptingBookings: (userId: string, isAccepting: boolean) => Promise<void>;
  updateUserFCMToken: (userId: string, token: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function createUserDocument(firebaseUser: FirebaseUser, dataFromRegistration: Partial<AppUser> = {}) {
  if (!firebaseUser) return;

  console.log('createUserDocument received dataFromRegistration:', JSON.stringify(dataFromRegistration, null, 2));

  const userRef = doc(firestore, `users/${firebaseUser.uid}`);
  // No need to check if snapshot exists here if we're merging,
  // setDoc with merge will create or update.

  const { email: authEmail, emailVerified, displayName: authDisplayName } = firebaseUser;
  const createdAt = Timestamp.now(); // Use server timestamp for consistency

  const roleFromReg = dataFromRegistration.role;
  const firstNameFromReg = dataFromRegistration.firstName?.trim();
  const lastNameFromReg = dataFromRegistration.lastName?.trim();
  const phoneNumberFromReg = dataFromRegistration.phoneNumber?.trim();
  const addressFromReg = dataFromRegistration.address?.trim();
  const isAcceptingBookingsFromReg = dataFromRegistration.isAcceptingBookings;

  let calculatedDisplayName = '';
  if (firstNameFromReg && lastNameFromReg) {
    calculatedDisplayName = `${firstNameFromReg} ${lastNameFromReg}`;
  } else if (firstNameFromReg) {
    calculatedDisplayName = firstNameFromReg;
  } else if (lastNameFromReg) {
    calculatedDisplayName = lastNameFromReg;
  }

  // Fallback displayName logic
  let finalDisplayName = calculatedDisplayName;
  if (!finalDisplayName || finalDisplayName.trim() === "" || finalDisplayName.toLowerCase() === "undefined undefined") {
    finalDisplayName = (authDisplayName && authDisplayName.trim() !== "" && authDisplayName.toLowerCase() !== "undefined undefined")
      ? authDisplayName
      : (authEmail ? authEmail.split('@')[0] : `User_${firebaseUser.uid.substring(0,5)}`);
  }

  try {
    // Build the core user data that's always present
    const userDataToSet: { [key: string]: any } = {
      uid: firebaseUser.uid,
      email: authEmail,
      displayName: finalDisplayName.trim(),
      emailVerified,
      // createdAt is set on initial creation, updatedAt is always set
      // setDoc with merge handles this: if doc exists, it won't overwrite createdAt unless explicitly provided
      updatedAt: createdAt, // This will effectively be createdAt on first write, and updatedAt on subsequent merges
    };

    // Conditionally add fields from registration data if they are provided
    if (roleFromReg) userDataToSet.role = roleFromReg;
    if (firstNameFromReg) userDataToSet.firstName = firstNameFromReg; else if (dataFromRegistration.hasOwnProperty('firstName')) userDataToSet.firstName = null;
    if (lastNameFromReg) userDataToSet.lastName = lastNameFromReg; else if (dataFromRegistration.hasOwnProperty('lastName')) userDataToSet.lastName = null;
    if (phoneNumberFromReg) userDataToSet.phoneNumber = phoneNumberFromReg; else if (dataFromRegistration.hasOwnProperty('phoneNumber')) userDataToSet.phoneNumber = null;
    if (addressFromReg) userDataToSet.address = addressFromReg; else if (dataFromRegistration.hasOwnProperty('address')) userDataToSet.address = null;
    
    if (roleFromReg === 'barber') {
      userDataToSet.isAcceptingBookings = isAcceptingBookingsFromReg !== undefined ? isAcceptingBookingsFromReg : true;
    } else {
      // Ensure isAcceptingBookings is not set for customers, or removed if merging from a previous barber role
      if (dataFromRegistration.hasOwnProperty('role') && roleFromReg !== 'barber') {
         // If role is explicitly not barber, we don't want isAcceptingBookings
         // For merge: true, to remove a field, you'd typically use FieldValue.delete(),
         // but since this is a create/merge, simply not including it is fine if it's a new doc.
         // If merging and changing role from barber to customer, isAcceptingBookings might remain.
         // This logic path should be robust enough for initial creation.
      }
    }
    
    // For a true "create if not exists, otherwise update with provided fields"
    // we want createdAt to only be set once.
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
        userDataToSet.createdAt = createdAt;
        userDataToSet.fcmToken = null; // Initialize fcmToken for new users
    }


    console.log('Final userDataToSet before setDoc (merge: true):', JSON.stringify(userDataToSet, null, 2));

    await setDoc(userRef, userDataToSet, { merge: true }); // USE MERGE: TRUE

  } catch (error) {
    console.error("Error in createUserDocument: ", error);
    throw error;
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
        let userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          // Document doesn't exist. This could be a new user from registration
          // or an auth user whose Firestore doc was somehow deleted.
          // The registration flow calls createUserDocument. If this onAuthStateChanged
          // runs very quickly, it might try to create it too.
          // Using {merge: true} in createUserDocument handles this.
          console.log(`onAuthStateChanged: User doc for ${firebaseUser.uid} not found. Attempting to ensure/create.`);

          const minimalDataForCreation: Partial<AppUser> = {};
          // Use the current role from AuthContext state if available (set by RoleSelector or registration process)
          if (role) { // 'role' here is the AuthContext's state variable
            minimalDataForCreation.role = role;
          } else {
            const roleFromStorageFallback = localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) as UserRole | null;
            if (roleFromStorageFallback) {
              minimalDataForCreation.role = roleFromStorageFallback;
            }
          }
          console.log('onAuthStateChanged: calling createUserDocument with minimalData:', JSON.stringify(minimalDataForCreation, null, 2));
          await createUserDocument(firebaseUser, minimalDataForCreation);
          userDocSnap = await getDoc(userDocRef); // Re-fetch after creation attempt
        }
        
        if (userDocSnap.exists()) {
          const firestoreUser = userDocSnap.data() as AppUser;
          const appUser: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || firestoreUser.email,
            displayName: firestoreUser.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || `User_${firebaseUser.uid.substring(0,5)}`,
            emailVerified: firebaseUser.emailVerified,
            role: firestoreUser.role,
            firstName: firestoreUser.firstName,
            lastName: firestoreUser.lastName,
            phoneNumber: firestoreUser.phoneNumber,
            address: firestoreUser.address,
            isAcceptingBookings: firestoreUser.role === 'barber' ? (firestoreUser.isAcceptingBookings !== undefined ? firestoreUser.isAcceptingBookings : true) : undefined,
            fcmToken: firestoreUser.fcmToken || null,
            createdAt: firestoreUser.createdAt, // Already a Timestamp from Firestore
            updatedAt: firestoreUser.updatedAt, // Already a Timestamp from Firestore
          };
          setUser(appUser);
          persistUserSession(appUser); // Persist potentially merged/updated data
          if (firestoreUser.role && firestoreUser.role !== role) { // If Firestore role differs from context role
             setRoleContextAndStorage(firestoreUser.role);
          } else if (firestoreUser.role) { // If same or context role was null
             setRoleState(firestoreUser.role);
          }
        } else {
          console.warn(`AuthContext: Firebase user ${firebaseUser.uid} exists but Firestore document could not be fetched/created.`);
          setUser(null);
          clearUserSession();
          // Optionally sign out the user if their data integrity is compromised
          // await firebaseSignOut(auth);
        }
      } else {
        setUser(null);
        clearUserSession();
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]); // Added `role` to dependency array for onAuthStateChanged logic


  const setRoleContextAndStorage = (newRole: UserRole) => {
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, newRole);
    setRoleState(newRole);
  };

  const persistUserSession = (appUser: AppUser) => {
    const storableUser = { // Convert Timestamps to ISO strings for localStorage
      ...appUser,
      createdAt: appUser.createdAt instanceof Timestamp ? appUser.createdAt.toDate().toISOString() : appUser.createdAt,
      updatedAt: appUser.updatedAt instanceof Timestamp ? appUser.updatedAt.toDate().toISOString() : appUser.updatedAt,
    };
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(storableUser));
  };

  const clearUserSession = () => {
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    // Don't clear LOCAL_STORAGE_ROLE_KEY on simple sign-out, user might want to log back in as same role.
    // It gets overwritten on new role selection or new successful registration.
  };

  const registerWithEmailAndPassword = async (
     userDetails: Omit<AppUser, 'uid' | 'createdAt' | 'updatedAt' | 'displayName' | 'emailVerified' | 'fcmToken'> & { password_original_do_not_use: string }
  ) => {
    setIsProcessingAuth(true);
    const { email, password_original_do_not_use, firstName, lastName, role: userRole, phoneNumber, address, isAcceptingBookings } = userDetails;

    // This is crucial: set the role in context immediately.
    // This helps onAuthStateChanged make better decisions if it fires quickly.
    setRoleContextAndStorage(userRole);

    console.log('registerWithEmailAndPassword: data received from form:', JSON.stringify(userDetails, null, 2));

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password_original_do_not_use);
      const firebaseUser = userCredential.user;

      // Prepare the full data object for createUserDocument
      const firestoreDataForCreation: Partial<AppUser> = {
        email, // Already part of firebaseUser but good to pass for consistency if needed
        firstName: firstName,
        lastName: lastName,
        role: userRole,
        phoneNumber: phoneNumber || null, // Ensure null if empty
        address: address || null, // Ensure null if empty
      };
      
      if (userRole === 'barber') {
        firestoreDataForCreation.isAcceptingBookings = isAcceptingBookings !== undefined ? isAcceptingBookings : true;
      }

      console.log('registerWithEmailAndPassword: calling createUserDocument with firestoreDataForCreation:', JSON.stringify(firestoreDataForCreation, null, 2));
      await createUserDocument(firebaseUser, firestoreDataForCreation);

      // After document creation/merging, fetch the definitive version from Firestore
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        throw new Error("User document not found in Firestore after registration and createUserDocument call.");
      }
      const createdUser = userDocSnap.data() as AppUser;

      setUser(createdUser); // Set user state with the definitive data from Firestore
      persistUserSession(createdUser);
      // Role should already be set correctly by setRoleContextAndStorage above or via onAuthStateChanged re-eval

      toast({ title: "Registration Successful!", description: "Your account has been created." });
    } catch (error: any) {
      console.error("AuthContext: Error registering user:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast({ title: "Registration Error", description: "This email is already registered.", variant: "destructive" });
      } else {
        toast({ title: "Registration Error", description: error.message || "Failed to register. Please try again.", variant: "destructive" });
      }
      throw error; // Re-throw to allow form to handle it if needed
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const newSignInWithEmailAndPassword = async (email: string, password_original_do_not_use: string) => {
    setIsProcessingAuth(true);
    try {
      await signInWithEmailAndPassword(auth, email, password_original_do_not_use);
      // onAuthStateChanged will handle fetching user data and setting role.
      // toast({ title: "Login Successful!", description: "Welcome back!" }); // Toast can be moved to onAuthStateChanged success if preferred
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
       toast({
        title: "Check Your Email",
        description: "If an account exists for this email, a password reset link has been sent.",
      });
    } catch (error: any) {
      console.error("AuthContext: Error sending password reset email:", error);
      // Avoid giving away whether an email is registered or not for security.
      toast({ title: "Password Reset", description: "If your email is registered, you'll receive a reset link shortly.", variant: "default" });
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const updateUserProfile = async (
    userId: string,
    updates: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address'>>
  ) => {
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
        toast({ title: "Error", description: "Authentication error. Please re-login.", variant: "destructive" });
        throw new Error("User not authenticated or mismatched ID.");
    }
    setIsProcessingAuth(true);
    try {
      const userRef = doc(firestore, 'users', userId);
      const dataToUpdate: { [key: string]: any } = { updatedAt: Timestamp.now() };

      const currentDataSnap = await getDoc(userRef);
      const currentData = currentDataSnap.data() as AppUser | undefined;
      
      const newFirstName = updates.firstName?.trim();
      const newLastName = updates.lastName?.trim();

      dataToUpdate.firstName = newFirstName && newFirstName !== "" ? newFirstName : null;
      dataToUpdate.lastName = newLastName && newLastName !== "" ? newLastName : null;
      dataToUpdate.phoneNumber = updates.phoneNumber && updates.phoneNumber.trim() !== "" ? updates.phoneNumber.trim() : null;
      dataToUpdate.address = updates.address && updates.address.trim() !== "" ? updates.address.trim() : null;
      
      let newDisplayName = '';
      const finalFirstName = dataToUpdate.firstName;
      const finalLastName = dataToUpdate.lastName;

      if (finalFirstName && finalLastName) {
          newDisplayName = `${finalFirstName} ${finalLastName}`;
      } else if (finalFirstName) {
          newDisplayName = finalFirstName;
      } else if (finalLastName) {
          newDisplayName = finalLastName;
      } else {
          newDisplayName = currentData?.email?.split('@')[0] || `User_${userId.substring(0,5)}`;
      }
      dataToUpdate.displayName = newDisplayName.trim();


      await updateDoc(userRef, dataToUpdate);

      setUser(prevUser => {
        if (!prevUser) return null;
        const updatedUser = {
            ...prevUser, 
            ...dataToUpdate,
            updatedAt: dataToUpdate.updatedAt, // ensure Timestamp object
        };
        persistUserSession(updatedUser);
        return updatedUser;
      });
       toast({ title: "Success", description: "Your profile has been updated." }); // Moved toast here
    } catch (error: any) {
      console.error("AuthContext: Error updating user profile:", error);
      toast({ title: "Update Error", description: error.message || "Could not update profile.", variant: "destructive" }); // Generic error toast
      throw error;
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const updateUserAcceptingBookings = async (userId: string, isAccepting: boolean) => {
    setIsProcessingAuth(true);
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
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const updateUserFCMToken = async (userId: string, token: string | null) => {
    setIsProcessingAuth(true);
    try {
      const userRef = doc(firestore, 'users', userId);
      await updateDoc(userRef, {
        fcmToken: token, // This will set to null if token is null, effectively deleting it
        updatedAt: Timestamp.now(),
      });
      setUser(prevUser => {
        if (!prevUser || prevUser.uid !== userId) return prevUser;
        const updatedUser = { ...prevUser, fcmToken: token, updatedAt: Timestamp.now() };
        persistUserSession(updatedUser);
        return updatedUser;
      });
       toast({ title: "Notifications", description: token ? "Notifications enabled." : "Notifications disabled." });
    } catch (error: any)      {
      console.error("AuthContext: Error updating FCM token:", error);
      toast({ title: "Notification Error", description: "Could not update notification preference.", variant: "destructive" });
      throw error;
    } finally {
      setIsProcessingAuth(false);
    }
  };


  const signOutUser = async () => {
    setIsProcessingAuth(true);
    try {
      await firebaseSignOut(auth);
      // User state and role (except from localStorage for next login hint) will be cleared by onAuthStateChanged
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

