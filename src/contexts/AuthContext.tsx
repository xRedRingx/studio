
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { auth, firestore } from '@/firebase/config';
import type { AppUser, UserRole, Appointment } from '@/types';
import { LOCAL_STORAGE_ROLE_KEY, LOCAL_STORAGE_USER_KEY } from '@/lib/constants';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  type User as FirebaseUser
} from 'firebase/auth';
import { collection, doc, getDoc, setDoc, updateDoc, Timestamp, writeBatch, query, where, getDocs } from 'firebase/firestore';

import { useToast } from '@/hooks/use-toast';

const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(' ')) return 0;
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (hours === 12) {
    hours = modifier.toUpperCase() === 'AM' ? 0 : 12;
  } else if (modifier.toUpperCase() === 'PM' && hours < 12) {
    hours += 12;
  }
  return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const period = h < 12 || h === 24 ? 'AM' : 'PM';
  return `${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};


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
    userDetails: Omit<AppUser, 'uid' | 'createdAt' | 'updatedAt' | 'displayName' | 'emailVerified' | 'fcmToken' | 'isTemporarilyUnavailable' | 'unavailableSince'> & { password_original_do_not_use: string }
  ) => Promise<void>;
  signInWithEmailAndPassword: (email: string, password_original_do_not_use: string) => Promise<void>;
  sendPasswordResetLink: (email: string) => Promise<void>;
  updateUserProfile: (
    userId: string,
    updates: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address' | 'bio' | 'specialties'>>
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserAcceptingBookings: (userId: string, isAccepting: boolean) => Promise<void>;
  updateUserFCMToken: (userId: string, token: string | null) => Promise<void>;
  updateBarberTemporaryStatus: (
    barberId: string,
    isTemporarilyUnavailable: boolean,
    currentUnavailableSince: Timestamp | null | undefined
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function createUserDocument(firebaseUser: FirebaseUser, dataFromRegistration: Partial<AppUser> = {}) {
  if (!firebaseUser) return;

  const userRef = doc(firestore, `users/${firebaseUser.uid}`);
  const { email: authEmail, emailVerified, displayName: authDisplayName } = firebaseUser;
  const createdAt = Timestamp.now();

  const roleFromReg = dataFromRegistration.role;
  const firstNameFromReg = dataFromRegistration.firstName?.trim();
  const lastNameFromReg = dataFromRegistration.lastName?.trim();
  const phoneNumberFromReg = dataFromRegistration.phoneNumber?.trim();
  const addressFromReg = dataFromRegistration.address?.trim();
  const bioFromReg = dataFromRegistration.bio?.trim();
  const specialtiesFromReg = dataFromRegistration.specialties;
  const isAcceptingBookingsFromReg = dataFromRegistration.isAcceptingBookings;

  let calculatedDisplayName = '';
  if (firstNameFromReg && lastNameFromReg) calculatedDisplayName = `${firstNameFromReg} ${lastNameFromReg}`;
  else if (firstNameFromReg) calculatedDisplayName = firstNameFromReg;
  else if (lastNameFromReg) calculatedDisplayName = lastNameFromReg;

  let finalDisplayName = calculatedDisplayName;
  if (!finalDisplayName || finalDisplayName.trim() === "" || finalDisplayName.toLowerCase() === "undefined undefined") {
    finalDisplayName = (authDisplayName && authDisplayName.trim() !== "" && authDisplayName.toLowerCase() !== "undefined undefined")
      ? authDisplayName
      : (authEmail ? authEmail.split('@')[0] : `User_${firebaseUser.uid.substring(0,5)}`);
  }

  try {
    const userDataToSet: { [key: string]: any } = {
      uid: firebaseUser.uid,
      email: authEmail,
      displayName: finalDisplayName.trim(),
      emailVerified,
      updatedAt: createdAt,
      isTemporarilyUnavailable: false, // Initialize for all users, relevant for barbers
      unavailableSince: null,      // Initialize for all users
    };

    if (roleFromReg) userDataToSet.role = roleFromReg;
    if (firstNameFromReg) userDataToSet.firstName = firstNameFromReg; else if (dataFromRegistration.hasOwnProperty('firstName')) userDataToSet.firstName = null;
    if (lastNameFromReg) userDataToSet.lastName = lastNameFromReg; else if (dataFromRegistration.hasOwnProperty('lastName')) userDataToSet.lastName = null;
    if (phoneNumberFromReg) userDataToSet.phoneNumber = phoneNumberFromReg; else if (dataFromRegistration.hasOwnProperty('phoneNumber')) userDataToSet.phoneNumber = null;
    if (addressFromReg) userDataToSet.address = addressFromReg; else if (dataFromRegistration.hasOwnProperty('address')) userDataToSet.address = null;

    if (roleFromReg === 'barber') {
      userDataToSet.isAcceptingBookings = isAcceptingBookingsFromReg !== undefined ? isAcceptingBookingsFromReg : true;
      if (bioFromReg) userDataToSet.bio = bioFromReg; else if (dataFromRegistration.hasOwnProperty('bio')) userDataToSet.bio = null;
      if (specialtiesFromReg) userDataToSet.specialties = specialtiesFromReg; else if (dataFromRegistration.hasOwnProperty('specialties')) userDataToSet.specialties = null;
    }

    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
        userDataToSet.createdAt = createdAt;
        userDataToSet.fcmToken = null;
    }
    await setDoc(userRef, userDataToSet, { merge: true });
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
    if (storedRole) setRoleState(storedRole);
    setInitialRoleChecked(true);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoadingAuth(true);
      if (firebaseUser) {
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        let userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          const minimalDataForCreation: Partial<AppUser> = {};
          if (role) minimalDataForCreation.role = role;
          else {
            const roleFromStorageFallback = localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) as UserRole | null;
            if (roleFromStorageFallback) minimalDataForCreation.role = roleFromStorageFallback;
          }
          await createUserDocument(firebaseUser, minimalDataForCreation);
          userDocSnap = await getDoc(userDocRef);
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
            bio: firestoreUser.bio,
            specialties: firestoreUser.specialties,
            isAcceptingBookings: firestoreUser.role === 'barber' ? (firestoreUser.isAcceptingBookings !== undefined ? firestoreUser.isAcceptingBookings : true) : undefined,
            isTemporarilyUnavailable: firestoreUser.isTemporarilyUnavailable || false,
            unavailableSince: firestoreUser.unavailableSince || null,
            fcmToken: firestoreUser.fcmToken || null,
            createdAt: firestoreUser.createdAt,
            updatedAt: firestoreUser.updatedAt,
          };
          setUser(appUser);
          persistUserSession(appUser);
          if (firestoreUser.role && firestoreUser.role !== role) setRoleContextAndStorage(firestoreUser.role);
          else if (firestoreUser.role) setRoleState(firestoreUser.role);
        } else {
          setUser(null);
          clearUserSession();
        }
      } else {
        setUser(null);
        clearUserSession();
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [role]);

  const setRoleContextAndStorage = (newRole: UserRole) => {
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, newRole);
    setRoleState(newRole);
  };

  const persistUserSession = (appUser: AppUser) => {
    const storableUser = {
      ...appUser,
      createdAt: appUser.createdAt instanceof Timestamp ? appUser.createdAt.toDate().toISOString() : appUser.createdAt,
      updatedAt: appUser.updatedAt instanceof Timestamp ? appUser.updatedAt.toDate().toISOString() : appUser.updatedAt,
      unavailableSince: appUser.unavailableSince instanceof Timestamp ? appUser.unavailableSince.toDate().toISOString() : appUser.unavailableSince,
    };
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(storableUser));
  };

  const clearUserSession = () => localStorage.removeItem(LOCAL_STORAGE_USER_KEY);

  const registerWithEmailAndPassword = async (
     userDetails: Omit<AppUser, 'uid' | 'createdAt' | 'updatedAt' | 'displayName' | 'emailVerified' | 'fcmToken' | 'isTemporarilyUnavailable' | 'unavailableSince'> & { password_original_do_not_use: string }
  ) => {
    setIsProcessingAuth(true);
    const { email, password_original_do_not_use, firstName, lastName, role: userRole, phoneNumber, address, bio, specialties, isAcceptingBookings } = userDetails;
    setRoleContextAndStorage(userRole);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password_original_do_not_use);
      const firebaseUser = userCredential.user;
      const firestoreDataForCreation: Partial<AppUser> = {
        email, firstName, lastName, role: userRole, phoneNumber: phoneNumber || null, address: address || null,
        isTemporarilyUnavailable: false, unavailableSince: null,
      };
      if (userRole === 'barber') {
        firestoreDataForCreation.isAcceptingBookings = isAcceptingBookings !== undefined ? isAcceptingBookings : true;
        firestoreDataForCreation.bio = bio || null;
        firestoreDataForCreation.specialties = specialties || null;
      }
      await createUserDocument(firebaseUser, firestoreDataForCreation);
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) throw new Error("User document not found after registration.");
      const createdUser = userDocSnap.data() as AppUser;
      setUser(createdUser);
      persistUserSession(createdUser);
      toast({ title: "Registration Successful!", description: "Your account has been created." });
    } catch (error: any) {
      console.error("AuthContext: Error registering user:", error);
      toast({ title: "Registration Error", description: error.code === 'auth/email-already-in-use' ? "This email is already registered." : error.message || "Failed to register.", variant: "destructive" });
      throw error;
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const newSignInWithEmailAndPassword = async (email: string, password_original_do_not_use: string) => {
    setIsProcessingAuth(true);
    try {
      await signInWithEmailAndPassword(auth, email, password_original_do_not_use);
    } catch (error: any) {
      console.error("AuthContext: Error signing in:", error);
      toast({ title: "Login Error", description: (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') ? "Invalid email or password." : error.message || "Failed to sign in.", variant: "destructive" });
      throw error;
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const sendPasswordResetLink = async (email: string) => {
    setIsProcessingAuth(true);
    try {
      await firebaseSendPasswordResetEmail(auth, email);
       toast({ title: "Check Your Email", description: "If an account exists, a password reset link has been sent." });
    } catch (error: any) {
      console.error("AuthContext: Error sending password reset email:", error);
      toast({ title: "Password Reset", description: "If your email is registered, you'll receive a link.", variant: "default" });
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const updateUserProfile = async (
    userId: string,
    updates: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address' | 'bio' | 'specialties'>>
  ) => {
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
        toast({ title: "Error", description: "Authentication error.", variant: "destructive" });
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
      dataToUpdate.firstName = newFirstName && newFirstName !== "" ? newFirstName : (updates.hasOwnProperty('firstName') ? null : currentData?.firstName);
      dataToUpdate.lastName = newLastName && newLastName !== "" ? newLastName : (updates.hasOwnProperty('lastName') ? null : currentData?.lastName);
      dataToUpdate.phoneNumber = updates.phoneNumber && updates.phoneNumber.trim() !== "" ? updates.phoneNumber.trim() : (updates.hasOwnProperty('phoneNumber') ? null : currentData?.phoneNumber);
      dataToUpdate.address = updates.address && updates.address.trim() !== "" ? updates.address.trim() : (updates.hasOwnProperty('address') ? null : currentData?.address);
      if (updates.hasOwnProperty('bio')) dataToUpdate.bio = updates.bio && updates.bio.trim() !== "" ? updates.bio.trim() : null;
      if (updates.hasOwnProperty('specialties')) dataToUpdate.specialties = Array.isArray(updates.specialties) && updates.specialties.length > 0 ? updates.specialties : null;
      let newDisplayName = '';
      const finalFirstName = dataToUpdate.firstName || currentData?.firstName;
      const finalLastName = dataToUpdate.lastName || currentData?.lastName;
      if (finalFirstName && finalLastName) newDisplayName = `${finalFirstName} ${finalLastName}`;
      else if (finalFirstName) newDisplayName = finalFirstName;
      else if (finalLastName) newDisplayName = finalLastName;
      else newDisplayName = currentData?.email?.split('@')[0] || `User_${userId.substring(0,5)}`;
      dataToUpdate.displayName = newDisplayName.trim();
      await updateDoc(userRef, dataToUpdate);
      setUser(prevUser => {
        if (!prevUser) return null;
        const updatedUserFields = { ...prevUser, ...dataToUpdate, updatedAt: dataToUpdate.updatedAt };
        persistUserSession(updatedUserFields);
        return updatedUserFields;
      });
       toast({ title: "Success", description: "Profile updated." });
    } catch (error: any) {
      console.error("AuthContext: Error updating profile:", error);
      toast({ title: "Update Error", description: error.message || "Could not update profile.", variant: "destructive" });
      throw error;
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const updateUserAcceptingBookings = async (userId: string, isAccepting: boolean) => {
    setIsProcessingAuth(true);
    try {
      const userRef = doc(firestore, 'users', userId);
      await updateDoc(userRef, { isAcceptingBookings: isAccepting, updatedAt: Timestamp.now() });
      setUser(prevUser => {
        if (!prevUser || prevUser.uid !== userId) return prevUser;
        const updatedUser = { ...prevUser, isAcceptingBookings: isAccepting, updatedAt: Timestamp.now() };
        persistUserSession(updatedUser);
        return updatedUser;
      });
    } catch (error: any) {
      console.error("AuthContext: Error updating isAcceptingBookings:", error);
      toast({ title: "Update Error", description: error.message || "Could not update booking status.", variant: "destructive" });
      throw error;
    } finally {
      setIsProcessingAuth(false);
    }
  };
  
  const updateBarberTemporaryStatus = async (
    barberId: string,
    isTemporarilyUnavailable: boolean,
    currentUnavailableSince: Timestamp | null | undefined
  ) => {
    setIsProcessingAuth(true);
    const userRef = doc(firestore, 'users', barberId);
    const now = Timestamp.now();
    const batch = writeBatch(firestore);

    try {
      if (isTemporarilyUnavailable) { // Going busy
        batch.update(userRef, {
          isTemporarilyUnavailable: true,
          unavailableSince: now,
          updatedAt: now,
        });
      } else { // Going available, need to shift appointments
        batch.update(userRef, {
          isTemporarilyUnavailable: false,
          unavailableSince: null,
          updatedAt: now,
        });

        if (currentUnavailableSince) {
          const busyEndTime = now.toDate();
          const busyStartTime = currentUnavailableSince.toDate();
          const busyDurationMs = busyEndTime.getTime() - busyStartTime.getTime();
          const busyDurationMinutes = Math.round(busyDurationMs / (1000 * 60));

          if (busyDurationMinutes > 0) {
            const todayStr = formatDateToYYYYMMDD(new Date());
            const appointmentsQuery = query(
              collection(firestore, 'appointments'),
              where('barberId', '==', barberId),
              where('date', '==', todayStr),
              where('status', 'in', ['upcoming', 'customer-initiated-check-in', 'barber-initiated-check-in']) // Only shift not started ones
            );
            const appointmentsSnapshot = await getDocs(appointmentsQuery);

            appointmentsSnapshot.forEach(apptDoc => {
              const appointment = apptDoc.data() as Appointment;
              const apptStartTimeMinutes = timeToMinutes(appointment.startTime);
              
              // Only shift appointments that were supposed to start after or during the busy period began
              if (appointment.appointmentTimestamp && appointment.appointmentTimestamp.toDate() >= busyStartTime) {
                  const newStartTimeMinutes = apptStartTimeMinutes + busyDurationMinutes;
                  const newServiceDuration = appointment.serviceName && user && user.role === 'barber' ?
                    (user.specialties?.find(s => s === appointment.serviceName) ? 30 : 30) // Placeholder for actual service duration lookup
                    : 30; // Default duration if service not found

                  const newEndTimeMinutes = newStartTimeMinutes + newServiceDuration;

                  const newStartTimeStr = minutesToTime(newStartTimeMinutes);
                  const newEndTimeStr = minutesToTime(newEndTimeMinutes);
                  
                  let newAppointmentTimestamp = null;
                  if (appointment.appointmentTimestamp) {
                    const shiftedDate = new Date(appointment.appointmentTimestamp.toDate().getTime() + busyDurationMs);
                    newAppointmentTimestamp = Timestamp.fromDate(shiftedDate);
                  }

                  batch.update(apptDoc.ref, {
                    startTime: newStartTimeStr,
                    endTime: newEndTimeStr,
                    appointmentTimestamp: newAppointmentTimestamp,
                    updatedAt: now,
                  });
              }
            });
            toast({ title: "Status Updated", description: `Appointments shifted by ${busyDurationMinutes} minutes.` });
          }
        }
      }
      await batch.commit();
      setUser(prevUser => {
        if (!prevUser || prevUser.uid !== barberId) return prevUser;
        const updatedUser = {
          ...prevUser,
          isTemporarilyUnavailable,
          unavailableSince: isTemporarilyUnavailable ? now : null,
          updatedAt: now
        };
        persistUserSession(updatedUser);
        return updatedUser;
      });
    } catch (error: any) {
      console.error("AuthContext: Error updating temporary status/shifting appointments:", error);
      toast({ title: "Status Update Error", description: error.message || "Could not update temporary status.", variant: "destructive" });
      throw error;
    } finally {
      setIsProcessingAuth(false);
    }
  };


  const updateUserFCMToken = async (userId: string, token: string | null) => {
    setIsProcessingAuth(true);
    try {
      const userRef = doc(firestore, 'users', userId);
      await updateDoc(userRef, { fcmToken: token, updatedAt: Timestamp.now() });
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
        toast({ title: "Sign Out Error", description: "Could not sign out.", variant: "destructive" });
    } finally {
        setIsProcessingAuth(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, role, loadingAuth, initialRoleChecked, isProcessingAuth, setIsProcessingAuth, setUser,
      setRole: setRoleContextAndStorage,
      registerWithEmailAndPassword,
      signInWithEmailAndPassword: newSignInWithEmailAndPassword,
      sendPasswordResetLink,
      updateUserProfile,
      signOut: signOutUser,
      updateUserAcceptingBookings,
      updateUserFCMToken,
      updateBarberTemporaryStatus,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
