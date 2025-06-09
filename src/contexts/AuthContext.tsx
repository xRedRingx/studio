
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
  resetOtpState: () => void; 
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

  // Store verifier instances in state to manage their lifecycle
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
            ...(firebaseUser as unknown as FirebaseUser), 
            ...appUserData,
            phoneNumber: appUserData.phoneNumber || firebaseUser.phoneNumber || '', 
            email: null, 
          };
          setUser(appUser);
          if (appUser.role && !role) { 
             setRoleContextAndStorage(appUser.role);
          }
        } else {
           if (pendingUserDetails && firebaseUser.phoneNumber === pendingUserDetails.phoneNumber) {
             await createUserDocument(firebaseUser, pendingUserDetails.firstName, pendingUserDetails.lastName, pendingUserDetails.role);
             setPendingUserDetails(null); 
           } else {
            console.warn("Authenticated user document not found in Firestore and no pending details for user:", firebaseUser.uid);
            const minimalAppUser: AppUser = {
              ...(firebaseUser as unknown as FirebaseUser), 
              phoneNumber: firebaseUser.phoneNumber || 'UNKNOWN_PHONE',
              email: null,
              role: role || undefined, 
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
  }, [role, pendingUserDetails]); 

  const setRoleContextAndStorage = (newRole: UserRole) => {
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, newRole);
    setRoleState(newRole);
  };
  
  const initializeRecaptchaVerifier = async (
    recaptchaContainerId: string, 
    isRegistration: boolean
  ): Promise<RecaptchaVerifier> => {
    let verifierRef = isRegistration ? registerRecaptchaVerifier : loginRecaptchaVerifier;
    
    if (verifierRef) {
      try {
        verifierRef.clear();
      } catch (e) {
        console.warn("Error clearing old reCAPTCHA verifier:", e);
      }
    }
    
    const recaptchaContainer = document.getElementById(recaptchaContainerId);
    if (!recaptchaContainer) {
      setIsSendingOtp(false);
      toast({ title: "Setup Error", description: `reCAPTCHA container with id '${recaptchaContainerId}' not found. Ensure it's rendered in your form.`, variant: "destructive" });
      throw new Error(`reCAPTCHA container with id '${recaptchaContainerId}' not found.`);
    }
    recaptchaContainer.innerHTML = ''; // Explicitly clear the container before initializing a new one

    const newVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      'size': 'invisible', 
      'callback': (response: any) => {
        console.log("reCAPTCHA verified (invisible flow successful):", response);
      },
      'expired-callback': () => {
        toast({ title: "reCAPTCHA Expired", description: "Please try sending the OTP again.", variant: "destructive" });
        setIsSendingOtp(false); 
        if (isRegistration) {
          setRegisterRecaptchaVerifier(null); // Reset state ref
        } else {
          setLoginRecaptchaVerifier(null); // Reset state ref
        }
      },
      'error-callback': (error: any) => {
        console.error("reCAPTCHA error-callback:", error);
        toast({ title: "reCAPTCHA Error", description: `Failed to initialize or verify reCAPTCHA. ${error?.message || 'Please try again.'}`, variant: "destructive" });
        setIsSendingOtp(false);
      }
    });
    
    if (isRegistration) {
      setRegisterRecaptchaVerifier(newVerifier);
    } else {
      setLoginRecaptchaVerifier(newVerifier);
    }

    try {
      await newVerifier.render(); 
      console.log(`reCAPTCHA verifier rendered for ${recaptchaContainerId}`);
    } catch (renderError) {
      console.error("Error rendering reCAPTCHA:", renderError);
      toast({ title: "reCAPTCHA Render Error", description: "Could not render reCAPTCHA. Check console for details and ensure Firebase/GCP reCAPTCHA configuration is correct (including authorized domains).", variant: "destructive" });
      setIsSendingOtp(false);
      throw renderError; 
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
    setOtpSent(false); 
    console.log(`Attempting to send OTP to: ${phoneNumber}. Is Registration: ${isRegistration}`);

    try {
      const verifier = await initializeRecaptchaVerifier(recaptchaContainerId, isRegistration);
      const result = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(result);
      setOtpSent(true);
      if (isRegistration && userDetails) {
        setPendingUserDetails({ ...userDetails, phoneNumber });
      }
      toast({ title: "OTP Sent", description: `An OTP has been sent to ${phoneNumber}.` });
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      let description = "Failed to send OTP. Please check the phone number and try again.";
      if (error.code === 'auth/invalid-phone-number') {
        description = "The phone number format is invalid. Please use E.164 format (e.g., +12223334444).";
      } else if (error.code === 'auth/too-many-requests') {
        description = "Too many OTP requests. Please try again later.";
      } else if (error.code === 'auth/internal-error') {
        description = "An internal Firebase error occurred. Please ensure reCAPTCHA is correctly configured in your Firebase & Google Cloud project (including authorized domains for your reCAPTCHA key) and that Phone Auth is enabled with all necessary APIs. Check the browser console for more details.";
      } else if (error.message && error.message.includes("reCAPTCHA placeholder element")) {
        description = `reCAPTCHA setup error: Could not find element '${recaptchaContainerId}'. Ensure it's rendered.`;
      } else if (error.message) {
        description = error.message;
      }
      toast({ title: "OTP Send Error", description, variant: "destructive" });
      setOtpSent(false); 
      
      const verifierToClear = isRegistration ? registerRecaptchaVerifier : loginRecaptchaVerifier;
      verifierToClear?.clear();
      if (isRegistration) setRegisterRecaptchaVerifier(null); else setLoginRecaptchaVerifier(null);

    } finally {
      setIsSendingOtp(false);
    }
  };

  const createUserDocument = async (firebaseUser: FirebaseUserType, firstName: string, lastName: string, userRole: UserRole) => {
    const appUser: AppUser = {
      ...(firebaseUser as unknown as FirebaseUser), 
      firstName,
      lastName,
      role: userRole,
      phoneNumber: firebaseUser.phoneNumber || pendingUserDetails?.phoneNumber || 'UNKNOWN_PHONE',
      email: null, 
    };
    await setDoc(doc(firestore, "users", firebaseUser.uid), {
      uid: firebaseUser.uid,
      phoneNumber: appUser.phoneNumber,
      email: null, 
      role: userRole,
      firstName,
      lastName,
      createdAt: new Date().toISOString(), 
    });
    setUser(appUser);
    if (appUser.role) setRoleContextAndStorage(appUser.role); 
  };

  const confirmOtp = async (otp: string) => {
    if (!confirmationResult) {
      toast({ title: "Verification Error", description: "No OTP request found. Please request an OTP first.", variant: "destructive" });
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const credential = await confirmationResult.confirm(otp);
      const firebaseUser = credential.user; 

      if (pendingUserDetails && firebaseUser.phoneNumber === pendingUserDetails.phoneNumber) {
        await createUserDocument(firebaseUser, pendingUserDetails.firstName, pendingUserDetails.lastName, pendingUserDetails.role);
        setPendingUserDetails(null); 
         toast({ title: "Registration Successful!", description: "You can now log in." });
      } else {
        const userDocRef = doc(firestore, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const appUserData = userDocSnap.data() as Omit<AppUser, keyof FirebaseUserType>;
          const appUser: AppUser = {
            ...(firebaseUser as unknown as FirebaseUser),
            ...appUserData,
            phoneNumber: appUserData.phoneNumber || firebaseUser.phoneNumber || '',
            email: null,
          };
          setUser(appUser);
          if (appUser.role) setRoleContextAndStorage(appUser.role);
          toast({ title: "Login Successful!", description: "You've been successfully logged in." });
        } else {
           console.error("User document not found after OTP confirmation for login.");
           toast({ title: "Login Error", description: "User profile not found. Please contact support.", variant: "destructive" });
        }
      }
      setOtpSent(false); 
    } catch (error: any) {
      console.error("Error confirming OTP:", error);
      let description = "Invalid OTP or an error occurred. Please try again.";
      if (error.code === 'auth/invalid-verification-code') {
        description = "The OTP entered is invalid. Please check and try again.";
      } else if (error.code === 'auth/code-expired') {
        description = "The OTP has expired. Please request a new one.";
      } else if (error.code === 'auth/internal-error') {
        description = "An internal Firebase error occurred during OTP verification. Please try again or contact support if the issue persists.";
      } else if (error.message) {
        description = error.message;
      }
      toast({ title: "OTP Verification Failed", description, variant: "destructive" });
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
    
    loginRecaptchaVerifier?.clear();
    setLoginRecaptchaVerifier(null);
    registerRecaptchaVerifier?.clear();
    setRegisterRecaptchaVerifier(null);
  };

  const signOutUser = () => {
    return firebaseSignOut(auth).then(() => {
      setUser(null);
      // Do not reset role from localStorage on sign out, user might want to log back in as same role.
      // Role selector on root page will handle if no role is set.
      resetOtpState(); 
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
      resetOtpState 
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
