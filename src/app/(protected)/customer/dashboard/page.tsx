
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { Appointment, AppUser, AppointmentStatus, Rating } from '@/types';
import { firestore } from '@/firebase/config';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, updateDoc, runTransaction, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { CalendarDays, Clock, Scissors, Eye, XCircle, Search, UserCircle, Play, CheckSquare, LogIn, History, CheckCircle, CircleSlash, Star } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
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
import { getItemWithTimestampRevival, setItemWithTimestampConversion, LS_MY_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD, getSimpleItem, setSimpleItem, LS_AVAILABLE_BARBERS_KEY_CUSTOMER_DASHBOARD } from '@/lib/localStorageUtils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const RatingDialog = dynamic(() => import('@/components/customer/RatingDialog'), {
  loading: () => <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[100]"><LoadingSpinner className="h-8 w-8 text-primary" /></div>,
  ssr: false
});

const LS_PAST_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD = 'customer_dashboard_past_appointments';

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


export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeAppointments, setActiveAppointments] = useState<Appointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [availableBarbers, setAvailableBarbers] = useState<AppUser[]>([]);
  const [isLoadingBarbers, setIsLoadingBarbers] = useState(true);
  const [today, setToday] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isUpdatingAppointment, setIsUpdatingAppointment] = useState<string | null>(null);

  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
  const [appointmentToRate, setAppointmentToRate] = useState<Appointment | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);


  useEffect(() => {
    setToday(getTodayDateString());
    if (typeof window !== 'undefined') {
        const cachedActiveAppointments = getItemWithTimestampRevival<Appointment[]>(LS_MY_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD);
        if (cachedActiveAppointments) {
            setActiveAppointments(cachedActiveAppointments);
        }
        const cachedPastAppointments = getItemWithTimestampRevival<Appointment[]>(LS_PAST_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD);
        if (cachedPastAppointments) {
            setPastAppointments(cachedPastAppointments);
        }
        if (cachedActiveAppointments || cachedPastAppointments) {
             setIsLoadingAppointments(false);
        }

        const cachedAvailableBarbers = getSimpleItem<AppUser[]>(LS_AVAILABLE_BARBERS_KEY_CUSTOMER_DASHBOARD);
        if (cachedAvailableBarbers) {
            setAvailableBarbers(cachedAvailableBarbers);
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
        orderBy('date', 'desc'),
        orderBy('startTime', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const fetchedAppointments: Appointment[] = [];
      querySnapshot.forEach((doc) => {
        fetchedAppointments.push({ id: doc.id, ...doc.data() } as Appointment);
      });

      const active = fetchedAppointments
        .filter(app => app.status !== 'completed' && app.status !== 'cancelled')
        .sort((a, b) => {
          if (a.date === b.date) {
            return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
          }
          return a.date.localeCompare(b.date);
        });
      
      const past = fetchedAppointments
        .filter(app => app.status === 'completed' || app.status === 'cancelled')
        .sort((a,b) => {
            if (a.date === b.date) {
                return timeToMinutes(b.startTime) - timeToMinutes(a.startTime);
            }
            return b.date.localeCompare(a.date);
        });


      setActiveAppointments(active);
      setPastAppointments(past);
      setItemWithTimestampConversion(LS_MY_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD, active);
      setItemWithTimestampConversion(LS_PAST_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD, past);

    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({ title: "Error", description: "Could not fetch your appointments.", variant: "destructive" });
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [user?.uid, toast, today]);

  const handleAppointmentAction = async (appointmentId: string, action: 'CUSTOMER_CHECK_IN' | 'CUSTOMER_CONFIRM_START' | 'CUSTOMER_MARK_DONE' | 'CUSTOMER_CONFIRM_COMPLETION') => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsUpdatingAppointment(appointmentId);
    const appointmentRef = doc(firestore, 'appointments', appointmentId);
    const now = Timestamp.now();
    let updateData: Partial<Appointment> = { updatedAt: now };
    let newStatus: AppointmentStatus | undefined = undefined;
    let successMessage = "";

    try {
      const currentAppointment = [...activeAppointments, ...pastAppointments].find(app => app.id === appointmentId);
      if (!currentAppointment) {
        toast({ title: "Error", description: "Appointment not found.", variant: "destructive" });
        setIsUpdatingAppointment(null);
        return;
      }

      switch (action) {
        case 'CUSTOMER_CHECK_IN':
          updateData.customerCheckedInAt = now;
          if (currentAppointment.barberCheckedInAt) {
            newStatus = 'in-progress';
            updateData.serviceActuallyStartedAt = now;
            successMessage = "Check-in confirmed, service started.";
          } else {
            newStatus = 'customer-initiated-check-in';
            successMessage = "You've checked in. Waiting for barber to confirm.";
          }
          break;
        case 'CUSTOMER_CONFIRM_START':
          if (currentAppointment.status === 'barber-initiated-check-in') {
            updateData.customerCheckedInAt = now;
            updateData.serviceActuallyStartedAt = now;
            newStatus = 'in-progress';
            successMessage = "Your arrival confirmed, service started.";
          }
          break;
        case 'CUSTOMER_MARK_DONE':
          updateData.customerMarkedDoneAt = now;
          if (currentAppointment.barberMarkedDoneAt) {
            newStatus = 'completed';
            updateData.serviceActuallyCompletedAt = now;
            successMessage = "Service mutually completed.";
          } else {
            newStatus = 'customer-initiated-completion';
            successMessage = "Service marked as done by you. Waiting for barber's confirmation.";
          }
          break;
        case 'CUSTOMER_CONFIRM_COMPLETION':
          if (currentAppointment.status === 'barber-initiated-completion') {
            updateData.customerMarkedDoneAt = now;
            updateData.serviceActuallyCompletedAt = now;
            newStatus = 'completed';
            successMessage = "Service mutually completed.";
          }
          break;
      }

      if (newStatus) {
        updateData.status = newStatus;
      }

      await updateDoc(appointmentRef, updateData);
      
      toast({ title: "Success", description: successMessage || "Appointment updated." });
      
      const updatedApptSnapshot = await getDocs(query(collection(firestore, 'appointments'), where('__name__', '==', appointmentId)));
      const updatedApptData = { id: updatedApptSnapshot.docs[0].id, ...updatedApptSnapshot.docs[0].data() } as Appointment;


      if (updatedApptData.status === 'completed' && !updatedApptData.customerRating) {
        setAppointmentToRate(updatedApptData);
        setIsRatingDialogOpen(true);
      }
      fetchMyAppointments();

    } catch (error) {
      console.error("Error updating appointment:", error);
      toast({ title: "Error", description: "Could not update appointment status.", variant: "destructive" });
    } finally {
      setIsUpdatingAppointment(null);
    }
  };


  const fetchAvailableBarbers = useCallback(async () => {
    setIsLoadingBarbers(true);
    try {
      const usersCollection = collection(firestore, 'users');
      const q = query(usersCollection, where('role', '==', 'barber'), orderBy('firstName', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetchedBarbersData: AppUser[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const isAccepting = data.isAcceptingBookings !== undefined && data.isAcceptingBookings !== null ? data.isAcceptingBookings : true;
        
        fetchedBarbersData.push({
        uid: doc.id,
        id: doc.id,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        phoneNumber: data.phoneNumber,
        address: data.address,
        isAcceptingBookings: isAccepting,
        email: data.email,
        averageRating: data.averageRating || 0,
        ratingCount: data.ratingCount || 0,
        } as AppUser);
      });
      setAvailableBarbers(fetchedBarbersData);
      setSimpleItem(LS_AVAILABLE_BARBERS_KEY_CUSTOMER_DASHBOARD, fetchedBarbersData);
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
      
      fetchMyAppointments();
      toast({ title: "Appointment Cancelled", description: "Your appointment has been successfully cancelled." });
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast({ title: "Error", description: "Could not cancel appointment.", variant: "destructive" });
    } finally {
      setIsCancelling(false);
      setAppointmentToCancel(null);
    }
  };

  const handleSaveRating = async (appointmentId: string, ratingScore: number, comment?: string) => {
    if (!user?.uid || !appointmentToRate) {
        toast({ title: "Error", description: "User or appointment not found for rating.", variant: "destructive" });
        return;
    }
    setIsSubmittingRating(true);
    const now = Timestamp.now();

    try {
        await runTransaction(firestore, async (transaction) => {
            const appointmentRef = doc(firestore, 'appointments', appointmentId);
            const barberRef = doc(firestore, 'users', appointmentToRate.barberId);
            const newRatingRef = doc(collection(firestore, 'ratings')); // Auto-generate ID

            // 1. Get current barber data
            const barberSnap = await transaction.get(barberRef);
            if (!barberSnap.exists()) {
                throw new Error("Barber profile not found.");
            }
            const barberData = barberSnap.data() as AppUser;

            // 2. Get appointment data (to ensure it's not already rated by this user if necessary, though UI should prevent)
            const appointmentSnap = await transaction.get(appointmentRef);
            if (!appointmentSnap.exists()) {
                throw new Error("Appointment not found.");
            }
            const currentAppointmentData = appointmentSnap.data() as Appointment;
            if (currentAppointmentData.customerRating) {
                 // This case should ideally be prevented by the UI, but good to double check
                console.warn(`Appointment ${appointmentId} already has a rating. Overwriting.`);
            }


            // 3. Calculate new average rating and count for the barber
            const oldRatingTotal = (barberData.averageRating || 0) * (barberData.ratingCount || 0);
            const newRatingCount = (barberData.ratingCount || 0) + 1;
            const newAverageRating = (oldRatingTotal + ratingScore) / newRatingCount;

            // 4. Create new rating document
            const ratingData: Omit<Rating, 'id'> = { // Omit id as it's auto-generated
                barberId: appointmentToRate.barberId,
                customerId: user.uid,
                appointmentId: appointmentId,
                score: ratingScore,
                comment: comment || null,
                createdAt: now,
            };
            transaction.set(newRatingRef, ratingData);

            // 5. Update appointment with rating details
            transaction.update(appointmentRef, {
                customerRating: ratingScore,
                ratingComment: comment || null,
                updatedAt: now,
            });

            // 6. Update barber's profile with new average rating and count
            transaction.update(barberRef, {
                averageRating: parseFloat(newAverageRating.toFixed(2)), // Store with 2 decimal places
                ratingCount: newRatingCount,
                updatedAt: now,
            });
        });

        toast({ title: "Rating Submitted!", description: "Thank you for your feedback." });
        fetchMyAppointments(); // Refresh user's appointments
        fetchAvailableBarbers(); // Refresh barber list to show updated average rating

    } catch (error) {
        console.error("Error saving rating with transaction:", error);
        toast({ title: "Rating Error", description: (error as Error).message || "Could not save your rating.", variant: "destructive" });
    } finally {
        setIsSubmittingRating(false);
        setIsRatingDialogOpen(false);
        setAppointmentToRate(null);
    }
  };


  const renderAppointmentActions = (appointment: Appointment) => {
    const isProcessingThis = isUpdatingAppointment === appointment.id;
    switch (appointment.status) {
      case 'upcoming':
        return (
          <Button onClick={() => handleAppointmentAction(appointment.id, 'CUSTOMER_CHECK_IN')} size="sm" className="rounded-full h-9 px-4" disabled={isProcessingThis}>
            {isProcessingThis ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <LogIn className="mr-1.5 h-4 w-4" />} I'm Here (Check-In)
          </Button>
        );
      case 'barber-initiated-check-in':
        return (
          <Button onClick={() => handleAppointmentAction(appointment.id, 'CUSTOMER_CONFIRM_START')} size="sm" className="rounded-full h-9 px-4" disabled={isProcessingThis}>
            {isProcessingThis ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />} Confirm Arrival & Start
          </Button>
        );
      case 'customer-initiated-check-in':
        return <p className="text-sm text-muted-foreground text-right">Waiting for barber to confirm...</p>;
      case 'in-progress':
        return (
          <Button onClick={() => handleAppointmentAction(appointment.id, 'CUSTOMER_MARK_DONE')} size="sm" className="rounded-full h-9 px-4" disabled={isProcessingThis}>
            {isProcessingThis ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <CheckSquare className="mr-1.5 h-4 w-4" />} Mark Service Done
          </Button>
        );
      case 'barber-initiated-completion':
        return (
          <Button onClick={() => handleAppointmentAction(appointment.id, 'CUSTOMER_CONFIRM_COMPLETION')} size="sm" className="rounded-full h-9 px-4" disabled={isProcessingThis}>
            {isProcessingThis ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <CheckSquare className="mr-1.5 h-4 w-4" />} Confirm Service Done
          </Button>
        );
      case 'customer-initiated-completion':
        return <p className="text-sm text-muted-foreground text-right">Waiting for barber to confirm completion...</p>;
      default:
        return null;
    }
  };
  
  const getStatusLabelForCustomer = (status: AppointmentStatus) => {
    switch (status) {
        case 'upcoming': return 'Upcoming';
        case 'customer-initiated-check-in': return 'Awaiting Barber Confirmation';
        case 'barber-initiated-check-in': return 'Barber Noted Your Arrival';
        case 'in-progress': return 'Service In Progress';
        case 'customer-initiated-completion': return 'Awaiting Barber Completion';
        case 'barber-initiated-completion': return 'Barber Marked Done';
        case 'completed': return 'Completed';
        case 'cancelled': return 'Cancelled';
        default: return status;
    }
  };

  const renderStars = (rating: number) => {
    const totalStars = 5;
    return (
      <div className="flex items-center">
        {[...Array(totalStars)].map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-4 w-4",
              i < Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-300 dark:text-gray-500"
            )}
          />
        ))}
        {rating > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({rating.toFixed(1)})</span>}
      </div>
    );
  };

  return (
    <ProtectedPage expectedRole="customer">
      <div className="space-y-8">
        <h1 className="text-2xl font-bold font-headline">
          Welcome, {user?.firstName || user?.displayName || 'Customer'}!
        </h1>
        
        <Card className="border-none shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
            <CardTitle className="text-xl font-bold">Your Active Appointments</CardTitle>
            <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your check-ins and service completions.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            {(isLoadingAppointments && !activeAppointments.length && !pastAppointments.length) ? (
              <div className="flex items-center justify-center py-6">
                <LoadingSpinner className="h-8 w-8 text-primary" />
                <p className="ml-3 text-base">Loading your appointments...</p>
              </div>
            ) : activeAppointments.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-base text-gray-500 dark:text-gray-400">You have no active appointments.</p>
                <p className="text-base text-gray-500 dark:text-gray-400">Ready to book your next one?</p>
                 <Button asChild className="rounded-full h-12 px-6 text-base !mt-5">
                    <Link href="#find-barber">Find a Barber</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeAppointments.map(app => (
                  <Card key={app.id} className="shadow-md rounded-lg border overflow-hidden hover:shadow-lg transition-shadow duration-200">
                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-start">
                      <div className="md:col-span-2 space-y-1.5">
                        <h3 className="text-base font-semibold text-primary flex items-center">
                          <Scissors className="mr-2 h-5 w-5 flex-shrink-0" /> {app.serviceName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                          <UserCircle className="mr-2 h-4 w-4 flex-shrink-0" /> With: {app.barberName}
                        </p>
                         <p className="text-xs text-muted-foreground capitalize">Status: {getStatusLabelForCustomer(app.status)}</p>
                      </div>
                      <div className="space-y-1 text-sm text-left md:text-right">
                        <p className="font-medium flex items-center md:justify-end text-base">
                          <CalendarDays className="mr-2 h-4 w-4 flex-shrink-0" /> {formatDate(app.date)}
                        </p>
                        <p className="text-primary flex items-center md:justify-end">
                          <Clock className="mr-2 h-4 w-4 flex-shrink-0" /> {app.startTime}
                        </p>
                      </div>
                      <div className="md:col-span-3 flex flex-col sm:flex-row justify-end items-center pt-3 mt-3 border-t gap-2">
                          {app.status !== 'cancelled' && app.status !== 'completed' && renderAppointmentActions(app)}
                          {(app.status === 'upcoming' || app.status === 'customer-initiated-check-in' || app.status === 'barber-initiated-check-in') && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="rounded-full h-9 px-4 text-sm"
                              onClick={() => setAppointmentToCancel(app)}
                              disabled={isCancelling || isUpdatingAppointment === app.id}
                            >
                              {isCancelling && appointmentToCancel?.id === app.id ? (
                                <LoadingSpinner className="mr-1.5 h-4 w-4" />
                              ) : (
                                <XCircle className="mr-1.5 h-4 w-4" />
                              )}
                              Cancel
                            </Button>
                          )}
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
            <CardTitle className="text-xl font-bold flex items-center"><History className="mr-2 h-5 w-5 text-primary"/> Appointment History</CardTitle>
            <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">View your past completed or cancelled appointments.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            {(isLoadingAppointments && !pastAppointments.length && !activeAppointments.length) ? ( 
              <div className="flex items-center justify-center py-6">
                <LoadingSpinner className="h-8 w-8 text-primary" />
                <p className="ml-3 text-base">Loading history...</p>
              </div>
            ) : pastAppointments.length === 0 ? (
              <p className="text-base text-gray-500 dark:text-gray-400">You have no past appointments.</p>
            ) : (
              <div className="space-y-4">
                {pastAppointments.map(app => (
                  <Card key={app.id} className="shadow-md rounded-lg border overflow-hidden opacity-80 hover:opacity-100 transition-opacity duration-200">
                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-start">
                      <div className="md:col-span-2 space-y-1.5">
                        <h3 className="text-base font-semibold text-muted-foreground flex items-center">
                           <Scissors className="mr-2 h-5 w-5 flex-shrink-0" /> {app.serviceName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                          <UserCircle className="mr-2 h-4 w-4 flex-shrink-0" /> With: {app.barberName}
                        </p>
                         <p className={cn("text-xs font-medium capitalize", app.status === 'completed' ? 'text-green-600' : 'text-destructive')}>
                           Status: {getStatusLabelForCustomer(app.status)}
                         </p>
                         {app.status === 'completed' && app.customerRating && (
                            <div className="flex items-center mt-1">
                                {renderStars(app.customerRating)}
                                <span className="ml-2 text-xs text-muted-foreground">(Your Rating)</span>
                            </div>
                         )}
                      </div>
                      <div className="space-y-1 text-sm text-left md:text-right">
                        <p className="font-medium flex items-center md:justify-end text-base text-muted-foreground">
                          <CalendarDays className="mr-2 h-4 w-4 flex-shrink-0" /> {formatDate(app.date)}
                        </p>
                        <p className="text-muted-foreground flex items-center md:justify-end">
                          <Clock className="mr-2 h-4 w-4 flex-shrink-0" /> {app.startTime}
                        </p>
                      </div>
                       <div className="md:col-span-3 flex flex-col sm:flex-row justify-end items-center pt-3 mt-3 border-t gap-2">
                           {app.status === 'completed' && !app.customerRating && (
                             <Button
                               variant="outline"
                               size="sm"
                               className="rounded-full h-9 px-4"
                               onClick={() => { setAppointmentToRate(app); setIsRatingDialogOpen(true); }}
                             >
                               <Star className="mr-1.5 h-4 w-4 text-yellow-400"/> Rate Service
                             </Button>
                           )}
                           <Button asChild variant="outline" size="sm" className="rounded-full h-9 px-4">
                                <Link href={`/customer/book/${app.barberId}?serviceId=${app.serviceId}`}>
                                    Rebook This Service
                                </Link>
                            </Button>
                       </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>


        <Card id="find-barber" className="border-none shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
            <CardTitle className="text-xl font-bold">Explore Barbers</CardTitle>
            <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">Discover services offered by our talented barbers.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            {(isLoadingBarbers && !availableBarbers.length) ? (
              <div className="flex items-center justify-center py-6">
                <LoadingSpinner className="h-8 w-8 text-primary" />
                <p className="ml-3 text-base">Loading available barbers...</p>
              </div>
            ) : availableBarbers.length === 0 ? (
              <div className="text-center py-6">
                <Search className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-base text-gray-500 dark:text-gray-400">No barbers are currently listed or accepting online bookings.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {availableBarbers.map(barber => (
                  <Card key={barber.uid} className="shadow-md rounded-lg border hover:shadow-lg transition-shadow duration-200">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-grow">
                        <UserCircle className="h-10 w-10 text-muted-foreground flex-shrink-0" />
                        <div className="flex-grow">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-x-2 gap-y-0.5 mb-0.5">
                            <h3 className="text-base font-semibold">
                              {barber.firstName} {barber.lastName}
                            </h3>
                            {barber.isAcceptingBookings ? (
                              <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white text-xs py-0.5 px-2 whitespace-nowrap">
                                <CheckCircle className="mr-1 h-3 w-3" /> Accepting Bookings
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs py-0.5 px-2 whitespace-nowrap">
                                <CircleSlash className="mr-1 h-3 w-3" /> Not Accepting Bookings
                              </Badge>
                            )}
                          </div>
                           {renderStars(barber.averageRating || 0)}
                           {barber.ratingCount && barber.ratingCount > 0 ? (
                             <span className="text-xs text-muted-foreground ml-1">({barber.ratingCount} ratings)</span>
                           ) : (
                            <span className="text-xs text-muted-foreground ml-1">(No ratings yet)</span>
                           )}
                           {barber.address && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px] sm:max-w-full mt-0.5">
                                {barber.address}
                            </p>
                            )}
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm" className="rounded-full h-10 px-4 text-sm sm:text-base flex-shrink-0 w-full sm:w-auto mt-3 sm:mt-0">
                        <Link href={`/customer/view-barber/${barber.uid}`}>
                           <Eye className="mr-2 h-4 w-4" /> View Profile
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
          <AlertDialogContent className="rounded-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold">Confirm Cancellation</AlertDialogTitle>
              <AlertDialogDescription className="text-base text-gray-500 dark:text-gray-400 pt-1">
                Are you sure you want to cancel your appointment for <span className="font-semibold">{appointmentToCancel.serviceName}</span>
                {' '}with <span className="font-semibold">{appointmentToCancel.barberName}</span> on <span className="font-semibold">{formatDate(appointmentToCancel.date)} at {appointmentToCancel.startTime}</span>?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel onClick={() => setAppointmentToCancel(null)} className="rounded-full h-10 px-4" disabled={isCancelling}>Keep Appointment</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelAppointment}
                className="rounded-full h-10 px-4"
                variant="destructive"
                disabled={isCancelling}
              >
                {isCancelling ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isRatingDialogOpen && appointmentToRate && (
        <RatingDialog
          isOpen={isRatingDialogOpen}
          onClose={() => { setIsRatingDialogOpen(false); setAppointmentToRate(null); }}
          onSubmit={handleSaveRating}
          appointmentToRate={appointmentToRate}
          isSubmitting={isSubmittingRating}
        />
      )}
    </ProtectedPage>
  );
}
