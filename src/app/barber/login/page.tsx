import AuthFormWrapper from '@/components/auth/AuthFormWrapper';
import LoginForm from '@/components/auth/LoginForm';

export default function BarberLoginPage() {
  return (
    <AuthFormWrapper
      title="Login"
      description="Welcome back, Barber! Please sign in."
      role="barber"
      footerLink={{
        label: "Don't have an account?",
        text: "Register",
        href: "/barber/register"
      }}
    >
      <LoginForm role="barber" />
    </AuthFormWrapper>
  );
}
