
'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { LogOut, User as UserIcon, Phone, Mail, Settings, LayoutDashboard, Scissors, CalendarClock, CalendarOff, Edit } from "lucide-react"; 
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UserNav() {
  const { user, signOut, role } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/'); 
  };

  if (!user) return null;

  const getInitials = (firstName?: string | null, lastName?: string | null, email?: string | null) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return "?";
  };
  
  const displayName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.displayName || user.email || 'User';

  const displayEmail = user.email;
  const displayPhoneNumber = user.phoneNumber;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-primary/50">
            <AvatarImage src={user.photoURL || undefined} alt={displayName || "User avatar"} />
            <AvatarFallback className="text-base">{getInitials(user.firstName, user.lastName, user.email)}</AvatarFallback>
          </Avatar>
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
            </>
          )}
          {/* Placeholder for future settings if needed */}
          {/* <DropdownMenuItem className="text-base py-2.5 px-3">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem> */}
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
