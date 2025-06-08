
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
import { LogOut, User as UserIcon, Phone, Mail } from "lucide-react"; // Added Phone and Mail icons
import { useRouter } from "next/navigation";

export default function UserNav() {
  const { user, signOut, role } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/'); 
  };

  if (!user) return null;

  const getInitials = (name?: string | null, fallbackName?: string | null) => {
    const targetName = name || fallbackName;
    if (!targetName) return "?";
    const names = targetName.split(' ');
    if (names.length > 1 && names[0] && names[names.length - 1]) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    if (targetName && targetName.length > 0) {
      return targetName.substring(0, 2).toUpperCase();
    }
    return "?";
  };
  
  const displayName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.displayName || user.phoneNumber || 'User';

  // Prioritize phone number for display, as email is no longer actively collected
  const contactInfo = user.phoneNumber; 
  const displayEmail = user.email; // Still check if an old email exists

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.photoURL || undefined} alt={displayName || "User avatar"} />
            <AvatarFallback>{getInitials(displayName, user.phoneNumber)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            {contactInfo && (
              <p className="text-xs leading-none text-muted-foreground flex items-center">
                <Phone className="mr-1.5 h-3 w-3" />
                {contactInfo}
              </p>
            )}
            {/* Conditionally display email if it exists (e.g., for older accounts) */}
            {displayEmail && (
              <p className="text-xs leading-none text-muted-foreground flex items-center pt-0.5">
                <Mail className="mr-1.5 h-3 w-3" />
                {displayEmail}
              </p>
            )}
            {role && <p className="text-xs leading-none text-muted-foreground capitalize pt-1">Role: {role}</p>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push(`/${role}/dashboard`)}>
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </DropdownMenuItem>
          {/* Add more items like Profile, Settings etc. here */}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
