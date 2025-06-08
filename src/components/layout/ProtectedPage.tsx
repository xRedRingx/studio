'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/ui/loading-spinner';
import type { UserRole } from '@/types';

interface ProtectedPageProps {
  children: ReactNode;
  expectedRole?: UserRole; // Make expectedRole optional, can be used by specific dashboards
}

export default function ProtectedPage({ children, expectedRole }: ProtectedPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, loadingAuth, initialRoleChecked } = useAuth();

  useEffect(() => {
    if (loadingAuth || !initialRoleChecked) {
      return; // Wait until auth state and initial role check are fully processed
    }

    if (!user) {
      // Not logged in, redirect to home which will handle role selection or login
      router.replace('/');
      return;
    }

    // If an expectedRole is provided (e.g. for /customer/dashboard, expectedRole = 'customer')
    // and the current user's role does not match, redirect.
    // This provides an additional layer of client-side route protection.
    if (expectedRole && role && role !== expectedRole) {
      // Logged in, but wrong role for this specific dashboard.
      // Redirect to their actual dashboard or home.
      router.replace(`/${role}/dashboard`); 
      return;
    }
    
    // Also check pathname consistency if expectedRole is not directly passed
    // This is a simpler check if this component wraps a generic protected layout
    const pathRole = pathname.split('/')[1] as UserRole;
    if (role && pathRole && ['customer', 'barber'].includes(pathRole) && role !== pathRole) {
        router.replace(`/${role}/dashboard`);
    }


  }, [user, role, loadingAuth, initialRoleChecked, router, expectedRole, pathname]);

  if (loadingAuth || !initialRoleChecked || !user ) {
    // Show loading spinner if auth state is still loading, initial role not checked, or user is null (while redirecting)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner className="h-12 w-12 text-primary" />
      </div>
    );
  }
  
  // If an expectedRole is provided and it doesn't match the user's current role (even if logged in),
  // show loading spinner while redirecting.
  if (expectedRole && role && role !== expectedRole) {
     return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner className="h-12 w-12 text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
