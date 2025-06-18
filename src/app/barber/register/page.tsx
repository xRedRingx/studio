/**
 * @fileoverview Barber Registration Page.
 * This page provides the registration interface specifically for users who intend to be 'barbers'.
 * It uses the `AuthFormWrapper` for consistent styling and `RegistrationForm` for the actual form logic.
 * This page is typically accessed after a barber successfully passes the verification step.
 */
import AuthFormWrapper from '@/components/auth/AuthFormWrapper'; // Wrapper component for auth forms.
import RegistrationForm from '@/components/auth/RegistrationForm'; // Reusable registration form component.

/**
 * BarberRegistrationPage component.
 * Renders the registration form tailored for barbers.
 *
 * @returns {JSX.Element} The rendered barber registration page.
 */
export default function BarberRegistrationPage() {
  return (
    // AuthFormWrapper provides the common layout and styling for authentication pages.
    <AuthFormWrapper
      title="Create Barber Account" // Title displayed on the form.
      description="Join our platform and manage your services." // Description text.
      role="barber" // Specifies the role for this registration form.
      footerLink={{ // Link for users who already have an account.
        label: "Already have an account?",
        text: "Login",
        href: "/barber/login" // Directs to the barber login page.
      }}
    >
      {/* RegistrationForm component handles input fields (name, email, password, etc.) and submission. */}
      <RegistrationForm role="barber" />
    </AuthFormWrapper>
  );
}
