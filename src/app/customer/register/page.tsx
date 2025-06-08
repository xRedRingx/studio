import AuthFormWrapper from '@/components/auth/AuthFormWrapper';
import RegistrationForm from '@/components/auth/RegistrationForm';

export default function CustomerRegistrationPage() {
  return (
    <AuthFormWrapper
      title="Create Customer Account"
      description="Sign up to start booking appointments."
      role="customer"
      footerLink={{
        label: "Already have an account?",
        text: "Login",
        href: "/customer/login"
      }}
    >
      <RegistrationForm role="customer" />
    </AuthFormWrapper>
  );
}
