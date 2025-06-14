
'use client';

import { useState } from 'react'; 
import ProtectedPage from '@/components/layout/ProtectedPage';
import ProfileEditForm from '@/components/user/ProfileEditForm';
import { useAuth } from '@/hooks/useAuth';
import type { AppUser } from '@/types';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';

export default function ProfileEditPage() {
  const { user, updateUserProfile, loadingAuth } = useAuth(); 
  const { toast } = useToast();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  if (!user && !loadingAuth) {
    return (
        <ProtectedPage>
            <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
                <p>User not found. Redirecting...</p>
            </div>
        </ProtectedPage>
    );
  }

  const handleUpdateProfile = async (
    data: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address'>>,
    photoFile?: File | null // Added photoFile parameter
  ) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "User not found.", variant: "destructive" });
      return;
    }

    setIsUpdatingProfile(true);

    try {
      // Pass photoFile to updateUserProfile in AuthContext
      await updateUserProfile(user.uid, data, photoFile);
      toast({ title: "Success", description: "Your profile has been updated." });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: "Error", description: "Could not update profile. Please try again.", variant: "destructive" });
    } finally {
       setIsUpdatingProfile(false);
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
            isSubmitting={isUpdatingProfile} 
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
