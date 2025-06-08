
'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
  phoneNumber: z.string().min(10, "Valid phone number is required (e.g., +12223334444 or 10 digits)"),
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
    // If user becomes authenticated, redirect to dashboard
    if (user && role) {
      resetOtpState(); // Clean up OTP state
      router.push(`/${role}/dashboard`);
    }
  }, [user, role, router, resetOtpState]);

  // Cleanup OTP state if component unmounts or role changes
  useEffect(() => {
    return () => {
      resetOtpState();
    };
  }, [resetOtpState, role]);


  async function onPhoneSubmit(values: PhoneFormValues) {
    setCurrentPhoneNumber(values.phoneNumber);
    // The recaptchaContainerId is passed to sendOtp
    await sendOtp(values.phoneNumber, RECAPTCHA_CONTAINER_ID, false);
  }

  async function onOtpSubmit(values: OtpFormValues) {
    await confirmOtp(values.otp);
    // Successful OTP confirmation will trigger user state change -> useEffect for navigation
  }

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
                  <InputOTP maxLength={6} {...field}>
                    <InputOTPGroup className="w-full justify-between">
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
          <Button type="submit" className="w-full button-tap-target text-lg py-3 h-14" disabled={isVerifyingOtp}>
            {isVerifyingOtp ? <LoadingSpinner className="mr-2 h-5 w-5" /> : null}
            Verify OTP
          </Button>
          <Button variant="link" onClick={() => resetOtpState()} disabled={isVerifyingOtp}>
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
                  placeholder="Enter your phone number (e.g. +14155552671)" 
                  {...field} 
                  className="text-base py-3 px-4 h-12"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div id={RECAPTCHA_CONTAINER_ID}></div>
        <Button type="submit" className="w-full button-tap-target text-lg py-3 h-14 mt-4" disabled={isSendingOtp}>
          {isSendingOtp ? <LoadingSpinner className="mr-2 h-5 w-5" /> : null}
          Send OTP
        </Button>
      </form>
    </Form>
  );
}
