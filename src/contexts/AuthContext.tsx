
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut as firebaseSignOut,
  type ConfirmationResult,
  type User as FirebaseUserType,
} from 'firebase/auth';
import { auth, firestore } from '@/firebase/config';
import type { AppUser, UserRole, FirebaseUser } from '@/types';
import { LOCAL_STORAGE_ROLE_KEY } from '@/lib/constants';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: AppUser | null;
  role: UserRole | null;
  loadingAuth: boolean;
  initialRoleChecked: boolean;
  isSendingOtp: boolean;
  isVerifyingOtp: boolean;
  otpSent: boolean;
  setRole: (role: UserRole) => void;
  sendOtp: (
    phoneNumber: string, 
    recaptchaContainerId: string,
    isRegistration: boolean, 
    userDetails?: { firstName: string; lastName: string; role: UserRole }
  ) => Promise<void>;
  confirmOtp: (otp: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetOtpState: () => void; // Ensure this is here
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [initialRoleChecked, setInitialRoleChecked] = useState(false);
  
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [pendingUserDetails, setPendingUserDetails] = useState<{ firstName: string; lastName: string; phoneNumber: string; role: UserRole } | null>(null);

  const { toast } = useToast();

  const [loginRecaptchaVerifier, setLoginRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const [registerRecaptchaVerifier, setRegisterRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);


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
          const appUserData = userDocSnap.data() as Omit<AppUser, keyof FirebaseUserType>;
          const appUser: AppUser = {
            ...(firebaseUser as unknown as FirebaseUser), // This might be problematic if FirebaseUserType isn't perfectly aligned
            ...appUserData,
            phoneNumber: appUserData.phoneNumber || firebaseUser.phoneNumber || '', 
            email: appUserData.email || firebaseUser.email || null, // Keep email if it exists, otherwise null
          };
          setUser(appUser);
          if (appUser.role && !role) { // Only set role from doc if not already set (e.g. from localStorage)
             setRoleContextAndStorage(appUser.role);
          }
        } else {
           // This case might happen if user is authenticated but Firestore doc creation failed/pending
           // Or if it's a new user post-OTP but before Firestore doc is created
           if (pendingUserDetails && firebaseUser.phoneNumber === pendingUserDetails.phoneNumber) {
             // This is a registration that just completed OTP verification
             await createUserDocument(firebaseUser, pendingUserDetails.firstName, pendingUserDetails.lastName, pendingUserDetails.role);
             setPendingUserDetails(null); // Clear pending details
           } else {
            // If no pending details, treat as an issue or incomplete registration
            console.warn("Authenticated user document not found in Firestore and no pending details for user:", firebaseUser.uid);
            // Potentially sign out user or prompt for more info
            // For now, create a minimal user object to avoid breaking UI
            const minimalAppUser: AppUser = {
              ...(firebaseUser as unknown as FirebaseUser), // Again, potential alignment issue
              phoneNumber: firebaseUser.phoneNumber || 'UNKNOWN_PHONE',
              email: firebaseUser.email || null,
              role: role || undefined, // Use role from localStorage if available
            };
            setUser(minimalAppUser);
           }
        }
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [role, pendingUserDetails]); // Added pendingUserDetails as a dependency

  const setRoleContextAndStorage = (newRole: UserRole) => {
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, newRole);
    setRoleState(newRole);
  };

  const initializeRecaptchaVerifier = (recaptchaContainerId: string, isRegistration: boolean): RecaptchaVerifier => {
    let verifier = isRegistration ? registerRecaptchaVerifier : loginRecaptchaVerifier;
    if (verifier) {
      // Attempt to clear previous instance if element is gone or to reset
      try {
        verifier.clear();
      } catch (e) {
        console.warn("Error clearing old reCAPTCHA verifier:", e);
      }
    }
    
    const recaptchaContainer = document.getElementById(recaptchaContainerId);
    if (!recaptchaContainer) {
      // This should ideally not happen if IDs are correct and elements mounted
      throw new Error(`reCAPTCHA container with id '${recaptchaContainerId}' not found.`);
    }
    // Ensure it's empty before creating a new verifier to avoid Firebase errors
    while (recaptchaContainer.firstChild) {
        recaptchaContainer.removeChild(recaptchaContainer.firstChild);
    }


    const newVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      'size': 'invisible', // Firebase phone auth usually uses invisible reCAPTCHA
      'callback': (response: any) => {
        // reCAPTCHA solved, allow signInWithPhoneNumber.
        // This callback is for when the reCAPTCHA is explicitly solved by the user,
        // which usually doesn't happen with 'invisible' size until signInWithPhoneNumber is called.
        console.log("reCAPTCHA verified (callback):", response);
      },
      'expired-callback': () => {
        // Response expired. Ask user to solve reCAPTCHA again.
        toast({ title: "reCAPTCHA Expired", description: "Please try sending the OTP again.", variant: "destructive" });
        setIsSendingOtp(false); // Allow user to retry
        // Consider resetting the verifier instance here too
      }
    });
    
    if (isRegistration) {
      setRegisterRecaptchaVerifier(newVerifier);
    } else {
      setLoginRecaptchaVerifier(newVerifier);
    }
    return newVerifier;
  };
  
  const sendOtp = async (
    phoneNumber: string, 
    recaptchaContainerId: string,
    isRegistration: boolean,
    userDetails?: { firstName: string; lastName: string; role: UserRole }
  ) => {
    setIsSendingOtp(true);
    setOtpSent(false); // Ensure otpSent is false before attempting to send
    try {
      const verifier = initializeRecaptchaVerifier(recaptchaContainerId, isRegistration);
      // signInWithPhoneNumber will trigger the reCAPTCHA challenge if necessary
      const result = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(result);
      setOtpSent(true);
      if (isRegistration && userDetails) {
        // Store details to be used after OTP confirmation for creating user doc
        setPendingUserDetails({ ...userDetails, phoneNumber });
      }
      toast({ title: "OTP Sent", description: `An OTP has been sent to ${phoneNumber}.` });
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      toast({ title: "OTP Send Error", description: error.message || "Failed to send OTP. Please check the phone number and try again.", variant: "destructive" });
      setOtpSent(false); // Explicitly set to false on error
      // Attempt to clear verifier on error to allow retry
      const verifierToClear = isRegistration ? registerRecaptchaVerifier : loginRecaptchaVerifier;
      verifierToClear?.clear();
      if (isRegistration) setRegisterRecaptchaVerifier(null); else setLoginRecaptchaVerifier(null);

    } finally {
      setIsSendingOtp(false);
    }
  };

  const createUserDocument = async (firebaseUser: FirebaseUserType, firstName: string, lastName: string, userRole: UserRole) => {
    // Construct the AppUser object for our application state
    const appUser: AppUser = {
      ...(firebaseUser as unknown as FirebaseUser), // This casts, ensure FirebaseUser is compatible
      firstName,
      lastName,
      role: userRole,
      // Ensure phoneNumber is correctly sourced, prioritizing the verified one.
      phoneNumber: firebaseUser.phoneNumber || pendingUserDetails?.phoneNumber || 'UNKNOWN_PHONE',
      email: null, // Explicitly set email to null as per new requirement
    };
    // Create the document in Firestore
    await setDoc(doc(firestore, "users", firebaseUser.uid), {
      uid: firebaseUser.uid,
      phoneNumber: appUser.phoneNumber,
      email: null, // Save null for email
      role: userRole,
      firstName,
      lastName,
      createdAt: new Date().toISOString(), // Use ISO string for consistency
    });
    // Update the local user state
    setUser(appUser);
    if (appUser.role) setRoleContextAndStorage(appUser.role); // Update role in localStorage
  };

  const confirmOtp = async (otp: string) => {
    if (!confirmationResult) {
      toast({ title: "Verification Error", description: "No OTP request found. Please request an OTP first.", variant: "destructive" });
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const credential = await confirmationResult.confirm(otp);
      const firebaseUser = credential.user; // FirebaseUser from auth

      // At this point, onAuthStateChanged should pick up the new user.
      // If it's a registration, we need to ensure the Firestore document is created.
      if (pendingUserDetails && firebaseUser.phoneNumber === pendingUserDetails.phoneNumber) {
        // This is a registration flow, createUserDocument will be called by onAuthStateChanged logic
        // or we can call it here to be more explicit and ensure it happens before toast.
        // Calling it here ensures the appUser state is updated with full details immediately.
        await createUserDocument(firebaseUser, pendingUserDetails.firstName, pendingUserDetails.lastName, pendingUserDetails.role);
        setPendingUserDetails(null); // Clear pending details as they are now processed
      } else {
        // This is a login flow. User document should exist.
        // onAuthStateChanged will fetch it. We can fetch it here too for immediate state update if needed.
        const userDocRef = doc(firestore, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const appUserData = userDocSnap.data() as Omit<AppUser, keyof FirebaseUserType>;
          const appUser: AppUser = {
            ...(firebaseUser as unknown as FirebaseUser),
            ...appUserData,
            phoneNumber: appUserData.phoneNumber || firebaseUser.phoneNumber || '',
            email: appUserData.email || firebaseUser.email || null,
          };
          setUser(appUser);
          if (appUser.role) setRoleContextAndStorage(appUser.role);
        } else {
          // Should not happen for login if user exists
          console.error("User document not found after OTP confirmation for login.");
           toast({ title: "Login Error", description: "User profile not found. Please contact support.", variant: "destructive" });
           // Don't set user, let onAuthStateChanged handle it or redirect.
        }
      }
      
      toast({ title: "Success!", description: "You've been successfully verified." });
      setOtpSent(false); // Reset otpSent after successful verification
      // Navigation will be handled by the form component's useEffect watching the user state
    } catch (error: any) {
      console.error("Error confirming OTP:", error);
      toast({ title: "OTP Verification Failed", description: error.message || "Invalid OTP or an error occurred. Please try again.", variant: "destructive" });
      // Do not clear confirmationResult here, user might want to retry with same OTP request if it was a typo
    } finally {
      setIsVerifyingOtp(false);
    }
  };
  
  const resetOtpState = () => {
    setOtpSent(false);
    setConfirmationResult(null);
    setIsSendingOtp(false);
    setIsVerifyingOtp(false);
    setPendingUserDetails(null);
    // Clear reCAPTCHA verifiers
    loginRecaptchaVerifier?.clear();
    setLoginRecaptchaVerifier(null);
    registerRecaptchaVerifier?.clear();
    setRegisterRecaptchaVerifier(null);
    // Also, re-create the reCAPTCHA containers if needed, or ensure they are ready for re-initialization
    // This might involve removing and re-adding the recaptcha-container divs or ensuring they are empty
  };

  const signOutUser = () => {
    return firebaseSignOut(auth).then(() => {
      setUser(null);
      // Do NOT reset role from localStorage on sign out.
      // setRoleState(null); 
      // localStorage.removeItem(LOCAL_STORAGE_ROLE_KEY);
      resetOtpState(); // Also reset OTP state on sign out
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user, role, loadingAuth, initialRoleChecked, 
      isSendingOtp, isVerifyingOtp, otpSent,
      setRole: setRoleContextAndStorage, 
      sendOtp, 
      confirmOtp, 
      signOut: signOutUser,
      resetOtpState // Make sure resetOtpState is included here
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

