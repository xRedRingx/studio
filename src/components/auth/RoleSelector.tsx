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
  const { setRole } = useAuth();

  const handleRoleSelection = (selectedRole: UserRole) => {
    setRole(selectedRole);
    router.push(`/${selectedRole}/register`);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-6 flex justify-center">
            <BarberFlowLogo className="h-12 w-auto" />
          </div>
          <CardTitle className="font-headline text-3xl">Welcome to {APP_NAME}!</CardTitle>
          <CardDescription className="text-lg text-muted-foreground pt-2">
            Please tell us who you are to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-8">
          <Button
            onClick={() => handleRoleSelection('customer')}
            className="w-full button-tap-target transform py-8 text-xl transition-transform hover:scale-105"
            variant="outline"
            aria-label="I am a Customer"
          >
            <User className="mr-3 h-7 w-7" /> I'm a Customer
          </Button>
          <Button
            onClick={() => handleRoleSelection('barber')}
            className="w-full button-tap-target transform py-8 text-xl transition-transform hover:scale-105"
            aria-label="I am a Barber"
          >
            <Scissors className="mr-3 h-7 w-7" /> I'm a Barber
          </Button>
        </CardContent>
      </Card>
       <p className="mt-8 text-center text-sm text-muted-foreground">
        Your role selection helps us tailor your experience. <br/> This can only be set once.
      </p>
    </div>
  );
}
