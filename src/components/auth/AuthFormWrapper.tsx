/**
 * @fileoverview AuthFormWrapper component.
 * This component provides a consistent layout and styling for all authentication-related forms
 * (e.g., Login, Registration, Forgot Password, Verification).
 * It includes a card structure, application logo, title, description, and an optional footer link.
 */
import type { ReactNode } from 'react';
import Link from 'next/link'; // Next.js Link component for client-side navigation.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Card UI components from ShadCN.
import { BarberFlowLogo } from '@/components/icons/BarberFlowLogo'; // Application logo component.
import type { UserRole } from '@/types'; // Type definition for user roles.

/**
 * Props for the AuthFormWrapper component.
 * @interface AuthFormWrapperProps
 * @property {string} title - The main title displayed at the top of the form card.
 * @property {string} description - A short description or instruction below the title.
 * @property {UserRole} [role] - Optional role (customer/barber) to be appended to the title if provided.
 * @property {ReactNode} children - The actual form content (e.g., LoginForm, RegistrationForm) to be rendered inside the card.
 * @property {object} [footerLink] - Optional object to define a link in the footer of the wrapper.
 * @property {string} footerLink.href - The URL for the footer link.
 * @property {string} footerLink.text - The clickable text for the footer link.
 * @property {string} footerLink.label - The descriptive label preceding the footer link text.
 */
interface AuthFormWrapperProps {
  title: string;
  description: string;
  role?: UserRole;
  children: ReactNode;
  footerLink?: { href: string; text: string; label: string };
}

/**
 * AuthFormWrapper component.
 * A reusable wrapper for authentication forms, providing a consistent UI structure.
 *
 * @param {AuthFormWrapperProps} props - The component's props.
 * @returns {JSX.Element} The rendered authentication form wrapper.
 */
export default function AuthFormWrapper({ title, description, role, children, footerLink }: AuthFormWrapperProps) {
  // Capitalize the role if provided, for display in the title.
  const roleText = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';

  return (
    // Full-screen flex container to center the card.
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/10 to-background p-4 sm:p-6">
      {/* Card component to contain the form. */}
      <Card className="w-full max-w-md shadow-xl border-none rounded-xl bg-card/90 backdrop-blur-sm">
        <CardHeader className="text-center p-6 md:p-8">
          {/* Application Logo, linking to the homepage. */}
          <Link href="/" aria-label="Go to homepage" className="mx-auto mb-6 flex justify-center">
            <BarberFlowLogo className="h-10 w-auto" />
          </Link>
          {/* Title of the form, optionally including the role. */}
          <CardTitle className="font-headline text-xl sm:text-2xl font-bold">{title} {roleText}</CardTitle>
          {/* Description text below the title. */}
          <CardDescription className="text-sm sm:text-base text-gray-500 dark:text-gray-400 pt-2">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 md:px-8 md:pb-8">
          {/* Renders the specific form content passed as children. */}
          {children}
        </CardContent>
      </Card>
      {/* Optional footer link, e.g., "Don't have an account? Register". */}
      {footerLink && (
         <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 px-4">
          {footerLink.label}{' '}
          <Link href={footerLink.href} className="font-medium text-primary hover:underline">
            {footerLink.text}
          </Link>
        </p>
      )}
    </div>
  );
}
