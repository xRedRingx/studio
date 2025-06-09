
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { Appointment, AppUser } from '@/types';
import { firestore } from '@/firebase/config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { CalendarDays, Clock, Scissors, UserCircle, ChevronRight } from 'lucide-react';
import Link from 'next/link';

// Helper to get today's date in YYYY-MM-DD format for filtering
const getTodayDateString = () => {
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
  const [availableBarbers, setAvailableBarbers] = useState<AppUser[]>([]);
  const [isLoadingBarbers, setIsLoadingBarbers] = useState(true);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(getTodayDateString());
  }, []);

  const fetchMyAppointments = useCallback(async () => {
    if (!user?.uid || !today) return;
    setIsLoadingAppointments(true);
    try {
      const appointmentsCollection = collection(firestore, 'appointments');
      const q = query(
        appointmentsCollection,
        where('customerId', '==', user.uid),
        orderBy('date', 'asc'),
      );
      const querySnapshot = await getDocs(q);
      const fetchedAppointments: Appointment[] = [];
      querySnapshot.forEach((doc) => {
        fetchedAppointments.push({ id: doc.id, ...doc.data() } as Appointment);
      });

      const upcomingAppointments = fetchedAppointments
        .filter(app => app.date >= today)
        .sort((a, b) => {
          if (a.date === b.date) {
            return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
          }
          return 0; 
        });

      setMyAppointments(upcomingAppointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({ title: "Error", description: "Could not fetch your appointments.", variant: "destructive" });
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [user?.uid, toast, today]);

  const fetchAvailableBarbers = useCallback(async () => {
    setIsLoadingBarbers(true);
    try {
      const usersCollection = collection(firestore, 'users');
      const q = query(usersCollection, where('role', '==', 'barber'), orderBy('firstName', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetchedBarbers: AppUser[] = [];
      querySnapshot.forEach((doc) => {
        // Ensure only essential and safe data is passed
        const data = doc.data();
        fetchedBarbers.push({
          uid: doc.id,
          firstName: data.firstName,
          lastName: data.lastName,
          // Do not fetch sensitive fields like phoneNumber or email for listing
        } as AppUser); // Cast as AppUser, but only with safe fields
      });
      setAvailableBarbers(fetchedBarbers);
    } catch (error) {
      console.error("Error fetching barbers:", error);
      toast({ title: "Error", description: "Could not fetch available barbers.", variant: "destructive" });
    } finally {
      setIsLoadingBarbers(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user?.uid && today) {
      fetchMyAppointments();
    }
    fetchAvailableBarbers(); // Fetch barbers regardless of user login for now
  }, [user?.uid, fetchMyAppointments, fetchAvailableBarbers, today]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00'); 
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
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="find-barber">
          <CardHeader>
            <CardTitle>Explore Barbers</CardTitle>
            <CardDescription>Discover services offered by our talented barbers.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingBarbers ? (
              <div className="flex items-center justify-center py-6">
                <LoadingSpinner className="h-8 w-8 text-primary" />
                <p className="ml-2">Loading available barbers...</p>
              </div>
            ) : availableBarbers.length === 0 ? (
              <p className="text-muted-foreground">No barbers are currently available.</p>
            ) : (
              <div className="space-y-3">
                {availableBarbers.map(barber => (
                  <Card key={barber.uid} className="shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {barber.firstName} {barber.lastName}
                        </h3>
                        {/* Could add more barber info here if available, like specialties */}
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/customer/book/${barber.uid}`}>
                          Book Appointment <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
