
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { Appointment, AppUser } from '@/types';
import { firestore } from '@/firebase/config';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { CalendarDays, Clock, Scissors, UserCircle, ChevronRight, XCircle, Ban } from 'lucide-react';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const getTodayDateString = () => {
  return new Date().toISOString().split('T')[0];
};

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

// Helper to convert Firestore Timestamps in an object to ISO strings
const convertTimestampsToISO = (data: any) => {
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(convertTimestampsToISO);
  }
  const newData: { [key: string]: any } = {};
  for (const key in data) {
    newData[key] = convertTimestampsToISO(data[key]);
  }
  return newData;
};

// Helper to convert ISO strings in an object back to Timestamps
const convertISOToTimestamps = (data: any): any => {
    if (data === null || typeof data !== 'object') {
      if (typeof data === 'string' && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(data)) {
         try {
            return Timestamp.fromDate(new Date(data));
        } catch (e) { /* ignore, not a valid date string for Timestamp */ }
      }
      return data;
    }
    if (Array.isArray(data)) {
      return data.map(convertISOToTimestamps);
    }
    const newData: { [key: string]: any } = {};
    for (const key in data) {
      newData[key] = convertISOToTimestamps(data[key]);
    }
    return newData;
  };

const LS_MY_APPOINTMENTS_KEY = 'customer_dashboard_my_appointments';
const LS_AVAILABLE_BARBERS_KEY = 'customer_dashboard_available_barbers';


