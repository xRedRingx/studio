
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged,
  // signInWithPhoneNumber, // Import this for actual phone auth
  // RecaptchaVerifier, // Import this for actual phone auth
  signOut as firebaseSignOut,
  // type UserCredential, // May not be directly applicable for OTP flow simulation as is
  // type AuthError,
  type User as FirebaseUserType, // Renamed to avoid conflict with our FirebaseUser
} from 'firebase/auth';
import { auth, firestore } from '@/firebase/config';
import type { AppUser, UserRole, FirebaseUser } from '@/types';
import { LOCAL_STORAGE_ROLE_KEY } from '@/lib/constants';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Placeholder for actual Firebase UserCredential if using full phone auth
// For simulation, we might not get a full UserCredential in the same way
interface SimulatedUserCredential {
  user: FirebaseUser;
}

interface AuthContextType {
  user: AppUser | null;
  role: UserRole | null;
  loadingAuth: boolean;
  initialRoleChecked: boolean;
  setRole: (role: UserRole) => void;
  signUp: (data: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    // email removed from input
    role: UserRole;
  }) => Promise<SimulatedUserCredential>; // Updated return type for simulation
  signIn: (data: {
    phoneNumber: string;
  }) => Promise<SimulatedUserCredential>; // Updated return type for simulation
  signOut: () => Promise<void>;
  // recaptchaVerifier: RecaptchaVerifier | null; // Placeholder for actual Recaptcha
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [initialRoleChecked, setInitialRoleChecked] = useState(false);
  // const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const storedRole = localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) as UserRole | null;
    if (storedRole) {
      setRoleState(storedRole);
    }
    setInitialRoleChecked(true);

    // For actual phone auth, you'd set up RecaptchaVerifier here, possibly in a useEffect
    // Example:
    // if (auth && !recaptchaVerifier) {
    //   const verifier = new RecaptchaVerifier(auth, 'recaptcha-container-id', { // 'recaptcha-container-id' is an invisible div
    //     'size': 'invisible',
    //     'callback': (response: any) => {
    //       // reCAPTCHA solved, allow signInWithPhoneNumber.
    //     },
    //     'expired-callback': () => {
    //       // Response expired. Ask user to solve reCAPTCHA again.
    //     }
    //   });
    //   setRecaptchaVerifier(verifier);
    // }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUserType | null) => {
      if (firebaseUser) {
        const userDocRef = doc(firestore, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const appUserData = userDocSnap.data() as Omit<AppUser, keyof FirebaseUserType>;
          const appUser: AppUser = {
            ...(firebaseUser as unknown as FirebaseUser), // Cast needed due to type differences
            ...appUserData,
            phoneNumber: appUserData.phoneNumber || firebaseUser.phoneNumber || '', 
            email: appUserData.email || firebaseUser.email || null, // Ensure email is handled
          };
          setUser(appUser);
          if (appUser.role && !role) {
             setRoleContextAndStorage(appUser.role);
          }
        } else {
          const minimalAppUser: AppUser = {
            ...(firebaseUser as unknown as FirebaseUser),
            phoneNumber: firebaseUser.phoneNumber || 'UNKNOWN_PHONE',
            email: firebaseUser.email || null, // Ensure email is handled
            role: role || undefined, 
          };
          setUser(minimalAppUser);
        }
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [role]); // recaptchaVerifier could be a dependency if initialized here

  const setRoleContextAndStorage = (newRole: UserRole) => {
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, newRole);
    setRoleState(newRole);
  };
  
  const signUp = async (data: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    // email removed
    role: UserRole;
  }): Promise<SimulatedUserCredential> => {
    const { firstName, lastName, phoneNumber, role: userRole } = data;

    // SIMULATION: In a real app, you'd call signInWithPhoneNumber here
    // const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier!);
    // Then, you'd need a UI for the user to enter the OTP, and then call:
    // const userCredential = await confirmationResult.confirm(otpFromUser);
    // const firebaseUser = userCredential.user;

    const simulatedUid = `simulated-${Date.now()}`; 
    const simulatedFirebaseUser: FirebaseUser = {
      uid: simulatedUid,
      phoneNumber: phoneNumber,
      displayName: `${firstName} ${lastName}`,
      email: null, // Email is explicitly null
      emailVerified: false,
      isAnonymous: false,
      metadata: {},
      providerData: [],
      providerId: 'phone', 
      refreshToken: 'mockRefreshToken',
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => 'mockIdToken',
      getIdTokenResult: async () => ({token: 'mockIdToken', claims: {}, authTime: '', expirationTime: '', issuedAtTime: '', signInProvider: null, signInSecondFactor: null}),
      reload: async () => {},
      toJSON: () => ({}),
      photoURL: null,
    };

    await setDoc(doc(firestore, "users", simulatedFirebaseUser.uid), {
      uid: simulatedFirebaseUser.uid,
      phoneNumber: phoneNumber,
      email: null, // Store email as null
      role: userRole,
      firstName,
      lastName,
      createdAt: new Date().toISOString(),
    });
    
    setRoleContextAndStorage(userRole);
    const appUser: AppUser = { ...simulatedFirebaseUser, role: userRole, firstName, lastName, email: null };
    setUser(appUser);
    
    return { user: simulatedFirebaseUser }; 
  };

  const signIn = async (data: { phoneNumber: string }): Promise<SimulatedUserCredential> => {
    const { phoneNumber } = data;
    
    console.log(`Simulating OTP sent to ${phoneNumber}. In a real app, user would enter OTP.`);
    
    const mockUserQuery = (await getDoc(doc(firestore, "users", `uid-for-${phoneNumber}`))); 
    if (mockUserQuery.exists()) {
        const appUserData = mockUserQuery.data() as AppUser;
         const simulatedFirebaseUser: FirebaseUser = {
            uid: appUserData.uid!,
            phoneNumber: appUserData.phoneNumber,
            displayName: `${appUserData.firstName} ${appUserData.lastName}`,
            email: appUserData.email || null, // Keep existing email if it was there from old data
            emailVerified: false, isAnonymous: false, metadata: {}, providerData: [], providerId: 'phone', refreshToken: '', tenantId: null,
            delete: async () => {}, getIdToken: async () => '', getIdTokenResult: async () => ({} as any), reload: async () => {}, toJSON: () => ({}), photoURL: null,
        };
        setUser(appUserData);
        if (appUserData.role) setRoleContextAndStorage(appUserData.role);
        return { user: simulatedFirebaseUser };
    }
    
    const placeholderUser: FirebaseUser = { 
        uid: 'simulated-signin-uid', phoneNumber, displayName: 'Simulated User', email: null,
        emailVerified: false, isAnonymous: false, metadata: {}, providerData: [], providerId: 'phone', refreshToken: '', tenantId: null,
        delete: async () => {}, getIdToken: async () => '', getIdTokenResult: async () => ({} as any), reload: async () => {}, toJSON: () => ({}), photoURL: null,
    };
    return { user: placeholderUser }; 
  };

  const signOut = () => {
    return firebaseSignOut(auth).then(() => {
      setUser(null); 
    });
  };

  return (
    <AuthContext.Provider value={{ user, role, loadingAuth, initialRoleChecked, setRole: setRoleContextAndStorage, signUp, signIn, signOut }}>
      {children}
      {/* Add a div for reCAPTCHA if you implement full phone auth, e.g., <div id="recaptcha-container-id"></div> */}
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
