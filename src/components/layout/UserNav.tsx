/**
 * @fileoverview UserNav component.
 * This component renders the user navigation dropdown menu, typically displayed in the header
 * when a user is logged in. It shows user information (name, email, phone, role) and
 * provides links to various dashboard sections, profile editing, and a logout option.
 * It also includes functionality to enable/disable push notifications via Firebase Cloud Messaging (FCM).
 */
'use client';

import { Button } from "@/components/ui/button"; // Button UI component.
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Dropdown menu UI components.
import { useAuth } from "@/hooks/useAuth"; // Auth context hook for user data and actions.
import { LogOut, User as UserIcon, Phone, Mail, Settings, LayoutDashboard, Scissors, CalendarClock, CalendarOff, Edit, BellRing, BellOff, DollarSign } from "lucide-react"; // Icons.
import { useRouter } from "next/navigation"; // Next.js router for navigation.
import Link from "next/link"; // Next.js Link component for client-side navigation.
import { messaging } from "@/firebase/config"; // Firebase Messaging instance.
import { getToken } from "firebase/messaging"; // FCM function to get device token.
import { useToast } from "@/hooks/use-toast"; // Toast notification hook.
import { useState, useEffect } from "react"; // React hooks.
import LoadingSpinner from "../ui/loading-spinner"; // Loading spinner UI.

/**
 * UserNav component.
 * Displays a user avatar/icon button that triggers a dropdown menu with user-specific navigation and actions.
 *
 * @returns {JSX.Element | null} The rendered user navigation menu, or null if no user is logged in.
 */
