import AuthFormWrapper from '@/components/auth/AuthFormWrapper';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <AuthFormWrapper
      title="Forgot Password"
      description="Enter your email address and we'll send you a link to reset your password."
      footerLink={{
        label: "Remembered your password?",
        text: "Login",
        href: "/" // Or direct to a generic login if preferred, then role check happens
      }}
    >
      <ForgotPasswordForm />
    </AuthFormWrapper>
  );
}
