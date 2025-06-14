
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import RoleSelector from '@/components/auth/RoleSelector';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { LOCAL_STORAGE_ROLE_KEY } from '@/lib/constants';

export default function RootPage() {
  const router = useRouter();
  const { user, role: contextRole, loadingAuth, initialRoleChecked, setRole } = useAuth();

  useEffect(() => {
    if (loadingAuth || !initialRoleChecked) {
      return;
    }

    let determinedRole = contextRole;
    if (!determinedRole && typeof window !== 'undefined') {
      // If context role is not set (e.g., after sign out), try to get from localStorage
      const storedRole = localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) as 'customer' | 'barber' | null;
      if (storedRole) {
        determinedRole = storedRole;
        // If found in localStorage and not in context, set it in context
        // This helps ensure consistency if onAuthStateChanged hasn't run yet or cleared it
        if (!contextRole) {
          setRole(storedRole); // This will update contextRole for subsequent renders/checks
        }
      }
    }

    if (user && determinedRole) {
      router.replace(`/${determinedRole}/dashboard`);
    } else if (!user && determinedRole) {
      // No user, but role is known (from localStorage, persisted through sign-out)
      router.replace(`/${determinedRole}/login`);
    }
    // If no user and no determinedRole, RoleSelector will be rendered below.
    
  }, [user, contextRole, loadingAuth, initialRoleChecked, router, setRole]);


  if (loadingAuth || !initialRoleChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner className="h-12 w-12 text-primary" />
      </div>
    );
  }
  
  // If, after all checks, there's still no role determined (neither from context nor localStorage),
  // and user is not logged in, show the RoleSelector.
  const roleFromStorage = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) : null;
  if (!user && !contextRole && !roleFromStorage) {
    return <RoleSelector />;
  }

  // Fallback loading state while redirects are processing or if none of the conditions are met.
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoadingSpinner className="h-12 w-12 text-primary" />
    </div>
  );
}
