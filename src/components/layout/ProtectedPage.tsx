/**
 * @fileoverview ProtectedPage component.
 * This component acts as a route guard, ensuring that only authenticated users
 * (and optionally, users with a specific role) can access the child components/pages.
 * If authentication or role checks fail, it redirects the user appropriately.
 * It displays a loading spinner while authentication status is being determined.
 */
'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Next.js hooks for routing.
import { useAuth } from '@/hooks/useAuth'; // Custom hook for authentication context.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI component.
import type { UserRole } from '@/types'; // Type definition for user roles.

/**
 * Props for the ProtectedPage component.
 * @interface ProtectedPageProps
 * @property {ReactNode} children - The content to be rendered if authentication and role checks pass.
 * @property {UserRole} [expectedRole] - Optional. If provided, the user must also have this role to access the content.
 */
interface ProtectedPageProps {
  children: ReactNode;
  expectedRole?: UserRole;
}

/**
 * ProtectedPage component.
 * A higher-order component that wraps pages/content requiring authentication.
 *
 * @param {ProtectedPageProps} props - The component's props.
 * @returns {JSX.Element} The child content if authorized, or a loading spinner during checks/redirection.
 */
export default function ProtectedPage({ children, expectedRole }: ProtectedPageProps) {
  const router = useRouter(); // Next.js router instance for navigation.
  const pathname = usePathname(); // Current route's pathname.
  // Get user, role, loading state, and initial role check status from AuthContext.
  const { user, role, loadingAuth, initialRoleChecked } = useAuth();

  // Effect to perform authentication and role checks.
  // Runs when auth state, role, loading status, or route path changes.
  useEffect(() => {
    // Wait until authentication is no longer loading and the initial role check from AuthContext is complete.
    if (loadingAuth || !initialRoleChecked) {
      return; // Do nothing further until auth state is fully resolved.
    }

    // --- Case 1: User is not logged in ---
    if (!user) {
      // Redirect to the root page ('/'). The root page will then handle
      // either showing the RoleSelector or redirecting to a specific login page
      // if a role was persisted in localStorage.
      router.replace('/');
      return;
    }

    // --- Case 2: User is logged in, but role does not match `expectedRole` (if provided) ---
    // This is for pages that are role-specific (e.g., a customer trying to access /barber/dashboard).
    if (expectedRole && role && role !== expectedRole) {
      // Logged in, but has the wrong role for this specific page.
      // Redirect to their actual dashboard based on their `role`.
      router.replace(`/${role}/dashboard`);
      return;
    }

    // --- Case 3: User is logged in, general pathname consistency check ---
    // This is a broader check for protected layouts. If the current URL path
    // implies a role (e.g., '/customer/...') and it doesn't match the user's actual role, redirect.
    // This helps ensure that if a user somehow lands on a mismatched protected route segment
    // (e.g., manually typing URL), they are redirected.
    const pathRole = pathname.split('/')[1] as UserRole; // Extract first segment (potential role).
    if (role && pathRole && ['customer', 'barber'].includes(pathRole) && role !== pathRole) {
        router.replace(`/${role}/dashboard`);
    }

  }, [user, role, loadingAuth, initialRoleChecked, router, expectedRole, pathname]); // Dependencies for the effect.

  // --- Loading State Display ---
  // Show a loading spinner if:
  // 1. Authentication is still loading (`loadingAuth` is true).
  // 2. The initial role check by AuthContext hasn't completed (`initialRoleChecked` is false).
  // 3. The user object is null (which might be a transient state during logout/redirect).
  if (loadingAuth || !initialRoleChecked || !user ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner className="h-12 w-12 text-primary" />
      </div>
    );
  }

  // Also show loading spinner if an `expectedRole` is provided, the user has a role,
  // but it doesn't match the `expectedRole`. This covers the brief period while
  // the redirection (from the useEffect hook) is taking place.
  if (expectedRole && role && role !== expectedRole) {
     return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner className="h-12 w-12 text-primary" />
      </div>
    );
  }

  // If all checks pass (user is authenticated and, if applicable, has the expected role),
  // render the child components.
  return <>{children}</>;
}
