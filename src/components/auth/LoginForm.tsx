
/**
 * @fileoverview LoginForm component.
 * This component provides a reusable login form with email and password fields.
 * It uses `react-hook-form` for form handling, Zod for validation, and the
 * `useAuth` hook to perform the sign-in operation. It also handles redirection
 * to the appropriate dashboard upon successful login based on the provided role.
 */
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form'; // Hook for form handling and validation.
import { zodResolver } from '@hookform/resolvers/zod'; // Resolver for Zod schema validation.
import * as z from 'zod'; // Zod library for schema declaration.
import { useRouter } from 'next/navigation'; // Hook for programmatic navigation.
import Link from 'next/link'; // Next.js Link component for client-side navigation.
import { Button } from '@/components/ui/button'; // Button UI component.
import { Input } from '@/components/ui/input'; // Input UI component.
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Form UI components.
import { useAuth } from '@/hooks/useAuth'; // Custom hook for authentication context.
import type { UserRole } from '@/types'; // Type definition for user roles.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.

// Zod schema for login form validation.
const loginSchema = z.object({
  email: z.string().email("Invalid email address"), // Email must be a valid email format.
  password: z.string().min(1, "Password is required"), // Password must not be empty.
});
type LoginFormValues = z.infer<typeof loginSchema>; // Type inferred from the Zod schema.

/**
 * Props for the LoginForm component.
 * @interface LoginFormProps
 * @property {UserRole} role - The role of the user attempting to log in (customer or barber).
 *                             This is used for redirection after successful login.
 */
interface LoginFormProps {
  role: UserRole;
}

/**
 * LoginForm component.
 * Renders a login form with email and password fields.
 *
 * @param {LoginFormProps} props - The component's props.
 * @returns {JSX.Element} The rendered login form.
 */
export default function LoginForm({ role }: LoginFormProps) {
  const router = useRouter(); // Next.js router instance.
  // Get user object, signIn function, and auth processing state from AuthContext.
  const { user, signInWithEmailAndPassword, isProcessingAuth } = useAuth();

  // Initialize react-hook-form with Zod resolver and default values.
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Effect to redirect the user to their dashboard if they are already logged in
  // and their role matches the form's role. This handles cases where a logged-in user
  // navigates back to the login page.
  useEffect(() => {
    if (user && role) {
      router.push(`/${role}/dashboard`);
    }
  }, [user, role, router]); // Dependencies for the effect.

  /**
   * Handles the submission of the login form.
   * Calls the `signInWithEmailAndPassword` function from AuthContext.
   *
   * @param {LoginFormValues} values - The form values (email and password).
   */
  async function onSubmit(values: LoginFormValues) {
    try {
      // Attempt to sign in the user.
      await signInWithEmailAndPassword(values.email, values.password);
      // Successful login is handled by the onAuthStateChanged listener in AuthContext,
      // which will update the `user` state and trigger the useEffect above for redirection.
    } catch (error) {
      // Errors (e.g., incorrect credentials, network issues) are typically handled
      // by the `signInWithEmailAndPassword` function in AuthContext, which shows a toast.
      // This catch block prevents unhandled promise rejections in this component.
      // Resetting password field for security/UX on failed login attempt.
      console.error('Login form error:', error);
      form.resetField("password");
    }
  }

  return (
    // Form component from ShadCN UI, integrated with react-hook-form.
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
        {/* Email input field. */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Email Address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="e.g. user@example.com" {...field} className="text-base h-12 rounded-md" autoComplete="email" inputMode="email" disabled={isProcessingAuth} />
              </FormControl>
              <FormMessage /> {/* Displays validation errors for this field. */}
            </FormItem>
          )}
        />
        {/* Password input field. */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel className="text-base">Password</FormLabel>
                {/* Link to the forgot password page. */}
                <Link href="/forgot-password" role="link" tabIndex={0} className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm">
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <Input type="password" placeholder="Enter password" {...field} className="text-base h-12 rounded-md" autoComplete="current-password" disabled={isProcessingAuth} />
              </FormControl>
              <FormMessage /> {/* Displays validation errors for this field. */}
            </FormItem>
          )}
        />
        {/* Submit button. */}
        <Button type="submit" className="w-full h-14 rounded-full text-lg" disabled={isProcessingAuth}>
          {isProcessingAuth && <LoadingSpinner className="mr-2 h-5 w-5" />} {/* Show spinner if processing. */}
          {isProcessingAuth ? 'Logging In...' : 'Login'}
        </Button>
      </form>
    </Form>
  );
}
