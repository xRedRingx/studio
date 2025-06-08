'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import RoleSelector from '@/components/auth/RoleSelector';
import LoadingSpinner from '@/components/ui/loading-spinner';

export default function RootPage() {
  const router = useRouter();
  const { user, role, loadingAuth, initialRoleChecked } = useAuth();

  useEffect(() => {
    if (loadingAuth || !initialRoleChecked) {
      // Still loading authentication state or initial role from localStorage
      return;
    }

    if (user && role) {
      // User is logged in and role is known
      router.replace(`/${role}/dashboard`);
    } else if (role) {
      // Role is known, but user not logged in (or auth state still loading for user but role is definite)
      router.replace(`/${role}/login`);
    }
    // If no role after initial checks, RoleSelector will be rendered below
  }, [user, role, loadingAuth, initialRoleChecked, router]);

  if (loadingAuth || !initialRoleChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner className="h-12 w-12 text-primary" />
      </div>
    );
  }

  // If initial checks are done, auth is not loading, and still no role, show selector.
  // This covers the case where neither of the useEffect redirects happened.
  if (!role) {
    return <RoleSelector />;
  }

  // Fallback loading state while redirects are processing or if none of the conditions are met
  // (e.g. role exists, user exists, but router.replace is async)
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoadingSpinner className="h-12 w-12 text-primary" />
    </div>
  );
}
