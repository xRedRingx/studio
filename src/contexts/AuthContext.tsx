
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

const createUserDocument = async (firebaseUser: FirebaseUser, additionalData: Partial<AppUser> = {}) => {
  if (!firebaseUser) return;

  const userRef = doc(firestore, `users/${firebaseUser.uid}`);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    const { email, emailVerified, displayName: authDisplayName } = firebaseUser;
    const createdAt = Timestamp.now();

    // Destructure with care for potentially missing fields in additionalData
    const {
        role: additionalRole,
        firstName: additionalFirstName,
        lastName: additionalLastName,
        phoneNumber: additionalPhoneNumber, // This will be string or null from earlier processing
        address: additionalAddress,         // This will be string or null from earlier processing
        isAcceptingBookings: additionalIsAcceptingBookings
    } = additionalData;


    let calculatedDisplayName = '';
    // Use additionalFirstName and additionalLastName directly for display name calculation
    if (additionalFirstName && additionalFirstName.trim() !== "" && additionalLastName && additionalLastName.trim() !== "") {
      calculatedDisplayName = `${additionalFirstName.trim()} ${additionalLastName.trim()}`;
    } else if (additionalFirstName && additionalFirstName.trim() !== "") {
      calculatedDisplayName = additionalFirstName.trim();
    } else if (additionalLastName && additionalLastName.trim() !== "") {
      calculatedDisplayName = additionalLastName.trim();
    }

    let finalDisplayName = calculatedDisplayName;

    if ((!finalDisplayName || finalDisplayName.trim() === "") && authDisplayName && authDisplayName.trim() !== "" && authDisplayName.toLowerCase() !== "undefined undefined") {
        if (!(calculatedDisplayName && calculatedDisplayName.trim() !== "" && calculatedDisplayName.includes('@'))) {
             finalDisplayName = authDisplayName;
        }
    }
    
    if (!finalDisplayName || finalDisplayName.trim() === "" || finalDisplayName.toLowerCase() === "undefined undefined") {
        finalDisplayName = email ? email.split('@')[0] : `User_${firebaseUser.uid.substring(0,5)}`;
    }


    try {
      const userDataToSetTemp: { [key: string]: any } = {
        uid: firebaseUser.uid,
        email,
        displayName: finalDisplayName.trim(),
        emailVerified,
        createdAt,
        updatedAt: createdAt,
        role: additionalRole || null,
        firstName: additionalFirstName && additionalFirstName.trim() !== "" ? additionalFirstName.trim() : null,
        lastName: additionalLastName && additionalLastName.trim() !== "" ? additionalLastName.trim() : null,
        phoneNumber: additionalPhoneNumber, // Already string or null
        address: additionalAddress,         // Already string or null
        fcmToken: null,
      };

      if (additionalRole === 'barber') {
        userDataToSetTemp.isAcceptingBookings = additionalIsAcceptingBookings !== undefined ? additionalIsAcceptingBookings : true;
      }
      
      Object.keys(userDataToSetTemp).forEach(key => {
        if (userDataToSetTemp[key] === undefined) {
          delete userDataToSetTemp[key];
        }
      });
      
      delete (userDataToSetTemp as any).password_original_do_not_use;

      await setDoc(userRef, userDataToSetTemp as Partial<AppUser>);
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
            displayName: firestoreUser.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || `User_${firebaseUser.uid.substring(0,5)}`,
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
           const roleFromStorage = localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) as UserRole | null;
           const basicProfileData: Partial<AppUser> = {
              role: roleFromStorage,
           };
          await createUserDocument(firebaseUser, basicProfileData);
          const newUserDocSnap = await getDoc(userDocRef);
          if (newUserDocSnap.exists()) {
            const firestoreUser = newUserDocSnap.data() as AppUser;
             const appUser: AppUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                displayName: firestoreUser.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || `User_${firebaseUser.uid.substring(0,5)}`,
                emailVerified: firebaseUser.emailVerified,
                ...firestoreUser
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
     userDetails: Omit<AppUser, 'uid' | 'createdAt' | 'updatedAt' | 'displayName' | 'emailVerified' | 'fcmToken'> & { password_original_do_not_use: string }
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
        phoneNumber: phoneNumber, // Will be string or null from form processing
        address: address,         // Will be string or null from form processing
        email,
      };
      if (userRole === 'barber') {
        firestoreData.isAcceptingBookings = isAcceptingBookings !== undefined ? isAcceptingBookings : true;
      }

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
       toast({
        title: "Check Your Email",
        description: "If an account exists for this email, a password reset link has been sent.",
      });
    } catch (error: any) {
      console.error("AuthContext: Error sending password reset email:", error);
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
      const dataToUpdate: any = { ...updates, updatedAt: Timestamp.now() };

      // Ensure empty strings for optional fields become null
      dataToUpdate.phoneNumber = updates.phoneNumber === '' ? null : updates.phoneNumber;
      dataToUpdate.address = updates.address === '' ? null : updates.address;
      
      // Ensure required fields are not empty strings, convert to null if they somehow are
      dataToUpdate.firstName = updates.firstName && updates.firstName.trim() !== "" ? updates.firstName.trim() : null;
      dataToUpdate.lastName = updates.lastName && updates.lastName.trim() !== "" ? updates.lastName.trim() : null;


      if (updates.firstName !== undefined || updates.lastName !== undefined) {
        const currentDataSnap = await getDoc(userRef);
        const currentData = currentDataSnap.data() as AppUser | undefined;

        const newFirstName = dataToUpdate.firstName || currentData?.firstName?.trim();
        const newLastName = dataToUpdate.lastName || currentData?.lastName?.trim();
        
        let newDisplayName = '';
        if (newFirstName && newLastName) {
            newDisplayName = `${newFirstName} ${newLastName}`;
        } else if (newFirstName) {
            newDisplayName = newFirstName;
        } else if (newLastName) {
            newDisplayName = newLastName;
        } else {
            newDisplayName = currentData?.email?.split('@')[0] || `User_${userId.substring(0,5)}`;
        }
        dataToUpdate.displayName = newDisplayName.trim();
      }


      await updateDoc(userRef, dataToUpdate);

      setUser(prevUser => {
        if (!prevUser) return null;
        const updatedUserFields = { ...prevUser, ...dataToUpdate };
        if (dataToUpdate.updatedAt instanceof Timestamp) {
            updatedUserFields.updatedAt = dataToUpdate.updatedAt;
        }

        const updatedUser = {
            ...prevUser, 
            ...updates, 
            firstName: dataToUpdate.firstName, // Use the processed value
            lastName: dataToUpdate.lastName,   // Use the processed value
            phoneNumber: dataToUpdate.phoneNumber, // Use the processed value
            address: dataToUpdate.address,       // Use the processed value
            displayName: dataToUpdate.displayName || prevUser.displayName, 
            updatedAt: dataToUpdate.updatedAt, 
        };
        persistUserSession(updatedUser);
        return updatedUser;
      });
    } catch (error: any) {
      console.error("AuthContext: Error updating user profile:", error);
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