export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [availableBarbers, setAvailableBarbers] = useState<AppUser[]>([]);
  const [isLoadingBarbers, setIsLoadingBarbers] = useState(true);
  const [today, setToday] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    setToday(getTodayDateString());
    if (typeof window !== 'undefined') {
        const cachedMyAppointments = localStorage.getItem(LS_MY_APPOINTMENTS_KEY);
        if (cachedMyAppointments) {
            setMyAppointments(convertISOToTimestamps(JSON.parse(cachedMyAppointments)));
            setIsLoadingAppointments(false);
        }
        const cachedAvailableBarbers = localStorage.getItem(LS_AVAILABLE_BARBERS_KEY);
        if (cachedAvailableBarbers) {
            setAvailableBarbers(JSON.parse(cachedAvailableBarbers));
            setIsLoadingBarbers(false);
        }
        setInitialLoadComplete(true);
    }
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
        .filter(app => app.date >= today && app.status === 'upcoming') // Only show upcoming
        .sort((a, b) => {
          if (a.date === b.date) {
            return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
          }
          return a.date.localeCompare(b.date);
        });

      setMyAppointments(upcomingAppointments);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_MY_APPOINTMENTS_KEY, JSON.stringify(convertTimestampsToISO(upcomingAppointments)));
      }
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
        const data = doc.data();
        fetchedBarbers.push({
          uid: doc.id,
          id: doc.id,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          phoneNumber: data.phoneNumber,
        } as AppUser); 
      });
      setAvailableBarbers(fetchedBarbers);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_AVAILABLE_BARBERS_KEY, JSON.stringify(fetchedBarbers));
      }
    } catch (error) {
      console.error("Error fetching barbers:", error);
      toast({ title: "Error", description: "Could not fetch available barbers.", variant: "destructive" });
    } finally {
      setIsLoadingBarbers(false);
    }
  }, [toast]);

  useEffect(() => {
    if (initialLoadComplete) {
        if (user?.uid && today) {
          fetchMyAppointments();
        }
        fetchAvailableBarbers();
    }
  }, [user?.uid, fetchMyAppointments, fetchAvailableBarbers, today, initialLoadComplete]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00'); 
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const handleCancelAppointment = async () => {
    if (!appointmentToCancel || !user?.uid) return;
    setIsCancelling(true);
    try {
      const appointmentRef = doc(firestore, 'appointments', appointmentToCancel.id);
      await updateDoc(appointmentRef, {
        status: 'cancelled',
        updatedAt: Timestamp.now(),
      });
      
      setMyAppointments(prev => {
        const updated = prev.filter(app => app.id !== appointmentToCancel.id);
        if (typeof window !== 'undefined') {
          localStorage.setItem(LS_MY_APPOINTMENTS_KEY, JSON.stringify(convertTimestampsToISO(updated)));
        }
        return updated;
      });
      toast({ title: "Appointment Cancelled", description: "Your appointment has been successfully cancelled." });
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast({ title: "Error", description: "Could not cancel appointment.", variant: "destructive" });
    } finally {
      setIsCancelling(false);
      setAppointmentToCancel(null);
    }
  };

  return (
    <ProtectedPage expectedRole="customer">
      <div className="space-y-8">
        <h1 className="text-2xl font-bold font-headline">
          Welcome, {user?.firstName || user?.displayName || 'Customer'}!
        </h1>
        
        <Card className="border-none shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-2xl font-bold">Your Upcoming Appointments</CardTitle>
            <CardDescription className="text-sm text-gray-500 mt-1">View and manage your upcoming appointments.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            {(isLoadingAppointments && !myAppointments.length) ? (
              <div className="flex items-center justify-center py-6">
                <LoadingSpinner className="h-8 w-8 text-primary" />
                <p className="ml-3 text-base">Loading your appointments...</p>
              </div>
            ) : myAppointments.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-base text-gray-500 mb-4">You have no upcoming appointments.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myAppointments.map(app => (
                  <Card key={app.id} className="shadow-md rounded-lg border overflow-hidden">
                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 items-start">
                      <div className="md:col-span-2 space-y-1">
                        <h3 className="text-base font-semibold text-primary flex items-center">
                          <Scissors className="mr-2 h-5 w-5" /> {app.serviceName}
                        </h3>
                        <p className="text-sm text-gray-500 flex items-center">
                          <UserCircle className="mr-2 h-4 w-4" /> With: {app.barberName}
                        </p>
                      </div>
                      <div className="space-y-1 text-sm text-left md:text-right">
                        <p className="font-medium flex items-center md:justify-end text-base">
                          <CalendarDays className="mr-2 h-4 w-4" /> {formatDate(app.date)}
                        </p>
                        <p className="text-[#0088E0] flex items-center md:justify-end">
                          <Clock className="mr-2 h-4 w-4" /> {app.startTime}
                        </p>
                      </div>
                       {app.status === 'upcoming' && (
                        <div className="md:col-span-3 flex justify-end pt-2 mt-2 border-t border-gray-200">
                           <Button
                            variant="destructive"
                            size="sm"
                            className="rounded-full h-9 px-3"
                            onClick={() => setAppointmentToCancel(app)}
                            disabled={isCancelling}
                          >
                            {isCancelling && appointmentToCancel?.id === app.id ? (
                              <LoadingSpinner className="mr-1.5 h-4 w-4" />
                            ) : (
                              <XCircle className="mr-1.5 h-4 w-4" />
                            )}
                            Cancel
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="find-barber" className="border-none shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-2xl font-bold">Explore Barbers</CardTitle>
            <CardDescription className="text-sm text-gray-500 mt-1">Discover services offered by our talented barbers.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            {(isLoadingBarbers && !availableBarbers.length) ? (
              <div className="flex items-center justify-center py-6">
                <LoadingSpinner className="h-8 w-8 text-primary" />
                <p className="ml-3 text-base">Loading available barbers...</p>
              </div>
            ) : availableBarbers.length === 0 ? (
              <p className="text-sm text-gray-500">No barbers are currently available.</p>
            ) : (
              <div className="space-y-4">
                {availableBarbers.map(barber => (
                  <Card key={barber.uid} className="shadow-md rounded-lg border">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold">
                          {barber.firstName} {barber.lastName}
                        </h3>
                      </div>
                      <Button asChild variant="outline" size="sm" className="rounded-full h-10 px-4 text-base w-full sm:w-auto">
                        <Link href={`/customer/book/${barber.uid}`}>
                          Book <ChevronRight className="ml-2 h-4 w-4" />
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
      {appointmentToCancel && (
        <AlertDialog open={!!appointmentToCancel} onOpenChange={(open) => !open && setAppointmentToCancel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold">Confirm Cancellation</AlertDialogTitle>
              <AlertDialogDescription className="text-base text-gray-500">
                Are you sure you want to cancel your appointment for <span className="font-semibold">{appointmentToCancel.serviceName}</span>
                {' '}with <span className="font-semibold">{appointmentToCancel.barberName}</span> on <span className="font-semibold">{formatDate(appointmentToCancel.date)} at {appointmentToCancel.startTime}</span>?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel onClick={() => setAppointmentToCancel(null)} className="rounded-full h-10 px-4" disabled={isCancelling}>Keep Appointment</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelAppointment}
                className="rounded-full h-10 px-4 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                disabled={isCancelling}
              >
                {isCancelling ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" />}
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </ProtectedPage>
  );
}
