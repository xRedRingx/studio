
'use client';

import { useRouter } from 'next/navigation';
import { User, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';
import { BarberFlowLogo } from '@/components/icons/BarberFlowLogo';
import { APP_NAME } from '@/lib/constants';

export default function RoleSelector() {
  const router = useRouter();
  const { setRole } = useAuth(); // Only need setRole for customer path now

  const handleCustomerSelection = () => {
    setRole('customer'); // Set role directly for customer
    router.push(`/customer/register`);
  };

  const handleBarberSelection = () => {
    // Navigate to the verification page for barbers
    // The role will be set on that page after successful verification
    router.push(`/barber/verify`); 
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="text-center p-6">
          <div className="mx-auto mb-6 flex justify-center">
            <BarberFlowLogo className="h-12 w-auto" />
          </div>
          <CardTitle className="font-headline text-2xl font-bold">Welcome to {APP_NAME}!</CardTitle>
          <CardDescription className="text-base text-gray-500 pt-2">
            Please tell us who you are to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6 sm:p-8">
          <Button
            onClick={handleCustomerSelection}
            className="w-full h-14 rounded-full text-lg transform transition-all duration-200 ease-in-out hover:scale-105"
            variant="outline"
            aria-label="I am a Customer"
          >
            <User className="mr-3 h-6 w-6" /> I'm a Customer
          </Button>
          <Button
            onClick={handleBarberSelection}
            className="w-full h-14 rounded-full text-lg transform transition-all duration-200 ease-in-out hover:scale-105"
            aria-label="I am a Barber"
          >
            <Scissors className="mr-3 h-6 w-6" /> I'm a Barber
          </Button>
        </CardContent>
      </Card>
       <p className="mt-8 text-center text-sm text-gray-500">
        Your role selection helps us tailor your experience.
      </p>
    </div>
  );
}
