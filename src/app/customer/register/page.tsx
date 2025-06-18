/**
 * @fileoverview Customer Registration Page.
 * This page provides the registration interface specifically for users who intend to be 'customers'.
 * It uses the `AuthFormWrapper` for consistent styling and `RegistrationForm` for the actual form logic.
 */
import AuthFormWrapper from '@/components/auth/AuthFormWrapper'; // Wrapper component for auth forms.
import RegistrationForm from '@/components/auth/RegistrationForm'; // Reusable registration form component.

/**
 * CustomerRegistrationPage component.
 * Renders the registration form tailored for customers.
 *
 * @returns {JSX.Element} The rendered customer registration page.
 */
export default function CustomerRegistrationPage() {
  return (
    // AuthFormWrapper provides the common layout and styling for authentication pages.
    <AuthFormWrapper
      title="Create Customer Account" // Title displayed on the form.
      description="Sign up to start booking appointments." // Description text.
      role="customer" // Specifies the role for this registration form.
      footerLink={{ // Link for users who already have an account.
        label: "Already have an account?",
        text: "Login",
        href: "/customer/login" // Directs to the customer login page.
      }}
    >
      {/* RegistrationForm component handles input fields and submission for new customer accounts. */}
      <RegistrationForm role="customer" />
    </AuthFormWrapper>
  );
}
