
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordForm() {
  const { sendPasswordResetLink, isProcessingAuth } = useAuth();
  const { toast } = useToast();

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    try {
      await sendPasswordResetLink(values.email);
      toast({
        title: "Check Your Email",
        description: "If an account exists for this email, a password reset link has been sent.",
      });
      form.reset();
    } catch (error) {
      // Error is already handled by sendPasswordResetLink with a toast,
      // but we catch it here to prevent unhandled promise rejections.
      console.error('Forgot password form error:', error);
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
                <Input 
                  type="email" 
                  placeholder="e.g. user@example.com" 
                  {...field} 
                  className="text-base h-12 rounded-md" 
                  autoComplete="email" 
                  inputMode="email" 
                  disabled={isProcessingAuth}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full h-14 rounded-full text-lg" disabled={isProcessingAuth}>
          {isProcessingAuth && <LoadingSpinner className="mr-2 h-5 w-5" />}
          {isProcessingAuth ? 'Sending Link...' : 'Send Reset Link'}
        </Button>
      </form>
    </Form>
  );
}
