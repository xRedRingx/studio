
'use client';

import { useState } from 'react'; // Import useState
import ProtectedPage from '@/components/layout/ProtectedPage';
import ProfileEditForm from '@/components/user/ProfileEditForm';
import { useAuth } from '@/hooks/useAuth';
import type { AppUser } from '@/types';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';

export default function ProfileEditPage() {
  const { user, setUser, updateUserProfile, loadingAuth } = useAuth(); // Removed isProcessingAuth, setIsProcessingAuth for this page's direct use
  const { toast } = useToast();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false); // New local state for submission

  if (!user && !loadingAuth) {
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

    setIsUpdatingProfile(true); // Use local state

    try {
      // Call updateUserProfile from AuthContext, which no longer sets isProcessingAuth itself for this action
      await updateUserProfile(user.uid, data);
      // The setUser logic is handled within updateUserProfile or by onAuthStateChanged if email/photoURL were also updated (not the case here)
      // AuthContext's updateUserProfile will update the user in its own state and localStorage.

      // No need to manually call setUser here if AuthContext handles it post-update.
      // However, the `updateUserProfile` in AuthContext *does* call setUser.

      toast({ title: "Success", description: "Your profile has been updated." });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: "Error", description: "Could not update profile. Please try again.", variant: "destructive" });
    } finally {
       setIsUpdatingProfile(false); // Use local state
    }
  };
  
  if (loadingAuth && !user) { 
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
            isSubmitting={isUpdatingProfile} // Pass down the local submitting state
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

