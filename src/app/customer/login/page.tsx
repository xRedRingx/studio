import AuthFormWrapper from '@/components/auth/AuthFormWrapper';
import LoginForm from '@/components/auth/LoginForm';

export default function CustomerLoginPage() {
  return (
    <AuthFormWrapper
      title="Login"
      description="Welcome back, Customer! Please sign in."
      role="customer"
      footerLink={{
        label: "Don't have an account?",
        text: "Register",
        href: "/customer/register"
      }}
    >
      <LoginForm role="customer" />
    </AuthFormWrapper>
  );
}
