/**
 * @fileoverview Forgot Password Page.
 * This page provides a form for users to request a password reset link.
 * Users enter their email address, and if an account exists for that email,
 * a reset link is sent by Firebase Authentication.
 */
import AuthFormWrapper from '@/components/auth/AuthFormWrapper'; // Wrapper component for auth forms.
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'; // Component containing the forgot password form logic.

/**
 * ForgotPasswordPage component.
 * Renders the forgot password form.
 *
 * @returns {JSX.Element} The rendered forgot password page.
 */
export default function ForgotPasswordPage() {
  return (
    // AuthFormWrapper provides consistent styling for authentication-related pages.
    <AuthFormWrapper
      title="Forgot Password" // Title of the form.
      description="Enter your email address and we'll send you a link to reset your password." // Instructions for the user.
      // Optional footer link to navigate back to login if the user remembers their password.
      // Redirects to the root page, which handles role selection and then login.
      footerLink={{
        label: "Remember your password?",
        text: "Login",
        href: "/"
      }}
    >
      {/* ForgotPasswordForm handles the email input and submission logic. */}
      <ForgotPasswordForm />
    </AuthFormWrapper>
  );
}
