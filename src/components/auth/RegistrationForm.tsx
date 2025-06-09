
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

const RECAPTCHA_CONTAINER_ID = 'recaptcha-container-register';

const userDetailsSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format (e.g., +12223334444)"),
});
type UserDetailsFormValues = z.infer<typeof userDetailsSchema>;

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});
type OtpFormValues = z.infer<typeof otpSchema>;

interface RegistrationFormProps {
  role: UserRole;
}

export default function RegistrationForm({ role }: RegistrationFormProps) {
  const router = useRouter();
  const { sendOtp, confirmOtp, otpSent, isSendingOtp, isVerifyingOtp, resetOtpState, user } = useAuth();
  const { toast } = useToast();

  const [pendingRegistrationDetails, setPendingRegistrationDetails] = useState<UserDetailsFormValues | null>(null);

  const userDetailsForm = useForm<UserDetailsFormValues>({
    resolver: zodResolver(userDetailsSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
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
    // If user becomes authenticated (meaning registration & OTP confirm successful), redirect
    if (user && role && pendingRegistrationDetails) { // Check pendingRegistrationDetails to ensure it's from this flow
      resetOtpState();
      router.push(`/${role}/login`); 
      // Toast for success is now handled in AuthContext after createUserDocument
    }
  }, [user, role, router, resetOtpState, pendingRegistrationDetails]);

  useEffect(() => {
    return () => {
      resetOtpState();
    };
  }, [resetOtpState, role]);

  async function onUserDetailsSubmit(values: UserDetailsFormValues) {
    setPendingRegistrationDetails(values);
    await sendOtp(values.phoneNumber, RECAPTCHA_CONTAINER_ID, true, { 
      firstName: values.firstName, 
      lastName: values.lastName, 
      role: role 
    });
  }

  async function onOtpSubmit(values: OtpFormValues) {
    await confirmOtp(values.otp);
  }

  const handleTryAgain = () => {
    resetOtpState();
    setPendingRegistrationDetails(null);
    userDetailsForm.reset(); // Optionally reset user details form
    otpForm.reset();
  }

  if (otpSent) {
    return (
      <Form {...otpForm}>
        <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit OTP sent to {pendingRegistrationDetails?.phoneNumber}.
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
            Verify OTP & Register
          </Button>
          <Button variant="link" onClick={handleTryAgain} disabled={isVerifyingOtp}>
            Change details or resend OTP
          </Button>
        </form>
      </Form>
    );
  }

  return (
    <Form {...userDetailsForm}>
      <form onSubmit={userDetailsForm.handleSubmit(onUserDetailsSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={userDetailsForm.control}
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
            control={userDetailsForm.control}
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
          control={userDetailsForm.control}
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
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* This div is used by Firebase RecaptchaVerifier */}
        <div id={RECAPTCHA_CONTAINER_ID}></div>
        <Button type="submit" className="w-full button-tap-target text-lg py-3 h-14" disabled={isSendingOtp}>
          {isSendingOtp ? <LoadingSpinner className="mr-2 h-5 w-5" /> : null}
          Send OTP
        </Button>
      </form>
    </Form>
  );
}
