
import AuthFormWrapper from '@/components/auth/AuthFormWrapper';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <AuthFormWrapper
      title="Forgot Password"
      description="Enter your email address and we'll send you a link to reset your password."
      footerLink={{
        label: "Remember your password?",
        text: "Login",
        href: "/" // Redirects to role selector which then goes to specific login
      }}
    >
      <ForgotPasswordForm />
    </AuthFormWrapper>
  );
}
