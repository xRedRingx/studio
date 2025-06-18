/**
 * @fileoverview Profile Edit Page.
 * This page allows authenticated users (both customers and barbers) to edit their profile information.
 * Fields include first name, last name, phone number, and address.
 * Barbers have additional fields for bio and specialties.
 * The email address is displayed but is not editable from this form.
 * Profile updates are handled through the `AuthContext`.
 */
'use client';

import { useState } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage'; // Ensures authenticated access.
import ProfileEditForm from '@/components/user/ProfileEditForm'; // The form component for editing profile details.
import { useAuth } from '@/hooks/useAuth'; // Auth context hook for user data and update function.
import type { AppUser } from '@/types'; // Type definition for user data.
import { useToast } from '@/hooks/use-toast'; // Toast notification hook.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'; // Card UI component.

/**
 * ProfileEditPage component.
 * Renders the page for users to edit their profile.
 *
 * @returns {JSX.Element} The rendered profile edit page.
 */
export default function ProfileEditPage() {
  const { user, updateUserProfile, loadingAuth } = useAuth(); // Get user, update function, and loading state from auth context.
  const { toast } = useToast(); // For displaying notifications.
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false); // State to manage loading during profile update.

  // If user data is not yet loaded and authentication isn't processing,
  // it might mean the user is not logged in or there's an issue.
  // ProtectedPage will handle redirection if not logged in.
  if (!user && !loadingAuth) {
    return (
        <ProtectedPage> {/* Still wrap with ProtectedPage for consistent behavior */}
            <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
                <p>User not found. Redirecting...</p> {/* Placeholder, ProtectedPage should redirect */}
            </div>
        </ProtectedPage>
    );
  }

  /**
   * Handles the submission of the profile update form.
   * Calls the `updateUserProfile` function from the AuthContext.
   *
   * @param {Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address'>>} data - The profile data to update.
   *   For barbers, this can also include 'bio' and 'specialties'.
   */
  const handleUpdateProfile = async (
    // Defines the shape of data expected from ProfileEditForm.
    data: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address' | 'bio' | 'specialties'>>
  ) => {
    if (!user?.uid) { // Should not happen if ProtectedPage works, but good check.
      toast({ title: "Error", description: "User not found.", variant: "destructive" });
      return;
    }

    setIsUpdatingProfile(true); // Set loading state.

    try {
      await updateUserProfile(user.uid, data); // Call context function to update profile.
      toast({ title: "Success", description: "Your profile has been updated." });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: "Error", description: "Could not update profile. Please try again.", variant: "destructive" });
    } finally {
       setIsUpdatingProfile(false); // Clear loading state.
    }
  };

  // Display loading spinner while authentication state is being determined or user data is loading.
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
    // ProtectedPage ensures only authenticated users can access this page.
    <ProtectedPage>
      <div className="space-y-6 max-w-2xl mx-auto"> {/* Centered content with max width. */}
         <Card className="border-none shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
                <CardTitle className="text-2xl font-bold font-headline text-center sm:text-left">Edit Your Profile</CardTitle>
                 <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center sm:text-left">
                    Keep your personal information up to date.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
                {/* Render the profile edit form if user data is available. */}
                {user ? (
                <ProfileEditForm
                    currentUser={user} // Pass current user data to prefill the form.
                    onSubmit={handleUpdateProfile} // Pass the submission handler.
                    isSubmitting={isUpdatingProfile} // Pass submitting state to disable form inputs.
                />
                ) : ( // Fallback if user is somehow null after loading checks (should be rare).
                <div className="flex items-center justify-center py-10">
                    <LoadingSpinner className="h-8 w-8 text-primary" />
                    <p className="ml-2 text-base">Loading profile...</p>
                </div>
                )}
            </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
