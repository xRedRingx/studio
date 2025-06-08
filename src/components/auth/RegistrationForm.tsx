
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { useState } from 'react';

// Schema for phone + OTP registration (no email, no password here)
const registrationSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().min(10, "Valid phone number is required (e.g., +12223334444 or 10 digits minimum)"),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

interface RegistrationFormProps {
  role: UserRole;
}

export default function RegistrationForm({ role }: RegistrationFormProps) {
  const router = useRouter();
  const { signUp } = useAuth(); // signUp will handle phone + OTP (simulated)
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
    },
  });

  async function onSubmit(values: RegistrationFormValues) {
    setIsLoading(true);
    try {
      // Pass role and no email
      await signUp({ ...values, role }); 
      toast({
        title: "Registration Initiated!",
        description: "Account created (OTP flow simulated). You can now log in.",
      });
      router.push(`/${role}/login`); 
    } catch (error: any) {
      console.error("Registration failed:", error);
      toast({
        title: "Registration Failed",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your first name" {...field} className="text-base py-3 px-4 h-12"/>
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
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your last name" {...field} className="text-base py-3 px-4 h-12"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="Enter your phone number" {...field} className="text-base py-3 px-4 h-12"/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Email field removed */}
        <Button type="submit" className="w-full button-tap-target text-lg py-3 h-14" disabled={isLoading}>
          {isLoading ? <LoadingSpinner className="mr-2 h-5 w-5" /> : null}
          Register
        </Button>
        {/* TODO: Add a div here for reCAPTCHA if implementing full Firebase phone auth, e.g., <div id="recaptcha-container-id-register"></div> */}
      </form>
    </Form>
  );
}
