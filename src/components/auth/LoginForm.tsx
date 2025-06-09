'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types';
import LoadingSpinner from '@/components/ui/loading-spinner';

const RECAPTCHA_CONTAINER_ID = 'recaptcha-container-login';

const phoneSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format (e.g., +12223334444)"),
});
type PhoneFormValues = z.infer<typeof phoneSchema>;

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});
type OtpFormValues = z.infer<typeof otpSchema>;

interface LoginFormProps {
  role: UserRole;
}

export default function LoginForm({ role }: LoginFormProps) {
  const router = useRouter();
  const { user, sendOtp, confirmOtp, otpSent, isSendingOtp, isVerifyingOtp, resetOtpState } = useAuth();
  const { toast } = useToast();

  const [currentPhoneNumber, setCurrentPhoneNumber] = useState('');

  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phoneNumber: '',
    },
  });

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: '',
    },
  });
  
  useEffect(() => {
    if (user && role) {
      resetOtpState(); 
      router.push(`/${role}/dashboard`);
    }
  }, [user, role, router, resetOtpState]);

  useEffect(() => {
    // Component unmount or role change cleanup
    return () => {
      resetOtpState();
    };
  }, [resetOtpState, role]);

  // Fixed: Properly reset OTP form when OTP is sent
  useEffect(() => {
    if (otpSent) {
      // Clear the OTP form completely
      otpForm.reset({ otp: '' });
      // Force clear the field value
      otpForm.setValue('otp', '');
      // Clear any field errors
      otpForm.clearErrors('otp');
    }
  }, [otpSent, otpForm]);

  async function onPhoneSubmit(values: PhoneFormValues) {
    try {
      setCurrentPhoneNumber(values.phoneNumber);
      await sendOtp(values.phoneNumber, RECAPTCHA_CONTAINER_ID, false);
    } catch (error) {
      console.error('Error sending OTP:', error);
      toast({ 
        title: "Error", 
        description: "Failed to send OTP. Please try again.",
        variant: "destructive"
      });
    }
  }

  async function onOtpSubmit(values: OtpFormValues) {
    try {
      await confirmOtp(values.otp);
    } catch (error) {
      console.error('Error verifying OTP:', error);
      toast({ 
        title: "Error", 
        description: "Invalid OTP. Please try again.",
        variant: "destructive"
      });
      // Reset OTP field on error
      otpForm.reset({ otp: '' });
      otpForm.setValue('otp', '');
    }
  }

  const handleTryAgain = () => {
    resetOtpState();
    phoneForm.reset({ phoneNumber: '' }); 
    otpForm.reset({ otp: '' });
    otpForm.setValue('otp', '');
    otpForm.clearErrors();
    setCurrentPhoneNumber('');
  }

  // Handle OTP input changes to ensure only digits
  const handleOtpChange = (value: string) => {
    // Only allow digits and limit to 6 characters
    const cleanValue = value.replace(/\D/g, '').slice(0, 6);
    otpForm.setValue('otp', cleanValue);
  };

  if (otpSent) {
    return (
      <Form {...otpForm}>
        <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit OTP sent to {currentPhoneNumber}.
          </p>
          <FormField
            control={otpForm.control}
            name="otp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>One-Time Password</FormLabel>
                <FormControl>
                  <InputOTP 
                    maxLength={6} 
                    value={field.value || ''}
                    onChange={(value) => {
                      handleOtpChange(value);
                      field.onChange(value);
                    }}
                    autoComplete="one-time-code"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button 
            type="submit" 
            className="w-full button-tap-target text-lg py-3 h-14" 
            disabled={isVerifyingOtp || !otpForm.watch('otp') || otpForm.watch('otp').length !== 6}
          >
            {isVerifyingOtp ? <LoadingSpinner className="mr-2 h-5 w-5" /> : null}
            Verify OTP
          </Button>
          <Button 
            variant="link" 
            onClick={handleTryAgain} 
            disabled={isVerifyingOtp} 
            type="button"
            className="w-full"
          >
            Change phone number or resend OTP
          </Button>
        </form>
      </Form>
    );
  }

  return (
    <Form {...phoneForm}>
      <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-6">
        <FormField
          control={phoneForm.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input 
                  type="tel" 
                  placeholder="e.g. +14155552671" 
                  {...field} 
                  className="text-base py-3 px-4 h-12"
                  autoComplete="tel"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div id={RECAPTCHA_CONTAINER_ID}></div> 
        <Button 
          type="submit" 
          className="w-full button-tap-target text-lg py-3 h-14 mt-4" 
          disabled={isSendingOtp}
        >
          {isSendingOtp ? <LoadingSpinner className="mr-2 h-5 w-5" /> : null}
          Send OTP
        </Button>
      </form>
    </Form>
  );
}