/**
 * @fileoverview Barber Login Page.
 * This page provides the login interface specifically for users with the 'barber' role.
 * It uses the `AuthFormWrapper` for consistent styling and `LoginForm` for the actual form logic.
 */
import AuthFormWrapper from '@/components/auth/AuthFormWrapper'; // Wrapper component for auth forms.
import LoginForm from '@/components/auth/LoginForm'; // Reusable login form component.

/**
 * BarberLoginPage component.
 * Renders the login form tailored for barbers.
 *
 * @returns {JSX.Element} The rendered barber login page.
 */
export default function BarberLoginPage() {
  return (
    // AuthFormWrapper provides the common layout and styling for authentication pages.
    <AuthFormWrapper
      title="Login" // Title displayed on the form.
      description="Welcome back, Barber! Please sign in." // Description text.
      role="barber" // Specifies the role for this login form, used for UI and redirection.
      footerLink={{ // Link for users who don't have an account.
        label: "Don't have an account?",
        text: "Register",
        href: "/barber/register" // Directs to the barber registration page.
      }}
    >
      {/* LoginForm component handles the email/password input and submission logic. */}
      <LoginForm role="barber" />
    </AuthFormWrapper>
  );
}
