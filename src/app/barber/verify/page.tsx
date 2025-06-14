
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import AuthFormWrapper from '@/components/auth/AuthFormWrapper';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';

const BARBER_VERIFICATION_PASSWORD = "LIAMANIELMAHDIco";
const MAX_ATTEMPTS = 2;

const verificationSchema = z.object({
  password: z.string().min(1, "Verification code is required"),
});
type VerificationFormValues = z.infer<typeof verificationSchema>;

export default function BarberVerifyPage() {
  const router = useRouter();
  const { setRole, isProcessingAuth, setIsProcessingAuth } = useAuth();
  const { toast } = useToast();
  const [attempts, setAttempts] = useState(0);

  const form = useForm<VerificationFormValues>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { password: '' },
  });

  useEffect(() => {
    // If user somehow lands here with too many attempts already (e.g. browser back), redirect.
    if (attempts >= MAX_ATTEMPTS) {
      toast({
        title: "Too many attempts",
        description: "Redirecting to customer registration.",
        variant: "destructive",
      });
      router.replace('/customer/register');
    }
  }, [attempts, router, toast]);

  async function onSubmit(values: VerificationFormValues) {
    setIsProcessingAuth(true);
    if (values.password === BARBER_VERIFICATION_PASSWORD) {
      setRole('barber');
      toast({
        title: "Verification Successful",
        description: "Proceeding to barber registration.",
      });
      router.replace('/barber/register');
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      form.resetField("password");
      if (newAttempts >= MAX_ATTEMPTS) {
        toast({
          title: "Verification Failed",
          description: `Incorrect code. Redirecting to customer registration.`,
          variant: "destructive",
        });
        router.replace('/customer/register');
      } else {
        toast({
          title: "Incorrect Code",
          description: `Please try again. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`,
          variant: "destructive",
        });
      }
    }
    setIsProcessingAuth(false);
  }

  return (
    <AuthFormWrapper
      title="Barber Verification"
      description="Please enter the verification code to proceed as a barber."
      footerLink={{
        label: "Not a barber?",
        text: "Register as Customer",
        href: "/customer/register" 
      }}
    >
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
                    type="password" 
                    placeholder="Enter code" 
                    {...field} 
                    className="text-base h-12" 
                    autoComplete="one-time-code"
                    disabled={isProcessingAuth || attempts >= MAX_ATTEMPTS}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button 
            type="submit" 
            className="w-full h-14 rounded-full text-lg" 
            disabled={isProcessingAuth || attempts >= MAX_ATTEMPTS}
          >
            {isProcessingAuth && <LoadingSpinner className="mr-2 h-5 w-5" />}
            {isProcessingAuth ? 'Verifying...' : 'Verify & Proceed'}
          </Button>
        </form>
      </Form>
    </AuthFormWrapper>
  );
}
