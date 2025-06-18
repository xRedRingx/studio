/**
 * @fileoverview Barber Verification Page.
 * This page is a preliminary step for users wishing to register as barbers.
 * It requires a specific verification code (hardcoded for this version) to proceed.
 * Incorrect attempts are tracked, and after a maximum number of failed attempts,
 * the user is redirected to customer registration.
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Hook for programmatic navigation.
import { useForm } from 'react-hook-form'; // Hook for form handling and validation.
import { zodResolver } from '@hookform/resolvers/zod'; // Resolver for Zod schema validation with react-hook-form.
import * as z from 'zod'; // Zod library for schema declaration and validation.
import AuthFormWrapper from '@/components/auth/AuthFormWrapper'; // Wrapper component for auth forms.
import { Input } from '@/components/ui/input'; // Input UI component.
import { Button } from '@/components/ui/button'; // Button UI component.
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Form UI components.
import { useAuth } from '@/hooks/useAuth'; // Auth context hook.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.
import { useToast } from '@/hooks/use-toast'; // Toast notification hook.

// The hardcoded verification password/code for barbers.
// In a real application, this would be managed securely or dynamically.
const BARBER_VERIFICATION_PASSWORD = "LIAMANIELMAHDIco";
// Maximum number of incorrect verification attempts allowed.
const MAX_ATTEMPTS = 2;

// Zod schema for validating the verification form input.
const verificationSchema = z.object({
  password: z.string().min(1, "Verification code is required"), // Password field must not be empty.
});
type VerificationFormValues = z.infer<typeof verificationSchema>; // Type inferred from the schema.

/**
 * BarberVerifyPage component.
 * Renders the verification form for prospective barbers.
 *
 * @returns {JSX.Element} The rendered barber verification page.
 */
export default function BarberVerifyPage() {
  const router = useRouter(); // Next.js router instance.
  const { setRole, isProcessingAuth, setIsProcessingAuth } = useAuth(); // Get functions and state from AuthContext.
  const { toast } = useToast(); // For displaying notifications.
  const [attempts, setAttempts] = useState(0); // Tracks the number of failed verification attempts.

  // Initialize react-hook-form with Zod resolver.
  const form = useForm<VerificationFormValues>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { password: '' },
  });

  // Effect to redirect if max attempts are already reached (e.g., user navigates back).
  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS) {
      toast({
        title: "Too many attempts",
        description: "Redirecting to customer registration.",
        variant: "destructive",
      });
      router.replace('/customer/register'); // Redirect to customer registration.
    }
  }, [attempts, router, toast]);

  /**
   * Handles the submission of the verification form.
   * Checks the entered password against the `BARBER_VERIFICATION_PASSWORD`.
   * On success, sets the role to 'barber' and redirects to barber registration.
   * On failure, increments attempts and shows an error; redirects if max attempts reached.
   *
   * @param {VerificationFormValues} values - The form values.
   */
  async function onSubmit(values: VerificationFormValues) {
    setIsProcessingAuth(true); // Indicate that an auth-related process is starting.
    if (values.password === BARBER_VERIFICATION_PASSWORD) {
      // Verification successful.
      setRole('barber'); // Set the role in AuthContext.
      toast({
        title: "Verification Successful",
        description: "Proceeding to barber registration.",
      });
      router.replace('/barber/register'); // Navigate to the barber registration page.
    } else {
      // Verification failed.
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      form.resetField("password"); // Clear the password field.
      if (newAttempts >= MAX_ATTEMPTS) {
        // Max attempts reached.
        toast({
          title: "Verification Failed",
          description: `Incorrect code. Redirecting to customer registration.`,
          variant: "destructive",
        });
        router.replace('/customer/register'); // Redirect to customer registration.
      } else {
        // Attempts remaining.
        toast({
          title: "Incorrect Code",
          description: `Please try again. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`,
          variant: "destructive",
        });
      }
    }
    setIsProcessingAuth(false); // Indicate that the auth-related process has finished.
  }

  return (
    // AuthFormWrapper provides the common layout for authentication pages.
    <AuthFormWrapper
      title="Barber Verification"
      description="Please enter the verification code to proceed as a barber."
      footerLink={{ // Link for users who are not barbers.
        label: "Not a barber?",
        text: "Register as Customer",
        href: "/customer/register"
      }}
    >
      {/* The verification form. */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Verification Code</FormLabel>
                <FormControl>
                  <Input
                    type="password" // Input type is password to obscure the code.
                    placeholder="Enter code"
                    {...field}
                    className="text-base h-12"
                    autoComplete="one-time-code" // Hint for password managers.
                    disabled={isProcessingAuth || attempts >= MAX_ATTEMPTS} // Disable if processing or max attempts reached.
                  />
                </FormControl>
                <FormMessage /> {/* Displays validation errors for this field. */}
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full h-14 rounded-full text-lg"
            disabled={isProcessingAuth || attempts >= MAX_ATTEMPTS} // Disable if processing or max attempts reached.
          >
            {isProcessingAuth && <LoadingSpinner className="mr-2 h-5 w-5" />} {/* Show spinner when processing. */}
            {isProcessingAuth ? 'Verifying...' : 'Verify & Proceed'}
          </Button>
        </form>
      </Form>
    </AuthFormWrapper>
  );
}
