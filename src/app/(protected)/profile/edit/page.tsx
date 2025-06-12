
'use client';

import ProtectedPage from '@/components/layout/ProtectedPage';
import ProfileEditForm from '@/components/user/ProfileEditForm';
import { useAuth } from '@/hooks/useAuth';
import type { AppUser } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { firestore } from '@/firebase/config';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import LoadingSpinner from '@/components/ui/loading-spinner';

export default function ProfileEditPage() {
  const { user, setUser, isProcessingAuth, setIsProcessingAuth } = useAuth(); // Assuming setIsProcessingAuth exists or can be added
  const { toast } = useToast();

  if (!user && !isProcessingAuth) {
    // Redirect or handle if user is somehow not available and not loading
    // This should ideally be handled by ProtectedPage, but as a fallback.
    return (
        <ProtectedPage>
            <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
                <p>User not found. Redirecting...</p>
            </div>
        </ProtectedPage>
    );
  }

  const handleUpdateProfile = async (data: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber'>>) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "User not found.", variant: "destructive" });
      return;
    }

    // Use setIsProcessingAuth or a new state like isUpdatingProfile
    if (typeof setIsProcessingAuth === 'function') {
        setIsProcessingAuth(true);
    }


    try {
      const userRef = doc(firestore, 'users', user.uid);
      const updates: any = { ...data, updatedAt: Timestamp.now() };
      
      // Ensure phone number is explicitly set to null if empty string, or kept as string if provided
      if (data.phoneNumber === '') {
        updates.phoneNumber = null;
      } else if (data.phoneNumber) {
        updates.phoneNumber = data.phoneNumber;
      }


      await updateDoc(userRef, updates);

      // Update local user state in AuthContext and localStorage
      setUser(prevUser => {
        if (!prevUser) return null;
        const updatedUser = { ...prevUser, ...updates, phoneNumber: updates.phoneNumber }; // Use phoneNumber from updates

        // Update localStorage
        const storableUser = {
          ...updatedUser,
          createdAt: updatedUser.createdAt instanceof Timestamp ? updatedUser.createdAt.toDate().toISOString() : updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt instanceof Timestamp ? updatedUser.updatedAt.toDate().toISOString() : new Date().toISOString(),
        };
        localStorage.setItem('barberflow_user_session', JSON.stringify(storableUser));
        return updatedUser;
      });

      toast({ title: "Success", description: "Your profile has been updated." });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: "Error", description: "Could not update profile. Please try again.", variant: "destructive" });
    } finally {
       if (typeof setIsProcessingAuth === 'function') {
        setIsProcessingAuth(false);
      }
    }
  };
  
  if (isProcessingAuth && !user) { // Show loading if processing initial auth and no user yet
    return (
      <ProtectedPage>
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
          <LoadingSpinner className="h-12 w-12 text-primary" />
          <p className="ml-3 text-base">Loading user data...</p>
        </div>
      </ProtectedPage>
    );
  }


  return (
    <ProtectedPage>
      <div className="space-y-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold font-headline">Edit Your Profile</h1>
        {user ? (
          <ProfileEditForm
            currentUser={user}
            onSubmit={handleUpdateProfile}
            isSubmitting={isProcessingAuth} // Pass down the submitting state
          />
        ) : (
           <div className="flex items-center justify-center py-10">
             <LoadingSpinner className="h-8 w-8 text-primary" />
             <p className="ml-2 text-base">Loading profile...</p>
           </div>
        )}
      </div>
    </ProtectedPage>
  );
}
