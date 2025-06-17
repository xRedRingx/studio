
'use client';

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, User as UserIcon, Phone, Mail, Settings, LayoutDashboard, Scissors, CalendarClock, CalendarOff, Edit, BellRing, BellOff, DollarSign } from "lucide-react"; 
import { useRouter } from "next/navigation";
import Link from "next/link";
import { messaging } from "@/firebase/config"; 
import { getToken } from "firebase/messaging"; 
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import LoadingSpinner from "../ui/loading-spinner";

export default function UserNav() {
  const { user, signOut, role, updateUserFCMToken } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [notificationStatus, setNotificationStatus] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt');
  const [isProcessingFCM, setIsProcessingFCM] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && messaging) {
      setNotificationStatus(Notification.permission);
    } else {
      setNotificationStatus('unavailable');
    }
  }, []); 
  
  useEffect(() => {
    if (user?.fcmToken) {
      setNotificationStatus('granted');
    } else {
      if (typeof window !== 'undefined' && 'Notification' in window && messaging) {
          if (Notification.permission === 'denied') setNotificationStatus('denied');
          else if (Notification.permission === 'default') setNotificationStatus('prompt');
          else if (Notification.permission === 'granted') setNotificationStatus('prompt'); 
      }
    }
  }, [user?.fcmToken]);


  const handleSignOut = async () => {
    await signOut();
    router.push('/'); 
  };
  
  const handleEnableNotifications = async () => {
    if (!messaging || !user || !user.uid) {
      toast({ title: "Error", description: "Messaging service or user not available.", variant: "destructive" });
      return;
    }
    
    if (Notification.permission === 'denied') {
        setNotificationStatus('denied'); 
        toast({ title: "Permission Denied", description: "Please enable notifications in your browser settings for this site.", variant: "destructive" });
        if (user.fcmToken) await updateUserFCMToken(user.uid, null); 
        return;
    }
    if (Notification.permission === 'granted' && user.fcmToken) {
        setNotificationStatus('granted'); 
        toast({ title: "Notifications", description: "Notifications are already enabled."});
        return;
    }

    setIsProcessingFCM(true);
    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission); 

      if (permission === 'granted') {
        const currentToken = await getToken(messaging, { vapidKey: "BFYxArauaN91bGFF6uqe6uljMXgcvXJtUSc_BDmUG4EjiVSaAhBZ2uwxWnGFiwm9oWGzMx6YPBGnijsE0OcP0no" }); 
        if (currentToken) {
          await updateUserFCMToken(user.uid, currentToken);
        } else {
          toast({ title: "Token Error", description: "Could not retrieve notification token. Ensure your VAPID key is correct and Firebase setup is complete.", variant: "destructive" });
          await updateUserFCMToken(user.uid, null); 
        }
      } else if (permission === 'denied') {
        toast({ title: "Permission Denied", description: "You will not receive notifications.", variant: "destructive" });
        await updateUserFCMToken(user.uid, null); 
      } else { 
        toast({ title: "Notifications", description: "Permission not granted. You can try again later." });
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast({ title: "Notification Setup Error", description: "An error occurred. See console for details.", variant: "destructive" });
       if(user.uid) await updateUserFCMToken(user.uid, null); 
    } finally {
      setIsProcessingFCM(false);
    }
  };


  if (!user) return null;
  
  const displayName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.displayName || user.email || 'User';

  const displayEmail = user.email;
  const displayPhoneNumber = user.phoneNumber;

  const isNotificationFeatureAvailable = notificationStatus !== 'unavailable' && !!messaging;
  const isCurrentlyEnabledWithToken = notificationStatus === 'granted' && !!user.fcmToken;
  const isPermissionHardDenied = notificationStatus === 'denied';


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <UserIcon className="h-6 w-6 text-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 rounded-lg shadow-xl mt-2" align="end" forceMount>
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
          
          {isNotificationFeatureAvailable ? (
            <DropdownMenuItem
              onClick={handleEnableNotifications}
              disabled={isProcessingFCM || isCurrentlyEnabledWithToken || isPermissionHardDenied}
              className="text-base py-2.5 px-3 cursor-pointer"
            >
              {isProcessingFCM ? (
                <LoadingSpinner className="mr-2 h-4 w-4" />
              ) : isCurrentlyEnabledWithToken ? (
                <BellRing className="mr-2 h-4 w-4 text-green-500" />
              ) : isPermissionHardDenied ? (
                <BellOff className="mr-2 h-4 w-4 text-destructive" />
              ) : ( 
                <BellRing className="mr-2 h-4 w-4" />
              )}
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
          ) : (
            <DropdownMenuItem disabled className="text-base py-2.5 px-3 cursor-not-allowed">
              <BellOff className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Notifications N/A</span>
            </DropdownMenuItem>
          )}

        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-base py-2.5 px-3 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

