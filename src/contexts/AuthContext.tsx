
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

// Define reCAPTCHA container IDs at a higher scope
const RECAPTCHA_LOGIN_ID = 'recaptcha-container-login';
const RECAPTCHA_REGISTER_ID = 'recaptcha-container-register';


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

  const resetOtpState = useCallback(() => {
    console.log("AuthContext: Resetting OTP state and verifiers.");
    setOtpSent(false);
    setConfirmationResult(null);
    setIsSendingOtp(false);
    setIsVerifyingOtp(false);
    setPendingUserDetails(null);

    const clearVerifier = (verifier: RecaptchaVerifier | null, setVerifier: React.Dispatch<React.SetStateAction<RecaptchaVerifier | null>>, containerId: string) => {
        if (verifier) {
            try {
                verifier.clear();
                console.log(`AuthContext: Cleared verifier for ${containerId}`);
            } catch (e) {
                console.warn(`AuthContext: Error clearing verifier for ${containerId}:`, e);
            }
            setVerifier(null);
        }
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
            console.log(`AuthContext: Manually cleared DOM for ${containerId}`);
        }
    };
    
    clearVerifier(loginRecaptchaVerifier, setLoginRecaptchaVerifier, RECAPTCHA_LOGIN_ID);
    clearVerifier(registerRecaptchaVerifier, setRegisterRecaptchaVerifier, RECAPTCHA_REGISTER_ID);
    
  }, [loginRecaptchaVerifier, registerRecaptchaVerifier]);

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
          const appUserData = userDocSnap.data() as Partial<AppUser>;
          const appUser: AppUser = {
            ...(firebaseUser as unknown as FirebaseUser),
            ...appUserData,
            phoneNumber: appUserData.phoneNumber || firebaseUser.phoneNumber || '',
            email: appUserData.email === undefined ? null : appUserData.email,
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
            console.warn("AuthContext: Authenticated user document not found and no pending details for user:", firebaseUser.uid);
            const minimalAppUser: AppUser = {
              ...(firebaseUser as unknown as FirebaseUser),
              phoneNumber: firebaseUser.phoneNumber || 'UNKNOWN_PHONE',
              email: null, // FirebaseUserType may not have email, ensure it's nullable
              role: role || undefined, // Use existing role or undefined
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
  
  const initializeRecaptchaVerifier = useCallback(async (
    recaptchaContainerId: string,
    isRegistration: boolean
  ): Promise<RecaptchaVerifier> => {
    let currentVerifier = isRegistration ? registerRecaptchaVerifier : loginRecaptchaVerifier;

    const recaptchaContainer = document.getElementById(recaptchaContainerId);
    if (!recaptchaContainer) {
      toast({ title: "Setup Error", description: `reCAPTCHA container '${recaptchaContainerId}' not found.`, variant: "destructive" });
      throw new Error(`reCAPTCHA container '${recaptchaContainerId}' not found.`);
    }

    if (currentVerifier) {
      console.log(`AuthContext: Using existing reCAPTCHA verifier for ${recaptchaContainerId}`);
      return currentVerifier;
    }
    
    console.log(`AuthContext: Initializing new reCAPTCHA verifier for ${recaptchaContainerId}`);
    const newVerifier = new RecaptchaVerifier(auth, recaptchaContainer, {
      'size': 'invisible',
      'callback': () => {
        console.log("AuthContext: reCAPTCHA challenge successful.");
      },
      'expired-callback': () => {
        console.warn("AuthContext: reCAPTCHA expired, resetting state.");
        toast({ title: "reCAPTCHA Expired", description: "Please try sending the OTP again.", variant: "destructive" });
        resetOtpState();
      },
    });

    const setVerifierState = isRegistration ? setRegisterRecaptchaVerifier : setLoginRecaptchaVerifier;
    setVerifierState(newVerifier);
    
    // It's generally recommended to render the verifier explicitly
    // especially if it's invisible, to ensure it's ready.
    try {
        await newVerifier.render();
        console.log(`AuthContext: reCAPTCHA verifier rendered for ${recaptchaContainerId}`);
    } catch (renderError) {
        console.error(`AuthContext: Error rendering reCAPTCHA for ${recaptchaContainerId}:`, renderError);
        toast({ title: "reCAPTCHA Error", description: "Could not initialize reCAPTCHA. Please refresh and try again.", variant: "destructive" });
        // Potentially reset the specific verifier state here if render fails
        setVerifierState(null); 
        throw renderError; // re-throw to be caught by sendOtp
    }
    

    return newVerifier;
  }, [toast, loginRecaptchaVerifier, registerRecaptchaVerifier, resetOtpState]);


  const sendOtp = async (
    phoneNumber: string,
    recaptchaContainerId: string,
    isRegistration: boolean,
    userDetails?: { firstName: string; lastName: string; role: UserRole }
  ) => {
    setIsSendingOtp(true);
    setOtpSent(false);

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
      console.error(`AuthContext: Error sending OTP:`, error);
      let description = "Failed to send OTP. Please check the phone number and try again.";
      if (error.code === 'auth/invalid-phone-number') {
        description = "The phone number format is invalid. Please use E.164 format (e.g., +12223334444).";
      } else if (error.code === 'auth/too-many-requests') {
        description = "Too many OTP requests. Please wait before trying again.";
      } else if (error.message && error.message.includes('auth/requests-from-referer') && error.message.includes('are-blocked')) {
        const blockedRefererMatch = error.message.match(/https?:\/\/([^ ]+)\sare\sblocked/i);
        const blockedReferer = blockedRefererMatch ? `https://${blockedRefererMatch[1]}` : "your current domain";
        description = `Firebase API requests from ${blockedReferer} are blocked. CRITICAL: Check the "API restrictions" (specifically "HTTP referrers") for your Firebase Web API Key (AIza...) in Google Cloud Console. Add "${blockedReferer}" to the allowed list.`;
      } else if (error.code === 'auth/invalid-app-credential') {
        description = "Firebase authentication failed: Invalid App Credential. This usually means your Firebase project setup for Phone Auth is incomplete. Please ensure the 'Phone' sign-in provider is enabled in Firebase Console > Authentication > Sign-in method, and that the Identity Platform API is enabled in Google Cloud Console for your project.";
      }
      toast({ title: "OTP Send Error", description, variant: "destructive", duration: 9000 });
      resetOtpState(); // This should also clear reCAPTCHA for a retry
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
      email: firebaseUser.email === undefined ? null : firebaseUser.email, // Handle potential undefined email
    };
    await setDoc(doc(firestore, "users", firebaseUser.uid), {
      uid: firebaseUser.uid,
      phoneNumber: appUser.phoneNumber,
      email: appUser.email,
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
        // User logged in, fetch their data if not registering
        const userDocRef = doc(firestore, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const appUserData = userDocSnap.data() as Partial<AppUser>;
           const appUser: AppUser = {
            ...(firebaseUser as unknown as FirebaseUser),
            ...appUserData,
            phoneNumber: appUserData.phoneNumber || firebaseUser.phoneNumber || '',
            email: appUserData.email === undefined ? null : appUserData.email,
          };
          setUser(appUser);
          if (appUser.role && (!role || role !== appUser.role)) { // Update role if needed
             setRoleContextAndStorage(appUser.role);
          }
        } else {
             console.warn("AuthContext: User document not found after login for UID:", firebaseUser.uid);
             // Fallback: create a minimal user object if doc is missing for some reason
              const minimalAppUser: AppUser = {
                ...(firebaseUser as unknown as FirebaseUser),
                phoneNumber: firebaseUser.phoneNumber || 'UNKNOWN_PHONE',
                email: firebaseUser.email === undefined ? null : firebaseUser.email,
                role: role || undefined, 
              };
              setUser(minimalAppUser);
        }
        toast({ title: "Login Successful!", description: "You've been successfully logged in." });
      }
    } catch (error: any) {
      console.error(`AuthContext: Error confirming OTP:`, error);
      let description = "Invalid OTP or an error occurred. Please try again.";
      if (error.code === 'auth/invalid-verification-code') {
        description = "The OTP entered is invalid. Please check and try again.";
      } else if (error.code === 'auth/code-expired') {
        description = "The OTP has expired. Please request a new one.";
      }
      toast({ title: "OTP Verification Failed", description, variant: "destructive" });
    } finally {
      setIsVerifyingOtp(false);
       // resetOtpState(); // Consider if OTP state should be reset on confirm, usually yes.
    }
  };

  const signOutUser = () => {
    return firebaseSignOut(auth).then(() => {
      setUser(null);
      // Do not clear the role from localStorage on sign out, as per "Role remembered with no switching"
      resetOtpState(); // Reset OTP related states
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


    