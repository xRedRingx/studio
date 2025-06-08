
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
// Link component for "Forgot Password?" is removed as it's not applicable for OTP flow.

// Schema for phone + OTP login (no password here)
const loginSchema = z.object({
  phoneNumber: z.string().min(10, "Valid phone number is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  role: UserRole;
}

export default function LoginForm({ role }: LoginFormProps) {
  const router = useRouter();
  const { signIn } = useAuth(); // signIn will handle phone + OTP (simulated)
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
      await signIn(values); 
      toast({
        title: "Login Initiated!",
        // In a real OTP flow, you'd say "OTP sent..." or "Logged in successfully after OTP"
        description: "Welcome back! (OTP flow simulated)", 
      });
      router.push(`/${role}/dashboard`);
    } catch (error: any) {
      console.error("Login failed:", error);
      toast({
        title: "Login Failed",
        description: error.message || "Invalid phone number or an error occurred.",
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
                <Input type="tel" placeholder="Enter your phone number" {...field} className="text-base py-3 px-4 h-12"/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Password field removed for OTP flow */}
        {/* "Forgot Password?" link removed as it's not relevant for OTP flow */}
        <Button type="submit" className="w-full button-tap-target text-lg py-3 h-14 mt-4" disabled={isLoading}>
          {isLoading ? <LoadingSpinner className="mr-2 h-5 w-5" /> : null}
          Login
        </Button>
         {/* TODO: Add a div here for reCAPTCHA if implementing full Firebase phone auth, e.g., <div id="recaptcha-container-id-login"></div> */}
      </form>
    </Form>
  );
}
