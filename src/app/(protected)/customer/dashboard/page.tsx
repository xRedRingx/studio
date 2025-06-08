
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { Appointment } from '@/types';
import { firestore } from '@/firebase/config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { CalendarDays, Clock, Scissors, UserCircle } from 'lucide-react';
import Link from 'next/link';

// Helper to get today's date in YYYY-MM-DD format for filtering
const getTodayDateString = () => {
  // This must run client-side to avoid hydration mismatches
  // if used to filter data that might be pre-rendered with a different "today"
  return new Date().toISOString().split('T')[0];
};

// Helper to parse "HH:MM AM/PM" to minutes from midnight for sorting
const timeToMinutes = (timeStr: string): number => {
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (hours === 12) {
    hours = modifier.toUpperCase() === 'AM' ? 0 : 12;
  } else if (modifier.toUpperCase() === 'PM') {
    hours += 12;
  }
  return hours * 60 + minutes;
};

export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    // Set today's date string once on the client
    setToday(getTodayDateString());
  }, []);

  const fetchMyAppointments = useCallback(async () => {
    if (!user?.uid || !today) return; // Wait for user and today's date
    setIsLoadingAppointments(true);
    try {
      const appointmentsCollection = collection(firestore, 'appointments');
      const q = query(
        appointmentsCollection,
        where('customerId', '==', user.uid),
        orderBy('date', 'asc'), // Sort by date first (ascending for upcoming)
        // Firestore doesn't directly support orderBy on time strings like "HH:MM AM/PM" perfectly.
        // We will sort by startTime client-side after fetching.
      );
      const querySnapshot = await getDocs(q);
      const fetchedAppointments: Appointment[] = [];
      querySnapshot.forEach((doc) => {
        fetchedAppointments.push({ id: doc.id, ...doc.data() } as Appointment);
      });

      // Filter for upcoming appointments (today or future) and sort by time
      const upcomingAppointments = fetchedAppointments
        .filter(app => app.date >= today)
        .sort((a, b) => {
          if (a.date === b.date) {
            return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
          }
          return 0; // Already sorted by date by Firestore
        });

      setMyAppointments(upcomingAppointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({ title: "Error", description: "Could not fetch your appointments.", variant: "destructive" });
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [user?.uid, toast, today]);

  useEffect(() => {
    if (user?.uid && today) {
      fetchMyAppointments();
    }
  }, [user?.uid, fetchMyAppointments, today]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00'); // Ensure correct parsing by adding time part
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <ProtectedPage expectedRole="customer">
      <div className="space-y-8">
        <h1 className="text-4xl font-headline font-bold">
          Welcome, {user?.firstName || user?.displayName || 'Customer'}!
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>Your Upcoming Appointments</CardTitle>
            <CardDescription>View and manage your upcoming appointments.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAppointments ? (
              <div className="flex items-center justify-center py-6">
                <LoadingSpinner className="h-8 w-8 text-primary" />
                <p className="ml-2">Loading your appointments...</p>
              </div>
            ) : myAppointments.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">You have no upcoming appointments.</p>
                 <Button asChild>
                  <Link href="/customer/dashboard#find-barber">Book New Appointment</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {myAppointments.map(app => (
                  <Card key={app.id} className="shadow-md">
                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="md:col-span-2 space-y-1">
                        <h3 className="text-lg font-semibold text-primary flex items-center">
                          <Scissors className="mr-2 h-5 w-5" /> {app.serviceName}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center">
                          <UserCircle className="mr-2 h-4 w-4" /> With: {app.barberName}
                        </p>
                      </div>
                      <div className="space-y-1 text-sm md:text-right">
                        <p className="font-medium flex items-center md:justify-end">
                          <CalendarDays className="mr-2 h-4 w-4" /> {formatDate(app.date)}
                        </p>
                        <p className="text-muted-foreground flex items-center md:justify-end">
                          <Clock className="mr-2 h-4 w-4" /> {app.startTime}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <div className="pt-4 text-center">
                  <Button asChild>
                     <Link href="/customer/dashboard#find-barber">Book Another Appointment</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* This section can be used to list barbers if "Book New Appointment" scrolls to it */}
        <div id="find-barber">
            {/* Placeholder for Barber Listing - for now it's a link target */}
            {/* In a more advanced setup, the barber list from the book/[barberId] page's parent could be shown here */}
        </div>

        {/* Existing "Explore Services" Card - can be kept or re-evaluated */}
        <Card>
          <CardHeader>
            <CardTitle>Explore Barbers</CardTitle>
            <CardDescription>Discover services offered by our talented barbers.</CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-muted-foreground">Our barbers are listed below. Select one to book an appointment.</p>
             {/* The actual list of barbers would be rendered here, similar to the initial state of this page or a dedicated component */}
             {/* For now, just guide the user to where they'd find barbers (implicitly the main dashboard if not showing here) */}
             <Button variant="outline" className="mt-4" asChild>
                <Link href="/customer/dashboard">Browse Barbers</Link>
             </Button>
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
