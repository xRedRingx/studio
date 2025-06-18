/**
 * @fileoverview ForgotPasswordForm component.
 * This component provides a form for users to request a password reset link.
 * It takes an email address as input and uses the `useAuth` hook to send
 * the reset request via Firebase Authentication.
 */
'use client';

import { useForm } from 'react-hook-form'; // Hook for form handling and validation.
import { zodResolver } from '@hookform/resolvers/zod'; // Resolver for Zod schema validation with react-hook-form.
import * as z from 'zod'; // Zod library for schema declaration and validation.
import { Button } from '@/components/ui/button'; // Button UI component.
import { Input } from '@/components/ui/input'; // Input UI component.
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Form UI components from ShadCN.
import { useAuth } from '@/hooks/useAuth'; // Custom hook for accessing authentication context and functions.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI component.
import { useToast } from '@/hooks/use-toast'; // Custom hook for displaying toast notifications.

// Zod schema for validating the forgot password form input.
const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"), // Email field must be a valid email format.
});
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>; // Type inferred from the schema.

/**
 * ForgotPasswordForm component.
 * Renders a form for users to submit their email to receive a password reset link.
 *
 * @returns {JSX.Element} The rendered forgot password form.
 */
export default function ForgotPasswordForm() {
  // Get the sendPasswordResetLink function and auth processing state from AuthContext.
  const { sendPasswordResetLink, isProcessingAuth } = useAuth();
  const { toast } = useToast(); // Hook for displaying notifications.

  // Initialize react-hook-form with Zod resolver and default values.
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  /**
   * Handles the submission of the forgot password form.
   * Calls the `sendPasswordResetLink` function from AuthContext.
   *
   * @param {ForgotPasswordFormValues} values - The form values containing the email.
   */
  async function onSubmit(values: ForgotPasswordFormValues) {
    try {
      // Attempt to send the password reset email.
      await sendPasswordResetLink(values.email);
      // Display a success/informative toast regardless of whether an account exists for that email
      // (this is standard practice for password reset flows to avoid disclosing account existence).
      toast({
        title: "Check Your Email",
        description: "If an account exists for this email, a password reset link has been sent.",
      });
      form.reset(); // Reset the form fields.
    } catch (error) {
      // Errors (e.g., network issues) are typically handled by the `sendPasswordResetLink`
      // function in AuthContext, which will also show a toast.
      // This catch block prevents unhandled promise rejections in this component.
      console.error('Forgot password form error:', error);
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
                <Input
                  type="email"
                  placeholder="e.g. user@example.com"
                  {...field} // Spread field props from react-hook-form controller.
                  className="text-base h-12 rounded-md"
                  autoComplete="email" // HTML autocomplete attribute.
                  inputMode="email" // Hint for mobile keyboards.
                  disabled={isProcessingAuth} // Disable input while processing.
                />
              </FormControl>
              <FormMessage /> {/* Displays validation errors for this field. */}
            </FormItem>
          )}
        />
        {/* Submit button. */}
        <Button type="submit" className="w-full h-14 rounded-full text-lg" disabled={isProcessingAuth}>
          {isProcessingAuth && <LoadingSpinner className="mr-2 h-5 w-5" />} {/* Show spinner if processing. */}
          {isProcessingAuth ? 'Sending Link...' : 'Send Reset Link'}
        </Button>
      </form>
    </Form>
  );
}
