/**
 * @fileoverview View Barber Profile Page.
 * This page allows customers to view the profile of a specific barber.
 * It displays the barber's details (name, address, bio, specialties),
 * lists their offered services, and provides a button to initiate the booking process.
 * It also indicates if the barber is currently accepting online bookings or is temporarily unavailable.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Hooks for route parameters and navigation.
import ProtectedPage from '@/components/layout/ProtectedPage'; // Ensures authenticated customer access.
import type { AppUser, BarberService } from '@/types'; // Type definitions.
import { Button } from '@/components/ui/button'; // Button UI component.
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'; // Card UI component.
import { firestore } from '@/firebase/config'; // Firebase Firestore instance.
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore'; // Firestore methods.
import { useToast } from '@/hooks/use-toast'; // Toast notification hook.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.
import { ArrowLeft, CalendarPlus, Scissors, DollarSign, Clock, UserCircle, AlertTriangle, MapPin, Info, Sparkles, MessageSquareText, Hourglass } from 'lucide-react'; // Icons.
import Link from 'next/link'; // Next.js Link component.
import { Badge } from '@/components/ui/badge'; // Badge UI component.
import { cn } from '@/lib/utils'; // Utility for conditional class names.
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Alert UI component.

/**
 * ViewBarberPage component.
 * Renders the profile page for a specific barber.
 *
 * @returns {JSX.Element} The rendered barber profile page.
 */
