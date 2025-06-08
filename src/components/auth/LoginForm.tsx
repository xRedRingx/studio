
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
import Link from 'next/link'; // Re-add if "Forgot Password?" is to be used with custom logic

// Updated schema for phone + password login
const loginSchema = z.object({
  phoneNumber: z.string().min(10, "Valid phone number is required"),
  password: z.string().min(1, "Password is required"), // Password field re-added
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
      password: '', // Default password
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    try {
      // signIn will use phoneNumber as 'email' and password for Firebase auth
      await signIn(values); 
      toast({
        title: "Login Successful!",
        description: "Welcome back!",
      });
      router.push(`/${role}/dashboard`);
    } catch (error: any) {
      console.error("Login failed:", error);
      toast({
        title: "Login Failed",
        description: error.message || "Invalid phone number/password or an error occurred.",
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter your password" {...field} className="text-base py-3 px-4 h-12"/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* 
          "Forgot Password?" link is complex with phone-as-email. 
          Firebase's sendPasswordResetEmail expects a real email.
          A custom solution would be needed for phone-based password reset (e.g., via SMS OTP to reset).
          For now, it remains commented out.
        */}
        {/* 
        <div className="flex items-center justify-end">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Forgot Password?
          </Link>
        </div> 
        */}
        <Button type="submit" className="w-full button-tap-target text-lg py-3 h-14 mt-4" disabled={isLoading}>
          {isLoading ? <LoadingSpinner className="mr-2 h-5 w-5" /> : null}
          Login
        </Button>
      </form>
    </Form>
  );
}
