/**
 * @fileoverview Root Page (Homepage / Entry Point).
 * This page serves as the initial entry point for the application.
 * Its primary responsibility is to determine the user's authentication status and role,
 * and then redirect them to the appropriate page:
 * - If logged in and role is known: Redirect to the corresponding dashboard (e.g., /customer/dashboard).
 * - If not logged in but role is known (e.g., from previous session/localStorage): Redirect to the role's login page.
 * - If not logged in and role is unknown: Display the `RoleSelector` component.
 * It shows a loading spinner while authentication status is being checked.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Hook for programmatic navigation.
import { useAuth } from '@/hooks/useAuth'; // Auth context hook for user data, role, and loading states.
import RoleSelector from '@/components/auth/RoleSelector'; // Component for users to select their role.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.
import { LOCAL_STORAGE_ROLE_KEY } from '@/lib/constants'; // Constant for local storage key.

/**
 * RootPage component.
 * Handles initial routing based on authentication state and user role.
 *
 * @returns {JSX.Element} The rendered page content (either RoleSelector or a loading spinner during checks).
 */
export default function RootPage() {
  const router = useRouter(); // Next.js router instance.
  // Get user, role, loading state, and role check status from AuthContext.
  const { user, role: contextRole, loadingAuth, initialRoleChecked, setRole } = useAuth();

  // Effect to handle redirection logic based on auth state and role.
  // Runs when user, contextRole, loadingAuth, or initialRoleChecked changes.
  useEffect(() => {
    // Wait until authentication is no longer loading and the initial role check has been performed.
    if (loadingAuth || !initialRoleChecked) {
      return; // Do nothing until auth state is resolved.
    }

    // Determine the effective role: prioritize context, then localStorage.
    let determinedRole = contextRole;
    if (!determinedRole && typeof window !== 'undefined') {
      // If context role is not set (e.g., after sign out, or on first load before context is populated),
      // try to get the role from localStorage (persisted from previous session).
      const storedRole = localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) as 'customer' | 'barber' | null;
      if (storedRole) {
        determinedRole = storedRole;
        // If a role was found in localStorage but not yet in the AuthContext,
        // update the AuthContext. This ensures consistency.
        if (!contextRole) {
          setRole(storedRole);
        }
      }
    }

    // --- Redirection Logic ---
    if (user && determinedRole) {
      // User is logged in and their role is known: redirect to their specific dashboard.
      router.replace(`/${determinedRole}/dashboard`);
    } else if (!user && determinedRole) {
      // User is NOT logged in, but their role is known (e.g., from localStorage):
      // redirect to the login page for that role.
      router.replace(`/${determinedRole}/login`);
    }
    // If no user is logged in AND no role is determined (neither from context nor localStorage),
    // the component will fall through to render the RoleSelector.

  }, [user, contextRole, loadingAuth, initialRoleChecked, router, setRole]); // Dependencies for the effect.


  // Show a loading spinner if authentication is still processing or initial role check is pending.
  if (loadingAuth || !initialRoleChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner className="h-12 w-12 text-primary" />
      </div>
    );
  }

  // If, after all checks, there's no authenticated user and no role determined
  // (neither from AuthContext nor from localStorage), display the RoleSelector.
  // This typically happens on a fresh visit or after a user logs out and clears their role.
  const roleFromStorage = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) : null;
  if (!user && !contextRole && !roleFromStorage) {
    return <RoleSelector />;
  }

  // Fallback loading state: displayed briefly while redirects are processing
  // or if none of the above conditions for rendering RoleSelector or redirecting are met.
  // This helps prevent a flash of unstyled content or an empty page.
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoadingSpinner className="h-12 w-12 text-primary" />
    </div>
  );
}
