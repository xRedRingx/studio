import AuthFormWrapper from '@/components/auth/AuthFormWrapper';
import RegistrationForm from '@/components/auth/RegistrationForm';

export default function BarberRegistrationPage() {
  return (
    <AuthFormWrapper
      title="Create Barber Account"
      description="Join our platform and manage your services."
      role="barber"
      footerLink={{
        label: "Already have an account?",
        text: "Login",
        href: "/barber/login"
      }}
    >
      <RegistrationForm role="barber" />
    </AuthFormWrapper>
  );
}
