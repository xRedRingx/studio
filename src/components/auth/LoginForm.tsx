
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
    defaultValues: { phoneNumber: '' },
  });

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  const otpValue = otpForm.watch('otp');

  useEffect(() => {
    if (user && role) {
      resetOtpState();
      router.push(`/${role}/dashboard`);
    }
  }, [user, role, router, resetOtpState]);

  useEffect(() => {
    // This cleanup runs when the component unmounts.
    return () => {
      resetOtpState(); // resetOtpState now handles clearing the verifier and its DOM container.
    };
  }, [resetOtpState]);

  useEffect(() => {
    if (otpSent) {
      otpForm.reset({ otp: '' });
      // Ensure visual and form state is pristine for OTP input
      otpForm.setValue('otp', '', { shouldValidate: false, shouldDirty: false, shouldTouch: false });
    }
  }, [otpSent, otpForm]);

  async function onPhoneSubmit(values: PhoneFormValues) {
    try {
      setCurrentPhoneNumber(values.phoneNumber);
      await sendOtp(values.phoneNumber, RECAPTCHA_CONTAINER_ID, false);
    } catch (error) {
      console.error('Error sending OTP:', error);
      // Toast is handled by AuthContext
    }
  }

  async function onOtpSubmit(values: OtpFormValues) {
    try {
      await confirmOtp(values.otp);
    } catch (error) {
      console.error('Error verifying OTP:', error);
      // Toast is handled by AuthContext
      otpForm.reset({ otp: '' });
    }
  }

  const handleTryAgain = () => {
    resetOtpState(); // This will clear verifier and its DOM container
    setCurrentPhoneNumber('');
    phoneForm.reset({phoneNumber: ''});
    otpForm.reset({otp: ''});
  };

  return (
    <div key={otpSent ? 'otp-form' : 'login-form'}>
      {/* Persistent reCAPTCHA container, its content managed by reCAPTCHA library & resetOtpState */}
      {/* It's only relevant for the phone submission step, so conditionally render or hide if needed,
          but ensure it exists in DOM if reCAPTCHA might still interact with it.
          For `size: 'invisible'`, it doesn't take up visual space unless a challenge is shown.
          The `resetOtpState` will clear its innerHTML when trying again or unmounting.
      */}
      <div id={RECAPTCHA_CONTAINER_ID} className={`my-4 flex justify-center ${otpSent ? 'hidden' : ''}`}></div>

      {otpSent ? (
        <Form {...otpForm}>
          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6 mt-6">
            <p className="text-sm text-gray-500">
              Enter the 6-digit OTP sent to {currentPhoneNumber}.
            </p>
            <FormField
              control={otpForm.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">One-Time Password</FormLabel>
                  <FormControl>
                    <CustomOtpInput {...field} disabled={isVerifyingOtp} autoComplete="one-time-code" />
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
              Verify OTP
            </Button>
            <Button
              variant="link"
              onClick={handleTryAgain}
              disabled={isVerifyingOtp}
              type="button"
              className="w-full text-primary"
            >
              Change phone number or resend OTP
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...phoneForm}>
          <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-6 mt-6">
            <FormField
              control={phoneForm.control}
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
            {/* reCAPTCHA container is now outside this conditional block, rendered above */}
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
