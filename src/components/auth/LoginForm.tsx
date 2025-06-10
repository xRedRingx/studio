
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
import type { UserRole } from '@/types';
import LoadingSpinner from '@/components/ui/loading-spinner';

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  role: UserRole;
}

export default function LoginForm({ role }: LoginFormProps) {
  const router = useRouter();
  const { user, signInWithEmailAndPassword, isProcessingAuth } = useAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (user && role) {
      router.push(`/${role}/dashboard`);
    }
  }, [user, role, router]);

  async function onSubmit(values: LoginFormValues) {
    try {
      await signInWithEmailAndPassword(values.email, values.password);
    } catch (error) {
      console.error('Login form error:', error);
      form.resetField("password");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter password" {...field} className="text-base h-12" autoComplete="current-password" disabled={isProcessingAuth} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full h-14 rounded-full text-lg" disabled={isProcessingAuth}>
          {isProcessingAuth && <LoadingSpinner className="mr-2 h-5 w-5" />}
          {isProcessingAuth ? 'Logging In...' : 'Login'}
        </Button>
      </form>
    </Form>
  );
}
