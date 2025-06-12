
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { AppUser, BarberService } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { firestore } from '@/firebase/config';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { ArrowLeft, CalendarPlus, Scissors, DollarSign, Clock, UserCircle } from 'lucide-react';
import Link from 'next/link';

export default function ViewBarberPage() {
  const { user } = useAuth(); // Though not directly used, ProtectedPage relies on it
  const router = useRouter();
  const params = useParams();
  const barberId = params.barberId as string;
  const { toast } = useToast();

  const [barber, setBarber] = useState<AppUser | null>(null);
  const [services, setServices] = useState<BarberService[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBarberAndServices = useCallback(async () => {
    if (!barberId) {
        router.push('/customer/dashboard'); // Should not happen if routing is correct
        return;
    }
    setIsLoading(true);
    try {
      // Fetch barber details
      const barberDocRef = doc(firestore, 'users', barberId);
      const barberDocSnap = await getDoc(barberDocRef);

      if (barberDocSnap.exists() && barberDocSnap.data().role === 'barber') {
        setBarber({ id: barberDocSnap.id, ...barberDocSnap.data() } as AppUser);
      } else {
        toast({ title: "Error", description: "Barber not found.", variant: "destructive" });
        router.push('/customer/dashboard');
        return;
      }

      // Fetch barber's services
      const servicesQuery = query(
        collection(firestore, 'services'),
        where('barberId', '==', barberId),
        orderBy('createdAt', 'desc')
      );
      const servicesSnapshot = await getDocs(servicesQuery);
      const fetchedServices = servicesSnapshot.docs.map(sDoc => ({ id: sDoc.id, ...sDoc.data() } as BarberService));
      setServices(fetchedServices);

    } catch (error) {
      console.error("Error fetching barber details or services:", error);
      toast({ title: "Error", description: "Could not load barber's information.", variant: "destructive" });
      router.push('/customer/dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [barberId, toast, router]);

  useEffect(() => {
    fetchBarberAndServices();
  }, [fetchBarberAndServices]);

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

  if (!barber) {
    // This case should ideally be handled by the loading state or redirect within fetch function
    return (
      <ProtectedPage expectedRole="customer">
        <div className="text-center py-10">
          <h2 className="text-xl font-bold text-destructive">Barber information not available.</h2>
          <Button onClick={() => router.push('/customer/dashboard')} className="mt-6 h-12 rounded-full px-6 text-base">
            Back to Dashboard
          </Button>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage expectedRole="customer">
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/customer/dashboard#find-barber')} className="rounded-full h-11 px-5 text-base">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Barbers List
        </Button>

        <Card className="border-none shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-4 md:p-6">
            <div className="flex items-center space-x-3">
                <UserCircle className="h-10 w-10 text-primary" />
                <div>
                    <CardTitle className="text-2xl font-bold">
                    {barber.firstName} {barber.lastName}
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-500">View services and book an appointment.</CardDescription>
                </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-4 md:p-6">
            <h3 className="text-xl font-semibold mb-4 text-foreground">Services Offered</h3>
            {services.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map(service => (
                  <Card key={service.id} className="shadow-md rounded-lg border">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-base font-semibold flex items-center">
                        <Scissors className="mr-2 h-5 w-5 text-primary" /> {service.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-600 space-y-1 px-4 pb-3">
                      <p className="flex items-center"><DollarSign className="mr-1.5 h-4 w-4 text-gray-400" />Price: <span className="font-medium text-foreground ml-1">${service.price.toFixed(2)}</span></p>
                      <p className="flex items-center"><Clock className="mr-1.5 h-4 w-4 text-gray-400" />Duration: <span className="font-medium text-[#0088E0] ml-1">{service.duration} minutes</span></p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-base text-gray-500">This barber has not listed any services yet.</p>
            )}
          </CardContent>

          <CardFooter className="p-4 md:p-6 border-t">
            <Button asChild className="w-full sm:w-auto h-14 rounded-full text-lg">
              <Link href={`/customer/book/${barberId}`}>
                <CalendarPlus className="mr-2 h-5 w-5" /> Book with {barber.firstName}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </ProtectedPage>
  );
}

