
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

  // RecaptchaVerifier instances - managed here to avoid re-initialization on every call
  // These are initialized in the sendOtp function now
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
            email: appUserData.email || firebaseUser.email || null,
          };
          setUser(appUser);
          if (appUser.role && !role) {
             setRoleContextAndStorage(appUser.role);
          }
        } else {
           // This case might happen if user is authenticated but Firestore doc creation failed/pending
           // Or if it's a new user post-OTP but before Firestore doc is created
           if (pendingUserDetails && firebaseUser.phoneNumber === pendingUserDetails.phoneNumber) {
             await createUserDocument(firebaseUser, pendingUserDetails.firstName, pendingUserDetails.lastName, pendingUserDetails.role);
             setPendingUserDetails(null); // Clear pending details
           } else {
            // If no pending details, treat as an issue or incomplete registration
            console.warn("Authenticated user document not found in Firestore and no pending details.");
            // Potentially sign out user or prompt for more info
            const minimalAppUser: AppUser = {
              ...(firebaseUser as unknown as FirebaseUser),
              phoneNumber: firebaseUser.phoneNumber || 'UNKNOWN_PHONE',
              email: firebaseUser.email || null,
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
      // Attempt to clear previous instance if element is gone
      try {
        verifier.clear();
      } catch (e) {
        console.warn("Error clearing old reCAPTCHA verifier:", e);
      }
    }
    
    // Ensure the container exists before creating new verifier
    const recaptchaContainer = document.getElementById(recaptchaContainerId);
    if (!recaptchaContainer) {
      throw new Error(`reCAPTCHA container with id '${recaptchaContainerId}' not found.`);
    }
    // Ensure it's empty
    while (recaptchaContainer.firstChild) {
        recaptchaContainer.removeChild(recaptchaContainer.firstChild);
    }


    const newVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      'size': 'invisible',
      'callback': (response: any) => {
        // reCAPTCHA solved, allow signInWithPhoneNumber.
        console.log("reCAPTCHA verified:", response);
      },
      'expired-callback': () => {
        toast({ title: "reCAPTCHA Expired", description: "Please try sending the OTP again.", variant: "destructive" });
        setIsSendingOtp(false);
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
      toast({ title: "OTP Send Error", description: error.message || "Failed to send OTP. Please try again.", variant: "destructive" });
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
    const appUser: AppUser = {
      ...(firebaseUser as unknown as FirebaseUser),
      firstName,
      lastName,
      role: userRole,
      phoneNumber: firebaseUser.phoneNumber || pendingUserDetails?.phoneNumber || 'UNKNOWN_PHONE',
      email: null, // Explicitly null
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
        // This is a registration flow
        await createUserDocument(firebaseUser, pendingUserDetails.firstName, pendingUserDetails.lastName, pendingUserDetails.role);
        setPendingUserDetails(null); // Clear pending details
      } else {
        // This is a login flow, or registration where pending details somehow got lost (should be rare)
        // User document should already exist for login, or will be fetched by onAuthStateChanged
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
        } else if (pendingUserDetails) { 
          // Fallback if somehow onAuthStateChanged didn't pick up pending details fast enough
          await createUserDocument(firebaseUser, pendingUserDetails.firstName, pendingUserDetails.lastName, pendingUserDetails.role);
          setPendingUserDetails(null);
        } else {
          console.error("User document not found after OTP confirmation for login.");
           toast({ title: "Login Error", description: "User profile not found. Please contact support.", variant: "destructive" });
           // Don't set user, let onAuthStateChanged handle it or redirect.
        }
      }
      
      toast({ title: "Success!", description: "You've been successfully verified." });
      setOtpSent(false); // Reset otpSent after successful verification
      // Navigation will be handled by the form component or useEffect watching the user state
    } catch (error: any) {
      console.error("Error confirming OTP:", error);
      toast({ title: "OTP Verification Failed", description: error.message || "Invalid OTP or an error occurred.", variant: "destructive" });
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
