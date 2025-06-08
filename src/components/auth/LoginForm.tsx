
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
// Link component is no longer needed here as "Forgot Password" is removed
// import Link from 'next/link'; 
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { useState } from 'react';

// Updated schema for phone login
const loginSchema = z.object({
  phoneNumber: z.string().min(10, "Valid phone number is required"),
  // Password field removed
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  role: UserRole;
}

export default function LoginForm({ role }: LoginFormProps) {
  const router = useRouter();
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phoneNumber: '',
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    try {
      await signIn(values.phoneNumber);
      toast({
        title: "Login Initiated!",
        description: "If your number is recognized, you'll proceed. (Simulated for prototype)",
      });
      // In a real app, you might navigate to an OTP screen or wait for onAuthStateChanged
      router.push(`/${role}/dashboard`);
    } catch (error: any) {
      console.error("Login failed:", error);
      toast({
        title: "Login Failed",
        description: error.message || "Invalid phone number or an error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                 {/* Consider using a more specific input type or library for phone numbers in production */}
                <Input type="tel" placeholder="Enter your phone number" {...field} className="text-base py-3 px-4 h-12"/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Password field removed */}
        {/* Forgot Password link removed */}
        {/* <div className="flex items-center justify-end">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Forgot Password?
          </Link>
        </div> */}
        <Button type="submit" className="w-full button-tap-target text-lg py-3 h-14 mt-4" disabled={isLoading}>
          {isLoading ? <LoadingSpinner className="mr-2 h-5 w-5" /> : null}
          Login
        </Button>
         {/* Placeholder for reCAPTCHA, would be necessary for real Firebase phone auth */}
        {/* <div id="recaptcha-container-login"></div> */}
      </form>
    </Form>
  );
}
