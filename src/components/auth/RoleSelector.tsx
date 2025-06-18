/**
 * @fileoverview RoleSelector component.
 * This component is displayed when a new user visits the application or a logged-out user
 * returns without a persisted role preference. It allows users to choose whether they
 * are a "Customer" or a "Barber", guiding them to the appropriate registration or login flow.
 */
'use client';

import { useRouter } from 'next/navigation'; // Hook for programmatic navigation.
import { User, Scissors } from 'lucide-react'; // Icons for buttons.
import { Button } from '@/components/ui/button'; // Button UI component.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Card UI components.
import { useAuth } from '@/hooks/useAuth'; // Auth context hook to set the role.
import { BarberFlowLogo } from '@/components/icons/BarberFlowLogo'; // Application logo component.
import { APP_NAME } from '@/lib/constants'; // Application name constant.

/**
 * RoleSelector component.
 * Allows users to select their role (Customer or Barber) to proceed with
 * registration or login.
 *
 * @returns {JSX.Element} The rendered role selector UI.
 */
export default function RoleSelector() {
  const router = useRouter(); // Next.js router instance.
  const { setRole } = useAuth(); // Function to set the user's role in AuthContext.

  /**
   * Handles the selection of the "Customer" role.
   * Sets the role in AuthContext and navigates to the customer registration page.
   */
  const handleCustomerSelection = () => {
    setRole('customer'); // Set role to 'customer'.
    router.push(`/customer/register`); // Navigate to customer registration.
  };

  /**
   * Handles the selection of the "Barber" role.
   * Navigates to the barber verification page. The role will be set in AuthContext
   * after successful verification.
   */
  const handleBarberSelection = () => {
    // For barbers, navigation is to a verification step first.
    // The role 'barber' will be set by the verification page upon success.
    router.push(`/barber/verify`);
  };

  return (
    // Full-screen flex container to center the card.
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/10 to-background p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-xl border-none rounded-xl bg-card/90 backdrop-blur-sm">
        <CardHeader className="text-center p-6 md:p-8">
          {/* Application Logo */}
          <div className="mx-auto mb-6 flex justify-center">
            <BarberFlowLogo className="h-12 w-auto" />
          </div>
          {/* Title and Description */}
          <CardTitle className="font-headline text-2xl font-bold">Welcome to {APP_NAME}!</CardTitle>
          <CardDescription className="text-base text-gray-500 dark:text-gray-400 pt-2">
            Please tell us who you are to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6 sm:p-8">
          {/* Button for "Customer" role selection. */}
          <Button
            onClick={handleCustomerSelection}
            className="w-full h-14 rounded-full text-lg transform transition-all duration-200 ease-in-out hover:scale-105 hover:shadow-lg hover:bg-gradient-to-r hover:from-accent hover:to-secondary"
            variant="outline" // Uses outline style for distinction.
            aria-label="I am a Customer"
          >
            <User className="mr-3 h-6 w-6" /> I'm a Customer
          </Button>
          {/* Button for "Barber" role selection. */}
          <Button
            onClick={handleBarberSelection}
            className="w-full h-14 rounded-full text-lg transform transition-all duration-200 ease-in-out hover:scale-105 hover:shadow-lg hover:bg-gradient-to-r hover:from-primary hover:to-accent"
            aria-label="I am a Barber"
          >
            <Scissors className="mr-3 h-6 w-6" /> I'm a Barber
          </Button>
        </CardContent>
      </Card>
      {/* Informational text below the card. */}
       <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 px-4">
        Your role selection helps us tailor your experience.
      </p>
    </div>
  );
}
