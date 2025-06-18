/**
 * @fileoverview RegistrationForm component.
 * This component provides a reusable registration form for new users.
 * It includes fields for first name, last name, email, optional phone number,
 * optional address, password, and confirm password.
 * It uses `react-hook-form` for form handling, Zod for validation, and the
 * `useAuth` hook to perform the registration operation.
 * It redirects to the appropriate dashboard upon successful registration based on the role.
 */
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form'; // Hook for form handling and validation.
import { zodResolver } from '@hookform/resolvers/zod'; // Resolver for Zod schema validation.
import * as z from 'zod'; // Zod library for schema declaration.
import { useRouter } from 'next/navigation'; // Hook for programmatic navigation.
import { Button } from '@/components/ui/button'; // Button UI component.
import { Input } from '@/components/ui/input'; // Input UI component.
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Form UI components.
import { useAuth } from '@/hooks/useAuth'; // Custom hook for authentication context.
import type { UserRole, AppUser } from '@/types'; // Type definitions for user roles and AppUser.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.

// Zod schema for registration form validation.
// Includes client-side validation for all fields, including password confirmation.
const userDetailsSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  email: z.string().email("Invalid email address"),
  // Phone number is optional but must match E.164 format if provided.
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format (e.g., +12223334444)").optional().or(z.literal('')),
  address: z.string().max(100, "Address must be less than 100 characters").optional().or(z.literal('')),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password must be at least 6 characters"),
}).refine(data => data.password === data.confirmPassword, { // Custom refinement to check if passwords match.
  message: "Passwords don't match",
  path: ["confirmPassword"], // Error message will be associated with the confirmPassword field.
});

type UserDetailsFormValues = z.infer<typeof userDetailsSchema>; // Type inferred from the Zod schema.

/**
 * Props for the RegistrationForm component.
 * @interface RegistrationFormProps
 * @property {UserRole} role - The role (customer or barber) for which the user is registering.
 */
interface RegistrationFormProps {
  role: UserRole;
}

/**
 * RegistrationForm component.
 * Renders a registration form for new users.
 *
 * @param {RegistrationFormProps} props - The component's props.
 * @returns {JSX.Element} The rendered registration form.
 */
export default function RegistrationForm({ role }: RegistrationFormProps) {
  const router = useRouter(); // Next.js router instance.
  // Get user object, registration function, and auth processing state from AuthContext.
  const { user, registerWithEmailAndPassword, isProcessingAuth } = useAuth();

  // Initialize react-hook-form with Zod resolver and default values.
  const form = useForm<UserDetailsFormValues>({
    resolver: zodResolver(userDetailsSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      address: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Effect to redirect the user to their dashboard if they are already logged in
  // and their role matches the form's role.
  useEffect(() => {
    if (user && role) {
      router.push(`/${role}/dashboard`);
    }
  }, [user, role, router]); // Dependencies for the effect.

  /**
   * Handles the submission of the registration form.
   * Calls the `registerWithEmailAndPassword` function from AuthContext.
   *
   * @param {UserDetailsFormValues} values - The form values.
   */
  async function onSubmit(values: UserDetailsFormValues) {
    // Debug log for form values (can be removed in production).
    console.log("RegistrationForm onSubmit values:", JSON.stringify(values, null, 2));
    try {
      // Prepare user details for the registration API.
      // The `password_original_do_not_use` field is a temporary name to avoid confusion
      // with any potential `password` field that might be directly stored in Firestore (which it shouldn't be).
      const userDetailsForApi: Omit<AppUser, 'uid' | 'createdAt' | 'updatedAt' | 'displayName' | 'emailVerified' | 'fcmToken'> & { password_original_do_not_use: string } = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phoneNumber: values.phoneNumber || null, // Ensure null if empty string.
        address: values.address || null, // Ensure null if empty string.
        password_original_do_not_use: values.password,
        role: role,
        // Default `isAcceptingBookings` to true for barbers, undefined for customers.
        isAcceptingBookings: role === 'barber' ? true : undefined,
      };
      // Attempt to register the user.
      await registerWithEmailAndPassword(userDetailsForApi);
      // Successful registration is handled by the onAuthStateChanged listener in AuthContext,
      // which will update the `user` state and trigger the useEffect above for redirection.
    } catch (error) {
      // Errors (e.g., email already in use, network issues) are typically handled
      // by the `registerWithEmailAndPassword` function in AuthContext, which shows a toast.
      // This catch block prevents unhandled promise rejections in this component.
      console.error('Registration form error:', error);
    }
  }

  return (
    // Form component from ShadCN UI, integrated with react-hook-form.
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
        {/* Grid layout for first name and last name fields. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">First Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter first name" {...field} className="text-base h-12 rounded-md" autoComplete="given-name" disabled={isProcessingAuth} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter last name" {...field} className="text-base h-12 rounded-md" autoComplete="family-name" disabled={isProcessingAuth} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Optional phone number input field. */}
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Phone Number (Optional)</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="e.g. +14155552671" {...field} className="text-base h-12 rounded-md" autoComplete="tel" inputMode="tel" disabled={isProcessingAuth} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Optional address input field. */}
         <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Address (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 123 Main St, Anytown" {...field} className="text-base h-12 rounded-md" autoComplete="street-address" disabled={isProcessingAuth} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        {/* Password input field. */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter password" {...field} className="text-base h-12 rounded-md" autoComplete="new-password" disabled={isProcessingAuth} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Confirm password input field. */}
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Confirm password" {...field} className="text-base h-12 rounded-md" autoComplete="new-password" disabled={isProcessingAuth} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Submit button. */}
        <Button type="submit" className="w-full h-14 rounded-full text-lg mt-6" disabled={isProcessingAuth}>
          {isProcessingAuth && <LoadingSpinner className="mr-2 h-5 w-5" />} {/* Show spinner if processing. */}
          {isProcessingAuth ? 'Registering...' : 'Register'}
        </Button>
      </form>
    </Form>
  );
}