export default function UserNav() {
  const { user, signOut, role, updateUserFCMToken } = useAuth(); // Get user data, sign out, role, and FCM update function.
  const router = useRouter(); // Next.js router instance.
  const { toast } = useToast(); // For displaying notifications.

  // State for notification permission status ('prompt', 'granted', 'denied', 'unavailable').
  const [notificationStatus, setNotificationStatus] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt');
  // State to indicate if FCM token processing is in progress.
  const [isProcessingFCM, setIsProcessingFCM] = useState(false);

  // Effect to check initial notification permission status on component mount.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && messaging) {
      setNotificationStatus(Notification.permission); // Set based on browser's current permission.
    } else {
      setNotificationStatus('unavailable'); // Notifications not supported by the browser or messaging not init.
    }
  }, []); // Runs once on mount.

  // Effect to update notification status based on user's stored FCM token or browser permission changes.
  useEffect(() => {
    if (user?.fcmToken) { // If user has an FCM token, assume notifications are granted.
      setNotificationStatus('granted');
    } else { // If no FCM token, re-check browser permission.
      if (typeof window !== 'undefined' && 'Notification' in window && messaging) {
          if (Notification.permission === 'denied') setNotificationStatus('denied');
          // If permission is 'default' (prompt) or 'granted' (but no token), show as 'prompt' for re-enabling.
          else if (Notification.permission === 'default') setNotificationStatus('prompt');
          else if (Notification.permission === 'granted') setNotificationStatus('prompt');
      }
    }
  }, [user?.fcmToken]); // Reruns when user's FCM token changes.

  /**
   * Handles user sign-out.
   * Calls the `signOut` function from AuthContext and redirects to the homepage.
   */
  const handleSignOut = async () => {
    await signOut();
    router.push('/'); // Redirect to homepage after sign out.
  };

  /**
   * Handles enabling or managing push notifications.
   * Requests permission if not granted, gets FCM token, and updates user's profile.
   * Provides feedback via toasts for different scenarios (permission granted, denied, errors).
   */
  const handleEnableNotifications = async () => {
    // Ensure messaging service and user are available.
    if (!messaging || !user || !user.uid) {
      toast({ title: "Error", description: "Messaging service or user not available.", variant: "destructive" });
      return;
    }

    // If permission is already hard denied by the browser.
    if (Notification.permission === 'denied') {
        setNotificationStatus('denied');
        toast({ title: "Permission Denied", description: "Please enable notifications in your browser settings for this site.", variant: "destructive" });
        if (user.fcmToken) await updateUserFCMToken(user.uid, null); // Clear any existing token if permission is now denied.
        return;
    }
    // If already granted and user has a token (should be covered by `isCurrentlyEnabledWithToken` disable).
    if (Notification.permission === 'granted' && user.fcmToken) {
        setNotificationStatus('granted');
        toast({ title: "Notifications", description: "Notifications are already enabled."});
        return;
    }

    setIsProcessingFCM(true); // Set loading state.
    try {
      // Request notification permission from the browser.
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission); // Update local status.

      if (permission === 'granted') {
        // Permission granted, get FCM token.
        // The VAPID key is for web push security, specific to your Firebase project.
        const currentToken = await getToken(messaging, { vapidKey: "BFYxArauaN91bGFF6uqe6uljMXgcvXJtUSc_BDmUG4EjiVSaAhBZ2uwxWnGFiwm9oWGzMx6YPBGnijsE0OcP0no" });
        if (currentToken) {
          await updateUserFCMToken(user.uid, currentToken); // Save token to user's profile.
        } else { // Failed to get token.
          toast({ title: "Token Error", description: "Could not retrieve notification token. Ensure your VAPID key is correct and Firebase setup is complete.", variant: "destructive" });
          await updateUserFCMToken(user.uid, null); // Clear any potentially stale token.
        }
      } else if (permission === 'denied') { // Permission denied by user.
        toast({ title: "Permission Denied", description: "You will not receive notifications.", variant: "destructive" });
        await updateUserFCMToken(user.uid, null); // Clear token.
      } else { // Permission not granted (e.g., user dismissed the prompt).
        toast({ title: "Notifications", description: "Permission not granted. You can try again later." });
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast({ title: "Notification Setup Error", description: "An error occurred. See console for details.", variant: "destructive" });
       if(user.uid) await updateUserFCMToken(user.uid, null); // Clear token on error.
    } finally {
      setIsProcessingFCM(false); // Clear loading state.
    }
  };

  // If no user is logged in, do not render the component.
  if (!user) return null;

  // Prepare display name, email, and phone number.
  const displayName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.displayName || user.email || 'User'; // Fallback display name.

  const displayEmail = user.email;
  const displayPhoneNumber = user.phoneNumber;

  // Determine current notification state for UI logic.
  const isNotificationFeatureAvailable = notificationStatus !== 'unavailable' && !!messaging;
  const isCurrentlyEnabledWithToken = notificationStatus === 'granted' && !!user.fcmToken;
  const isPermissionHardDenied = notificationStatus === 'denied';

  return (
    <DropdownMenu>
      {/* Trigger button for the dropdown (user icon). */}
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <UserIcon className="h-6 w-6 text-foreground" />
        </Button>
      </DropdownMenuTrigger>
      {/* Content of the dropdown menu. */}
      <DropdownMenuContent className="w-64 rounded-lg shadow-xl mt-2" align="end" forceMount>
        {/* User information section. */}
        <DropdownMenuLabel className="font-normal p-3">
          <div className="flex flex-col space-y-1">
            <p className="text-base font-semibold leading-none">{displayName}</p>
            {displayEmail && (
              <p className="text-sm text-gray-500 flex items-center pt-0.5">
                <Mail className="mr-2 h-4 w-4 text-gray-400" />
                {displayEmail}
              </p>
            )}
            {displayPhoneNumber && (
              <p className="text-sm text-gray-500 flex items-center pt-0.5">
                <Phone className="mr-2 h-4 w-4 text-gray-400" />
                {displayPhoneNumber}
              </p>
            )}
            {role && <p className="text-xs text-gray-500 capitalize pt-1">Role: {role}</p>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Main navigation group. */}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push(`/${role}/dashboard`)} className="text-base py-2.5 px-3 cursor-pointer">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </DropdownMenuItem>
           <DropdownMenuItem asChild className="text-base py-2.5 px-3 cursor-pointer">
            <Link href="/profile/edit">
              <Edit className="mr-2 h-4 w-4" />
              <span>Edit Profile</span>
            </Link>
          </DropdownMenuItem>
          {/* Barber-specific menu items. */}
          {role === 'barber' && (
            <>
              <DropdownMenuItem asChild className="text-base py-2.5 px-3 cursor-pointer">
                <Link href="/barber/services">
                  <Scissors className="mr-2 h-4 w-4" />
                  <span>Manage Services</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-base py-2.5 px-3 cursor-pointer">
                <Link href="/barber/schedule">
                  <CalendarClock className="mr-2 h-4 w-4" />
                  <span>My Schedule</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-base py-2.5 px-3 cursor-pointer">
                <Link href="/barber/availability">
                  <CalendarOff className="mr-2 h-4 w-4" />
                  <span>My Availability</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-base py-2.5 px-3 cursor-pointer">
                <Link href="/barber/earnings">
                  <DollarSign className="mr-2 h-4 w-4" />
                  <span>My Earnings</span>
                </Link>
              </DropdownMenuItem>
            </>
          )}

          {/* Notification Toggle Menu Item */}
          {isNotificationFeatureAvailable ? (
            <DropdownMenuItem
              onClick={handleEnableNotifications}
              // Disable if processing, already enabled with token, or hard denied by browser.
              disabled={isProcessingFCM || isCurrentlyEnabledWithToken || isPermissionHardDenied}
              className="text-base py-2.5 px-3 cursor-pointer"
            >
              {/* Icon based on current notification state. */}
              {isProcessingFCM ? (
                <LoadingSpinner className="mr-2 h-4 w-4" />
              ) : isCurrentlyEnabledWithToken ? (
                <BellRing className="mr-2 h-4 w-4 text-green-500" />
              ) : isPermissionHardDenied ? (
                <BellOff className="mr-2 h-4 w-4 text-destructive" />
              ) : (
                <BellRing className="mr-2 h-4 w-4" />
              )}
              {/* Text based on current notification state. */}
              <span>
                {isProcessingFCM
                  ? 'Processing...'
                  : isCurrentlyEnabledWithToken
                  ? 'Notifications Enabled'
                  : isPermissionHardDenied
                  ? 'Notifications Blocked'
                  : 'Enable Notifications'}
              </span>
            </DropdownMenuItem>
          ) : ( // If notification feature is not available (e.g., browser doesn't support).
            <DropdownMenuItem disabled className="text-base py-2.5 px-3 cursor-not-allowed">
              <BellOff className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Notifications N/A</span>
            </DropdownMenuItem>
          )}

        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {/* Logout item. */}
        <DropdownMenuItem onClick={handleSignOut} className="text-base py-2.5 px-3 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