export default function ViewBarberPage() {
  const router = useRouter(); // Next.js router for navigation.
  const params = useParams(); // Hook for accessing route parameters (e.g., barberId).
  const barberId = params.barberId as string; // The ID of the barber whose profile is being viewed.
  const { toast } = useToast(); // For displaying notifications.

  // State for barber's details and services.
  const [barber, setBarber] = useState<AppUser | null>(null);
  const [services, setServices] = useState<BarberService[]>([]);
  // State to indicate if data is currently being loaded.
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetches the barber's profile information and their list of services from Firestore.
   */
  const fetchBarberAndServices = useCallback(async () => {
    if (!barberId) { // If no barberId, redirect to customer dashboard.
      router.push('/customer/dashboard');
      return;
    }
    setIsLoading(true);
    try {
      // Fetch barber's user document.
      const barberDocRef = doc(firestore, 'users', barberId);
      const barberDocSnap = await getDoc(barberDocRef);

      if (barberDocSnap.exists() && barberDocSnap.data().role === 'barber') {
        const barberData = barberDocSnap.data() as AppUser;
        // Determine booking acceptance and temporary unavailability status, defaulting if undefined.
        const isAccepting = barberData.isAcceptingBookings !== undefined ? barberData.isAcceptingBookings : true;
        const isTempUnavailable = barberData.isTemporarilyUnavailable || false;

        setBarber({
            uid: barberDocSnap.id, ...barberData,
            isAcceptingBookings: isAccepting,
            isTemporarilyUnavailable: isTempUnavailable,
            email: barberData.email, // Ensure email is included.
        });
      } else { // Barber not found or not a barber.
        toast({ title: "Error", description: "Barber not found.", variant: "destructive" });
        router.push('/customer/dashboard'); return;
      }

      // Fetch barber's services.
      const servicesQuery = query(collection(firestore, 'services'), where('barberId', '==', barberId), orderBy('createdAt', 'desc'));
      const servicesSnapshot = await getDocs(servicesQuery);
      setServices(servicesSnapshot.docs.map(sDoc => ({ id: sDoc.id, ...sDoc.data() } as BarberService)));
    } catch (error) {
      console.error("Error fetching barber/services:", error);
      toast({ title: "Error", description: "Could not load barber's information.", variant: "destructive" });
      router.push('/customer/dashboard'); // Redirect on error.
    } finally {
      setIsLoading(false);
    }
  }, [barberId, toast, router]); // Dependencies for useCallback.

  // Effect to fetch data on component mount or when dependencies change.
  useEffect(() => { fetchBarberAndServices(); }, [fetchBarberAndServices]);

  // --- Loading State ---
  if (isLoading) {
    return (
      <ProtectedPage expectedRole="customer">
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
          <LoadingSpinner className="h-12 w-12 text-primary" />
          <p className="ml-3 text-base">Loading barber's details...</p>
        </div>
      </ProtectedPage>
    );
  }

  // --- Barber Not Found State ---
  if (!barber) {
    return (
      <ProtectedPage expectedRole="customer">
        <div className="text-center py-10">
          <UserCircle className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold text-destructive">Barber information not available.</h2>
          <Button onClick={() => router.push('/customer/dashboard')} className="mt-6 h-12 rounded-full px-6 text-base">Back to Dashboard</Button>
        </div>
      </ProtectedPage>
    );
  }

  // Determine barber's current booking availability for UI elements.
  const barberIsAcceptingBookings = barber.isAcceptingBookings !== undefined ? barber.isAcceptingBookings : true;
  const barberIsTemporarilyUnavailable = barber.isTemporarilyUnavailable || false;
  const canBook = barberIsAcceptingBookings && !barberIsTemporarilyUnavailable;

  return (
    // ProtectedPage ensures only authenticated customers can access this page.
    <ProtectedPage expectedRole="customer">
      <div className="space-y-6">
        {/* Back button to navigate to the barbers list on the customer dashboard. */}
        <Button variant="outline" onClick={() => router.push('/customer/dashboard#find-barber')} className="rounded-full h-11 px-5 text-base">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Barbers List
        </Button>

        {/* Main card displaying barber's profile information. */}
        <Card className="border-none shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <UserCircle className="h-20 w-20 sm:h-24 sm:w-24 text-muted-foreground flex-shrink-0" /> {/* Placeholder icon for barber image. */}
                <div className="pt-1">
                    <CardTitle className="text-2xl sm:text-3xl font-bold">{barber.firstName} {barber.lastName}</CardTitle>
                     <span className="text-sm text-muted-foreground">(Ratings feature disabled)</span> {/* Placeholder for future ratings feature. */}
                    <CardDescription className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">View services and book an appointment.</CardDescription>
                    {/* Display barber's address if available. */}
                    {barber.address && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1.5">
                        <MapPin className="mr-1.5 h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" /> {barber.address}
                      </p>
                    )}
                </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 md:p-6">
            {/* Alert if barber is not accepting online bookings. */}
            {!barberIsAcceptingBookings && (
                <Alert variant="destructive" className="mb-6 rounded-md">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertTitle>Not Accepting Online Bookings</AlertTitle>
                  <AlertDescription>{barber.firstName} is not currently accepting new online bookings. Please check back later.</AlertDescription>
                </Alert>
            )}
            {/* Alert if barber is temporarily unavailable. */}
             {barberIsTemporarilyUnavailable && (
                <Alert variant="default" className="mb-6 rounded-md border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 [&>svg]:text-yellow-500">
                  <Hourglass className="h-5 w-5" />
                  <AlertTitle>Temporarily Unavailable</AlertTitle>
                  <AlertDescription>{barber.firstName} is temporarily busy. Please check back soon. Booking is unavailable at this moment.</AlertDescription>
                </Alert>
            )}

            {/* Display barber's bio if available. */}
            {barber.bio && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2 text-foreground flex items-center"><MessageSquareText className="mr-2 h-5 w-5 text-primary" /> About {barber.firstName}</h3>
                <p className="text-base text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{barber.bio}</p>
              </div>
            )}

            {/* Display barber's specialties if available. */}
            {barber.specialties && barber.specialties.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-foreground flex items-center"><Sparkles className="mr-2 h-5 w-5 text-primary" /> Specialties</h3>
                <div className="flex flex-wrap gap-2">
                  {barber.specialties.map((specialty, index) => (<Badge key={index} variant="secondary" className="text-sm py-1 px-3 rounded-full">{specialty}</Badge>))}
                </div>
              </div>
            )}

            {/* Section listing barber's services. */}
            <h3 className="text-xl font-semibold mb-4 text-foreground pt-4 border-t mt-6">Services Offered</h3>
            {services.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map(service => (
                  // Individual service card.
                  <Card key={service.id} className="shadow-md rounded-lg border flex flex-col hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-base font-semibold flex items-center"><Scissors className="mr-2 h-5 w-5 text-primary flex-shrink-0" /><span className="truncate" title={service.name}>{service.name}</span></CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-600 dark:text-gray-400 space-y-1 px-4 pb-3 flex-grow">
                      <p className="flex items-center"><DollarSign className="mr-1.5 h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />Price: <span className="font-medium text-foreground ml-1">${service.price.toFixed(2)}</span></p>
                      <p className="flex items-center"><Clock className="mr-1.5 h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />Duration: <span className="font-medium text-primary ml-1">{service.duration} minutes</span></p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : ( // Message if no services are listed.
              <div className="text-center py-6"><Info className="mx-auto h-10 w-10 text-muted-foreground mb-3" /><p className="text-base text-gray-500 dark:text-gray-400">This barber has not listed any services yet.</p></div>
            )}
          </CardContent>

          {/* Footer with "Book" button. */}
          <CardFooter className="p-4 md:p-6 border-t mt-auto">
            <Button
              asChild={canBook} // Renders as Link if canBook is true.
              className="w-full sm:w-auto h-14 rounded-full text-lg px-8"
              disabled={!canBook || services.length === 0} // Disabled if cannot book or no services.
              title={services.length === 0 && canBook ? "Barber has no services to book." : (!canBook ? "Barber is not available for booking right now." : undefined)}
            >
              {canBook ? ( // If can book, render Link to booking page.
                <Link href={`/customer/book/${barberId}`}>
                  <CalendarPlus className="mr-2 h-5 w-5" /> Book with {barber.firstName}
                </Link>
              ) : ( // If cannot book, display reason.
                <><CalendarPlus className="mr-2 h-5 w-5" /> {barberIsTemporarilyUnavailable ? 'Temporarily Busy' : 'Not Accepting Bookings'}</>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </ProtectedPage>
  );
}
