
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole, AppUser } from '@/types';
import LoadingSpinner from '@/components/ui/loading-spinner';

const userDetailsSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format (e.g., +12223334444)").optional().or(z.literal('')),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password must be at least 6 characters"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type UserDetailsFormValues = z.infer<typeof userDetailsSchema>;

interface RegistrationFormProps {
  role: UserRole;
}

export default function RegistrationForm({ role }: RegistrationFormProps) {
  const router = useRouter();
  const { user, registerWithEmailAndPassword, isProcessingAuth } = useAuth();

  const form = useForm<UserDetailsFormValues>({
    resolver: zodResolver(userDetailsSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (user && role) {
      router.push(`/${role}/dashboard`);
    }
  }, [user, role, router]);

  async function onSubmit(values: UserDetailsFormValues) {
    try {
      const userDetailsForApi: Omit<AppUser, 'uid' | 'createdAt' | 'updatedAt' | 'displayName' | 'photoURL' | 'emailVerified'> & { password_original_do_not_use: string } = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phoneNumber: values.phoneNumber || null,
        password_original_do_not_use: values.password, 
        role: role,
      };
      await registerWithEmailAndPassword(userDetailsForApi);
    } catch (error) {
      console.error('Registration form error:', error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-x-6 sm:gap-y-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">First Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter first name" {...field} className="text-base h-12" autoComplete="given-name" disabled={isProcessingAuth} />
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
                  <Input placeholder="Enter last name" {...field} className="text-base h-12" autoComplete="family-name" disabled={isProcessingAuth} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Email Address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="e.g. user@example.com" {...field} className="text-base h-12" autoComplete="email" inputMode="email" disabled={isProcessingAuth} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Phone Number (Optional)</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="e.g. +14155552671" {...field} className="text-base h-12" autoComplete="tel" inputMode="tel" disabled={isProcessingAuth} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter password" {...field} className="text-base h-12" autoComplete="new-password" disabled={isProcessingAuth} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Confirm password" {...field} className="text-base h-12" autoComplete="new-password" disabled={isProcessingAuth} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full h-14 rounded-full text-lg mt-6" disabled={isProcessingAuth}>
          {isProcessingAuth && <LoadingSpinner className="mr-2 h-5 w-5" />}
          {isProcessingAuth ? 'Registering...' : 'Register'}
        </Button>
      </form>
    </Form>
  );
}
