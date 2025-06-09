'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CustomOtpInput } from '@/components/ui/CustomOtpInput';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types';
import LoadingSpinner from '@/components/ui/loading-spinner';

const RECAPTCHA_CONTAINER_ID = 'recaptcha-container-register';

const userDetailsSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
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
    defaultValues: { firstName: '', lastName: '', phoneNumber: '' },
  });

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  const otpValue = otpForm.watch('otp');

  useEffect(() => {
    if (user && role && pendingRegistrationDetails) { // User object created after OTP confirm
      resetOtpState();
      toast({
        title: "Registration Complete!",
        description: "You can now log in with your new account.",
        variant: "default"
      });
      router.push(`/${role}/login`);
    }
  }, [user, role, router, resetOtpState, pendingRegistrationDetails, toast]);

  useEffect(() => {
    return () => {
      resetOtpState();
      // Clear any existing reCAPTCHA verifiers when the component unmounts
      const recaptchaContainer = document.getElementById(RECAPTCHA_CONTAINER_ID);
      if (recaptchaContainer) recaptchaContainer.innerHTML = '';
    };
  }, [resetOtpState]);
  
  useEffect(() => {
    if (otpSent) {
      otpForm.reset({ otp: '' });
      otpForm.setValue('otp', '', { shouldValidate: false, shouldDirty: false, shouldTouch: false });
    }
  }, [otpSent, otpForm]);

  async function onUserDetailsSubmit(values: UserDetailsFormValues) {
    try {
      setPendingRegistrationDetails(values);
      await sendOtp(values.phoneNumber, RECAPTCHA_CONTAINER_ID, true, {
        firstName: values.firstName,
        lastName: values.lastName,
        role: role
      });
    } catch (error) {
      console.error('Error sending OTP:', error);
      // Toast is handled by AuthContext
      setPendingRegistrationDetails(null);
    }
  }

  async function onOtpSubmit(values: OtpFormValues) {
    try {
      await confirmOtp(values.otp);
      // Redirection or success toast is handled by the useEffect watching `user`
    } catch (error) {
      console.error('Error verifying OTP:', error);
      // Toast is handled by AuthContext
      otpForm.reset({ otp: '' });
    }
  }

  const handleTryAgain = () => {
    resetOtpState();
    setPendingRegistrationDetails(null);
    userDetailsForm.reset({firstName: '', lastName: '', phoneNumber: ''});
    otpForm.reset({otp: ''});
    const recaptchaContainer = document.getElementById(RECAPTCHA_CONTAINER_ID);
    if (recaptchaContainer) recaptchaContainer.innerHTML = '';
  };

  return (
    <div key={otpSent ? 'otp-form' : 'details-form'}>
      {otpSent ? (
        <Form {...otpForm}>
          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6 mt-6">
            <p className="text-sm text-gray-500">
              Enter the 6-digit OTP sent to {pendingRegistrationDetails?.phoneNumber}.
            </p>
            <FormField
              control={otpForm.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">One-Time Password</FormLabel>
                  <FormControl>
                    <CustomOtpInput {...field} disabled={isVerifyingOtp} autoComplete="one-time-code"/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full h-14 rounded-full text-lg"
              disabled={isVerifyingOtp || !otpValue || otpValue.length !== 6}
            >
              {isVerifyingOtp && <LoadingSpinner className="mr-2 h-5 w-5" />}
              Verify OTP & Register
            </Button>
            <Button
              variant="link"
              onClick={handleTryAgain}
              disabled={isVerifyingOtp}
              type="button"
              className="w-full text-primary"
            >
              Change details or resend OTP
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...userDetailsForm}>
          <form onSubmit={userDetailsForm.handleSubmit(onUserDetailsSubmit)} className="space-y-6 mt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <FormField
                control={userDetailsForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter first name" {...field} className="text-base h-12" autoComplete="given-name" />
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
                    <FormLabel className="text-base">Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter last name" {...field} className="text-base h-12" autoComplete="family-name" />
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
                  <FormLabel className="text-base">Phone Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="e.g. +14155552671" {...field} className="text-base h-12" autoComplete="tel" inputMode="tel" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div id={RECAPTCHA_CONTAINER_ID} className="my-4 flex justify-center"></div>
            <Button type="submit" className="w-full h-14 rounded-full text-lg" disabled={isSendingOtp}>
              {isSendingOtp && <LoadingSpinner className="mr-2 h-5 w-5" />}
              Send OTP
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
