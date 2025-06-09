
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
            console.warn("AuthContext: Authenticated user document not found in Firestore and no pending details for user:", firebaseUser.uid);
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
  
  const initializeRecaptchaVerifier = useCallback(async (
    recaptchaContainerId: string, 
    isRegistration: boolean
  ): Promise<RecaptchaVerifier> => {
    let currentVerifier = isRegistration ? registerRecaptchaVerifier : loginRecaptchaVerifier;
    const setVerifierState = isRegistration ? setRegisterRecaptchaVerifier : setLoginRecaptchaVerifier;

    const recaptchaContainer = document.getElementById(recaptchaContainerId);
    if (!recaptchaContainer) {
      toast({ title: "Setup Error", description: `reCAPTCHA container '${recaptchaContainerId}' not found.`, variant: "destructive" });
      throw new Error(`reCAPTCHA container '${recaptchaContainerId}' not found.`);
    }
    
    if (currentVerifier) {
      try {
        currentVerifier.clear(); 
        console.log(`AuthContext: Cleared existing reCAPTCHA verifier for ${recaptchaContainerId}`);
      } catch (e) {
        console.warn("AuthContext: Error clearing old reCAPTCHA verifier:", e);
      }
    }
    
    recaptchaContainer.innerHTML = ''; 
    console.log(`AuthContext: Initializing new reCAPTCHA verifier for ${recaptchaContainerId}`);
    
    const newVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      'size': 'invisible',
      'remoteConfig': true, 
      'callback': (response: any) => {
        console.log("AuthContext: reCAPTCHA challenge successful (invisible flow):", response);
      },
      'expired-callback': () => {
        console.warn("AuthContext: reCAPTCHA expired for", recaptchaContainerId);
        toast({ title: "reCAPTCHA Expired", description: "Please try sending the OTP again.", variant: "destructive" });
        setVerifierState(null); 
      },
      'error-callback': (error: any) => { 
        console.error(`AuthContext: reCAPTCHA error-callback for ${recaptchaContainerId}:`, error);
        toast({ title: "reCAPTCHA Error", description: `reCAPTCHA process failed. ${error?.message || 'Please try again.'}`, variant: "destructive" });
        setVerifierState(null);
      }
    });
    
    try {
      await newVerifier.render(); 
      console.log(`AuthContext: reCAPTCHA verifier rendered for ${recaptchaContainerId}`);
      setVerifierState(newVerifier); 
    } catch (renderError: any) {
      console.error(`AuthContext: Error rendering reCAPTCHA for ${recaptchaContainerId}:`, renderError);
      toast({ title: "reCAPTCHA Render Error", description: `Could not render reCAPTCHA. ${renderError.message || 'Check console and Firebase/GCP setup (authorized domains, API key type).'}`, variant: "destructive" });
      setVerifierState(null); 
      throw renderError; 
    }
    
    return newVerifier;
  }, [auth, toast, loginRecaptchaVerifier, registerRecaptchaVerifier]); 
  
  const sendOtp = async (
    phoneNumber: string, 
    recaptchaContainerId: string,
    isRegistration: boolean,
    userDetails?: { firstName: string; lastName: string; role: UserRole }
  ) => {
    setIsSendingOtp(true);
    setOtpSent(false); 
    console.log(`AuthContext: Attempting to send OTP to: ${phoneNumber}. Is Registration: ${isRegistration}. Using container: ${recaptchaContainerId}`);
    console.log("AuthContext: Verifying phone number format (E.164 expected):", phoneNumber);

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
      console.error(`AuthContext: Error sending OTP (code: ${error.code}, message: ${error.message}):`, error);
      let description = "Failed to send OTP. Please check the phone number and try again.";
      
      if (error.code === 'auth/captcha-check-failed') {
        description = "reCAPTCHA verification failed: Hostname mismatch. CRITICAL: Ensure your current app domain (e.g., 'localhost') is in the 'Authorized Domains' list for your reCAPTCHA *Site Key* (the one starting with '6Lc...' configured for Firebase Phone Auth) in Google Cloud Console. This Site Key is distinct from your Firebase Web API Key (which starts with 'AIza...'). If using App Check with reCAPTCHA Enterprise, also verify the Enterprise key's authorized domains in GCP.";
        console.error("AuthContext: auth/captcha-check-failed. Verify your reCAPTCHA *Site Key's* 'Authorized Domains' in Google Cloud Console. If using Firebase App Check with an Enterprise key, also check that Enterprise key's domain settings.", error);
      } else if (error.code === 'auth/invalid-phone-number') {
        description = "The phone number format is invalid. Please use E.164 format (e.g., +12223334444).";
      } else if (error.code === 'auth/too-many-requests') {
        description = "Too many OTP requests. Please wait a while before trying again. This is a security measure.";
      } else if (error.code === 'auth/internal-error') {
        description = "An internal Firebase error occurred. Please verify Firebase & Google Cloud project configuration: reCAPTCHA key type (v2 vs Enterprise - ensure compatibility with Firebase SDK and its integration with Identity Platform), authorized domains for the reCAPTCHA *Site Key* in GCP, Phone Auth enabled, and Identity Toolkit API active. Ensure the correct APIs are enabled in GCP (Identity Toolkit, Firebase, relevant reCAPTCHA API).";
      } else if (error.code === 'auth/network-request-failed') {
        description = "Network error during OTP request. Check internet connection and ensure no browser extensions or network policies are blocking Google services (like reCAPTCHA).";
      } else if (error.message && error.message.includes("reCAPTCHA placeholder element")) {
        description = `reCAPTCHA setup error: Could not find element '${recaptchaContainerId}'. Ensure it's rendered.`;
      } else if (error.message) {
        description = error.message;
      }
      toast({ title: "OTP Send Error", description, variant: "destructive", duration: 15000 });
      setOtpSent(false); 
      
      const verifierToClear = isRegistration ? registerRecaptchaVerifier : loginRecaptchaVerifier;
      const setVerifierState = isRegistration ? setRegisterRecaptchaVerifier : setLoginRecaptchaVerifier;
      if (verifierToClear) {
        try {
          verifierToClear.clear();
        } catch(e) { console.warn("AuthContext: Error clearing verifier during sendOtp error handling:", e); }
      }
      setVerifierState(null);

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
           console.error("AuthContext: User document not found after OTP confirmation for login. This may occur if registration failed to create the document or if it's a login for a non-existent user.");
           toast({ title: "Login Error", description: "User profile not found. If you're new, please ensure registration completed. Otherwise, contact support.", variant: "destructive" });
        }
      }
      setOtpSent(false); 
    } catch (error: any) {
      console.error(`AuthContext: Error confirming OTP (code: ${error.code}, message: ${error.message}):`, error);
      let description = "Invalid OTP or an error occurred. Please try again.";
      if (error.code === 'auth/invalid-verification-code') {
        description = "The OTP entered is invalid. Please check and try again.";
      } else if (error.code === 'auth/code-expired') {
        description = "The OTP has expired. Please request a new one.";
      } else if (error.code === 'auth/internal-error') {
        description = "An internal Firebase error occurred during OTP verification. Please try again or contact support if the issue persists. Double-check project configurations.";
      } else if (error.message) {
        description = error.message;
      }
      toast({ title: "OTP Verification Failed", description, variant: "destructive" });
    } finally {
      setIsVerifyingOtp(false);
    }
  };
  
  const resetOtpState = useCallback(() => {
    console.log("AuthContext: Resetting OTP state and verifiers.");
    setOtpSent(false);
    setConfirmationResult(null);
    setIsSendingOtp(false);
    setIsVerifyingOtp(false);
    setPendingUserDetails(null);
    
    if (loginRecaptchaVerifier) {
      try { 
        loginRecaptchaVerifier.clear(); 
        console.log("AuthContext: Login reCAPTCHA verifier cleared.");
      } catch(e) { console.warn("AuthContext: Error clearing login verifier:", e); }
      setLoginRecaptchaVerifier(null);
    }
    if (registerRecaptchaVerifier) {
      try { 
        registerRecaptchaVerifier.clear(); 
        console.log("AuthContext: Register reCAPTCHA verifier cleared.");
      } catch(e) { console.warn("AuthContext: Error clearing register verifier:", e); }
      setRegisterRecaptchaVerifier(null);
    }
    
  }, [loginRecaptchaVerifier, registerRecaptchaVerifier]);

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


    