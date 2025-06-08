
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
            email: null, // Email is not used
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

  const initializeRecaptchaVerifier = (recaptchaContainerId: string, isRegistration: boolean): RecaptchaVerifier => {
    let verifier = isRegistration ? registerRecaptchaVerifier : loginRecaptchaVerifier;
    if (verifier) {
      try {
        verifier.clear(); // Clear previous instance
      } catch (e) {
        console.warn("Error clearing old reCAPTCHA verifier:", e);
      }
    }
    
    const recaptchaContainer = document.getElementById(recaptchaContainerId);
    if (!recaptchaContainer) {
      setIsSendingOtp(false); // Reset sending state
      toast({ title: "Setup Error", description: `reCAPTCHA container with id '${recaptchaContainerId}' not found. Ensure it's rendered in your form.`, variant: "destructive" });
      throw new Error(`reCAPTCHA container with id '${recaptchaContainerId}' not found.`);
    }
    // Ensure the container is empty before creating a new verifier
    while (recaptchaContainer.firstChild) {
        recaptchaContainer.removeChild(recaptchaContainer.firstChild);
    }

    const newVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      'size': 'invisible', 
      'callback': (response: any) => {
        console.log("reCAPTCHA verified (callback):", response);
      },
      'expired-callback': () => {
        toast({ title: "reCAPTCHA Expired", description: "Please try sending the OTP again.", variant: "destructive" });
        setIsSendingOtp(false); 
        if (isRegistration) {
          registerRecaptchaVerifier?.clear();
          setRegisterRecaptchaVerifier(null);
        } else {
          loginRecaptchaVerifier?.clear();
          setLoginRecaptchaVerifier(null);
        }
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
    setOtpSent(false); 
    try {
      const verifier = initializeRecaptchaVerifier(recaptchaContainerId, isRegistration);
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
        description = "The phone number format is invalid. Please include the country code (e.g., +12223334444).";
      } else if (error.code === 'auth/too-many-requests') {
        description = "Too many OTP requests. Please try again later.";
      } else if (error.code === 'auth/internal-error') {
        description = "An internal error occurred. Please ensure reCAPTCHA is correctly configured in your Firebase project and try again.";
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
        } else {
           console.error("User document not found after OTP confirmation for login.");
           toast({ title: "Login Error", description: "User profile not found. Please contact support.", variant: "destructive" });
        }
      }
      
      toast({ title: "Success!", description: "You've been successfully verified." });
      setOtpSent(false); 
    } catch (error: any) {
      console.error("Error confirming OTP:", error);
      let description = "Invalid OTP or an error occurred. Please try again.";
      if (error.code === 'auth/invalid-verification-code') {
        description = "The OTP entered is invalid. Please check and try again.";
      } else if (error.code === 'auth/code-expired') {
        description = "The OTP has expired. Please request a new one.";
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

