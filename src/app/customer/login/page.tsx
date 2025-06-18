/**
 * @fileoverview Customer Login Page.
 * This page provides the login interface specifically for users with the 'customer' role.
 * It uses the `AuthFormWrapper` for consistent styling and `LoginForm` for the actual form logic.
 */
import AuthFormWrapper from '@/components/auth/AuthFormWrapper'; // Wrapper component for auth forms.
import LoginForm from '@/components/auth/LoginForm'; // Reusable login form component.

/**
 * CustomerLoginPage component.
 * Renders the login form tailored for customers.
 *
 * @returns {JSX.Element} The rendered customer login page.
 */
export default function CustomerLoginPage() {
  return (
    // AuthFormWrapper provides the common layout and styling for authentication pages.
    <AuthFormWrapper
      title="Login" // Title displayed on the form.
      description="Welcome back, Customer! Please sign in." // Description text.
      role="customer" // Specifies the role for this login form.
      footerLink={{ // Link for users who don't have an account.
        label: "Don't have an account?",
        text: "Register",
        href: "/customer/register" // Directs to the customer registration page.
      }}
    >
      {/* LoginForm component handles the email/password input and submission logic. */}
      <LoginForm role="customer" />
    </AuthFormWrapper>
  );
}
