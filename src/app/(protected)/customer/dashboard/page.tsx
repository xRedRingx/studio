
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { Appointment, AppUser, AppointmentStatus } from '@/types';
import { firestore } from '@/firebase/config';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { CalendarDays, Clock, Scissors, Eye, XCircle, Search, UserCircle, Play, CheckSquare, LogIn, History, CheckCircle, CircleSlash, UserX, Hourglass } from 'lucide-react';
import Link from 'next/link';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getItemWithTimestampRevival, setItemWithTimestampConversion, LS_MY_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD, getSimpleItem, setSimpleItem, LS_AVAILABLE_BARBERS_KEY_CUSTOMER_DASHBOARD } from '@/lib/localStorageUtils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const LS_PAST_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD = 'customer_dashboard_past_appointments';
const MIN_CANCELLATION_LEAD_TIME_HOURS = 2;

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(' ')) return 0;
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (hours === 12) hours = modifier.toUpperCase() === 'AM' ? 0 : 12;
  else if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
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


  useEffect(() => {
    setToday(getTodayDateString());
    if (typeof window !== 'undefined') {
        const cachedActive = getItemWithTimestampRevival<Appointment[]>(LS_MY_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD);
        if (cachedActive) setActiveAppointments(cachedActive);
        const cachedPast = getItemWithTimestampRevival<Appointment[]>(LS_PAST_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD);
        if (cachedPast) setPastAppointments(cachedPast);
        if (cachedActive || cachedPast) setIsLoadingAppointments(false);

        const cachedBarbers = getSimpleItem<AppUser[]>(LS_AVAILABLE_BARBERS_KEY_CUSTOMER_DASHBOARD);
        if (cachedBarbers) { setAvailableBarbers(cachedBarbers); setIsLoadingBarbers(false); }
        setInitialLoadComplete(true);
    }
  }, []);

  const fetchMyAppointments = useCallback(async () => {
    if (!user?.uid || !today) return;
    setIsLoadingAppointments(true);
    try {
      const q = query(collection(firestore, 'appointments'), where('customerId', '==', user.uid), orderBy('date', 'desc'), orderBy('startTime', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedAppointments: Appointment[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      const active = fetchedAppointments.filter(app => !['completed', 'cancelled', 'no-show'].includes(app.status)).sort((a, b) => a.date.localeCompare(b.date) || timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      const past = fetchedAppointments.filter(app => ['completed', 'cancelled', 'no-show'].includes(app.status)).sort((a,b) => b.date.localeCompare(a.date) || timeToMinutes(b.startTime) - timeToMinutes(a.startTime));
      setActiveAppointments(active); setPastAppointments(past);
      setItemWithTimestampConversion(LS_MY_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD, active);
      setItemWithTimestampConversion(LS_PAST_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD, past);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({ title: "Error", description: "Could not fetch appointments.", variant: "destructive" });
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [user?.uid, toast, today]);

  const handleAppointmentAction = async (appointmentId: string, action: 'CUSTOMER_CHECK_IN' | 'CUSTOMER_CONFIRM_START' | 'CUSTOMER_MARK_DONE' | 'CUSTOMER_CONFIRM_COMPLETION') => {
    if (!user?.uid) { toast({ title: "Error", description: "Must be logged in.", variant: "destructive" }); return; }
    setIsUpdatingAppointment(appointmentId);
    const appointmentRef = doc(firestore, 'appointments', appointmentId);
    const now = Timestamp.now();
    let updateData: Partial<Appointment> = { updatedAt: now };
    let newStatus: AppointmentStatus | undefined = undefined;
    let successMessage = "";

    try {
      const currentAppointment = [...activeAppointments, ...pastAppointments].find(app => app.id === appointmentId);
      if (!currentAppointment) throw new Error("Appointment not found.");
      switch (action) {
        case 'CUSTOMER_CHECK_IN':
          updateData.customerCheckedInAt = now;
          newStatus = currentAppointment.barberCheckedInAt ? 'in-progress' : 'customer-initiated-check-in';
          if (newStatus === 'in-progress') updateData.serviceActuallyStartedAt = now;
          successMessage = newStatus === 'in-progress' ? "Check-in confirmed, service started." : "You've checked in. Waiting for barber.";
          break;
        case 'CUSTOMER_CONFIRM_START':
          if (currentAppointment.status === 'barber-initiated-check-in') {
            updateData.customerCheckedInAt = now; updateData.serviceActuallyStartedAt = now; newStatus = 'in-progress';
            successMessage = "Arrival confirmed, service started.";
          } break;
        case 'CUSTOMER_MARK_DONE':
          updateData.customerMarkedDoneAt = now;
          newStatus = currentAppointment.barberMarkedDoneAt ? 'completed' : 'customer-initiated-completion';
          if (newStatus === 'completed') updateData.serviceActuallyCompletedAt = now;
          successMessage = newStatus === 'completed' ? "Service mutually completed." : "Service marked done. Waiting for barber.";
          break;
        case 'CUSTOMER_CONFIRM_COMPLETION':
          if (currentAppointment.status === 'barber-initiated-completion') {
            updateData.customerMarkedDoneAt = now; updateData.serviceActuallyCompletedAt = now; newStatus = 'completed';
            successMessage = "Service mutually completed.";
          } break;
      }
      if (newStatus) updateData.status = newStatus;
      await updateDoc(appointmentRef, updateData);
      toast({ title: "Success", description: successMessage || "Appointment updated." });
      fetchMyAppointments();
    } catch (error: any) {
      console.error("Error updating appointment:", error);
      toast({ title: "Error", description: error.message || "Could not update appointment status.", variant: "destructive" });
    } finally {
      setIsUpdatingAppointment(null);
    }
  };

  const fetchAvailableBarbers = useCallback(async () => {
    setIsLoadingBarbers(true);
    try {
      const q = query(collection(firestore, 'users'), where('role', '==', 'barber'), orderBy('firstName', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetchedBarbersData: AppUser[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id, ...data,
          isAcceptingBookings: data.isAcceptingBookings !== undefined ? data.isAcceptingBookings : true,
          isTemporarilyUnavailable: data.isTemporarilyUnavailable || false,
        } as AppUser;
      });
      setAvailableBarbers(fetchedBarbersData);
      setSimpleItem(LS_AVAILABLE_BARBERS_KEY_CUSTOMER_DASHBOARD, fetchedBarbersData);
    } catch (error) {
      console.error("Error fetching barbers:", error);
      toast({ title: "Error", description: "Could not fetch barbers.", variant: "destructive" });
    } finally {
      setIsLoadingBarbers(false);
    }
  }, [toast]);

  useEffect(() => {
    if (initialLoadComplete) {
        if (user?.uid && today) fetchMyAppointments();
        fetchAvailableBarbers();
    }
  }, [user?.uid, fetchMyAppointments, fetchAvailableBarbers, today, initialLoadComplete]);

  const formatDate = (dateString: string) => new Date(dateString + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const handleCancelAppointment = async () => {
    if (!appointmentToCancel || !user?.uid) return;
    setIsCancelling(true);
    try {
      await updateDoc(doc(firestore, 'appointments', appointmentToCancel.id), { status: 'cancelled', updatedAt: Timestamp.now() });
      fetchMyAppointments();
      toast({ title: "Appointment Cancelled", description: "Appointment successfully cancelled." });
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast({ title: "Error", description: "Could not cancel appointment.", variant: "destructive" });
    } finally {
      setIsCancelling(false); setAppointmentToCancel(null);
    }
  };

  const renderAppointmentActions = (appointment: Appointment) => {
    const isProcessingThis = isUpdatingAppointment === appointment.id;
    switch (appointment.status) {
      case 'upcoming': return (<Button onClick={() => handleAppointmentAction(appointment.id, 'CUSTOMER_CHECK_IN')} size="sm" className="rounded-full h-9 px-4" disabled={isProcessingThis}>{isProcessingThis ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <LogIn className="mr-1.5 h-4 w-4" />}I'm Here (Check-In)</Button>);
      case 'barber-initiated-check-in': return (<Button onClick={() => handleAppointmentAction(appointment.id, 'CUSTOMER_CONFIRM_START')} size="sm" className="rounded-full h-9 px-4" disabled={isProcessingThis}>{isProcessingThis ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}Confirm Arrival &amp; Start</Button>);
      case 'customer-initiated-check-in': return <p className="text-sm text-muted-foreground text-right">Waiting for barber...</p>;
      case 'in-progress': return (<Button onClick={() => handleAppointmentAction(appointment.id, 'CUSTOMER_MARK_DONE')} size="sm" className="rounded-full h-9 px-4" disabled={isProcessingThis}>{isProcessingThis ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <CheckSquare className="mr-1.5 h-4 w-4" />}Mark Service Done</Button>);
      case 'barber-initiated-completion': return (<Button onClick={() => handleAppointmentAction(appointment.id, 'CUSTOMER_CONFIRM_COMPLETION')} size="sm" className="rounded-full h-9 px-4" disabled={isProcessingThis}>{isProcessingThis ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <CheckSquare className="mr-1.5 h-4 w-4" />}Confirm Service Done</Button>);
      case 'customer-initiated-completion': return <p className="text-sm text-muted-foreground text-right">Waiting for barber completion...</p>;
      default: return null;
    }
  };
  
  const getStatusLabelForCustomer = (status: AppointmentStatus) => {
    const map: Record<AppointmentStatus, string> = {
        'upcoming': 'Upcoming', 'customer-initiated-check-in': 'Awaiting Barber', 'barber-initiated-check-in': 'Barber Noted Arrival',
        'in-progress': 'In Progress', 'customer-initiated-completion': 'Awaiting Barber Completion', 'barber-initiated-completion': 'Barber Marked Done',
        'completed': 'Completed', 'cancelled': 'Cancelled', 'no-show': 'Missed (No-Show)'
    };
    return map[status] || status;
  };

  return (
    <ProtectedPage expectedRole="customer">
    <TooltipProvider>
      <div className="space-y-8">
        <h1 className="text-2xl font-bold font-headline">Welcome, {user?.firstName || 'Customer'}!</h1>
        
        <Card className="border-none shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card"><CardTitle className="text-xl font-bold">Active Appointments</CardTitle><CardDescription className="text-sm text-gray-500 mt-1">Manage check-ins and completions.</CardDescription></CardHeader>
          <CardContent className="p-4 md:p-6">
            {(isLoadingAppointments && !activeAppointments.length && !pastAppointments.length) ? <div className="flex items-center justify-center py-6"><LoadingSpinner className="h-8 w-8 text-primary" /><p className="ml-3 text-base">Loading appointments...</p></div> :
             activeAppointments.length === 0 ? <div className="text-center py-6 space-y-3"><CalendarDays className="mx-auto h-12 w-12 text-muted-foreground" /><p className="text-base text-gray-500">No active appointments.</p><p className="text-base text-gray-500">Ready to book?</p><Button asChild className="rounded-full h-12 px-6 text-base !mt-5"><Link href="#find-barber">Find a Barber</Link></Button></div> :
             <div className="space-y-4">{activeAppointments.map(app => {
                  let isTooLateToCancel = false;
                  if (app.appointmentTimestamp && ['upcoming', 'customer-initiated-check-in', 'barber-initiated-check-in'].includes(app.status)) {
                    const diffInHours = (app.appointmentTimestamp.toDate().getTime() - new Date().getTime()) / (1000 * 60 * 60);
                    if (diffInHours < MIN_CANCELLATION_LEAD_TIME_HOURS) isTooLateToCancel = true;
                  }
                  return (
                  <Card key={app.id} className="shadow-md rounded-lg border overflow-hidden hover:shadow-lg transition-shadow">
                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-start">
                      <div className="md:col-span-2 space-y-1.5"><h3 className="text-base font-semibold text-primary flex items-center"><Scissors className="mr-2 h-5 w-5" />{app.serviceName}</h3><p className="text-sm text-gray-500 flex items-center"><UserCircle className="mr-2 h-4 w-4" />With: {app.barberName}</p><p className="text-xs text-muted-foreground capitalize">Status: {getStatusLabelForCustomer(app.status)}</p></div>
                      <div className="space-y-1 text-sm text-left md:text-right"><p className="font-medium flex items-center md:justify-end text-base"><CalendarDays className="mr-2 h-4 w-4" />{formatDate(app.date)}</p><p className="text-primary flex items-center md:justify-end"><Clock className="mr-2 h-4 w-4" />{app.startTime}</p></div>
                      <div className="md:col-span-3 flex flex-col sm:flex-row justify-end items-center pt-3 mt-3 border-t gap-2">
                          {!['cancelled', 'completed', 'no-show'].includes(app.status) && renderAppointmentActions(app)}
                          {['upcoming', 'customer-initiated-check-in', 'barber-initiated-check-in'].includes(app.status) && (isTooLateToCancel ? <Tooltip><TooltipTrigger asChild><span tabIndex={0}><Button variant="destructive" size="sm" className="rounded-full h-9 px-4 text-sm" disabled><XCircle className="mr-1.5 h-4 w-4" />Cancel</Button></span></TooltipTrigger><TooltipContent><p>Cannot cancel: Appt. within {MIN_CANCELLATION_LEAD_TIME_HOURS} hours.</p></TooltipContent></Tooltip> : <Button variant="destructive" size="sm" className="rounded-full h-9 px-4 text-sm" onClick={() => setAppointmentToCancel(app)} disabled={isCancelling || isUpdatingAppointment === app.id}>{isCancelling && appointmentToCancel?.id === app.id ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <XCircle className="mr-1.5 h-4 w-4" />}Cancel</Button>)}
                        </div></CardContent></Card>);})}</div>}
          </CardContent></Card>

        <Card className="border-none shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card"><CardTitle className="text-xl font-bold flex items-center"><History className="mr-2 h-5 w-5 text-primary"/>Appointment History</CardTitle><CardDescription className="text-sm text-gray-500 mt-1">View past appointments.</CardDescription></CardHeader>
          <CardContent className="p-4 md:p-6">
            {(isLoadingAppointments && !pastAppointments.length && !activeAppointments.length) ? <div className="flex items-center justify-center py-6"><LoadingSpinner className="h-8 w-8 text-primary" /><p className="ml-3 text-base">Loading history...</p></div> :
             pastAppointments.length === 0 ? <p className="text-base text-gray-500">No past appointments.</p> :
             <div className="space-y-4">{pastAppointments.map(app => (<Card key={app.id} className="shadow-md rounded-lg border opacity-80 hover:opacity-100 transition-opacity"><CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-start"><div className="md:col-span-2 space-y-1.5"><h3 className="text-base font-semibold text-muted-foreground flex items-center"><Scissors className="mr-2 h-5 w-5" />{app.serviceName}</h3><p className="text-sm text-gray-500 flex items-center"><UserCircle className="mr-2 h-4 w-4" />With: {app.barberName}</p><p className={cn("text-xs font-medium capitalize", app.status === 'completed' ? 'text-green-600' : (['cancelled', 'no-show'].includes(app.status) ? 'text-destructive' : 'text-muted-foreground'))}>Status: {getStatusLabelForCustomer(app.status)}</p></div><div className="space-y-1 text-sm text-left md:text-right"><p className="font-medium flex items-center md:justify-end text-base text-muted-foreground"><CalendarDays className="mr-2 h-4 w-4" />{formatDate(app.date)}</p><p className="text-muted-foreground flex items-center md:justify-end"><Clock className="mr-2 h-4 w-4" />{app.startTime}</p></div>{!['no-show', 'cancelled'].includes(app.status) && (<div className="md:col-span-3 flex flex-col sm:flex-row justify-end items-center pt-3 mt-3 border-t gap-2"><Button asChild variant="outline" size="sm" className="rounded-full h-9 px-4"><Link href={`/customer/book/${app.barberId}?serviceId=${app.serviceId}`}>Rebook</Link></Button></div>)}</CardContent></Card>))}</div>}
          </CardContent></Card>

        <Card id="find-barber" className="border-none shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card"><CardTitle className="text-xl font-bold">Explore Barbers</CardTitle><CardDescription className="text-sm text-gray-500 mt-1">Discover services by talented barbers.</CardDescription></CardHeader>
          <CardContent className="p-4 md:p-6">
            {(isLoadingBarbers && !availableBarbers.length) ? <div className="flex items-center justify-center py-6"><LoadingSpinner className="h-8 w-8 text-primary" /><p className="ml-3 text-base">Loading barbers...</p></div> :
             availableBarbers.length === 0 ? <div className="text-center py-6"><Search className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><p className="text-base text-gray-500">No barbers listed or accepting online bookings.</p></div> :
             <div className="space-y-4">{availableBarbers.map(barber => (<Card key={barber.uid} className="shadow-md rounded-lg border hover:shadow-lg transition-shadow"><CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"><div className="flex items-center gap-4 flex-grow"><UserCircle className="h-10 w-10 text-muted-foreground" /><div className="flex-grow"><div className="flex flex-col sm:flex-row sm:items-center gap-x-2 gap-y-0.5 mb-0.5"><h3 className="text-base font-semibold">{barber.firstName} {barber.lastName}</h3>
              {barber.isTemporarilyUnavailable ? <Badge variant="destructive" className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs py-0.5 px-2 whitespace-nowrap"><Hourglass className="mr-1 h-3 w-3" />Temporarily Busy</Badge> :
               barber.isAcceptingBookings ? <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white text-xs py-0.5 px-2 whitespace-nowrap"><CheckCircle className="mr-1 h-3 w-3" />Accepting Bookings</Badge> :
               <Badge variant="secondary" className="text-xs py-0.5 px-2 whitespace-nowrap"><CircleSlash className="mr-1 h-3 w-3" />Not Accepting Bookings</Badge>}</div><span className="text-xs text-muted-foreground ml-1">(Ratings disabled)</span>{barber.address && <p className="text-xs text-gray-500 truncate max-w-[150px] sm:max-w-full mt-0.5">{barber.address}</p>}</div></div><Button asChild variant="outline" size="sm" className="rounded-full h-10 px-4 text-sm sm:text-base w-full sm:w-auto mt-3 sm:mt-0"><Link href={`/customer/view-barber/${barber.uid}`}><Eye className="mr-2 h-4 w-4" />View Profile</Link></Button></CardContent></Card>))}</div>}
          </CardContent></Card>
      </div>
      {appointmentToCancel && (
        <AlertDialog open={!!appointmentToCancel} onOpenChange={(open) => !open && setAppointmentToCancel(null)}>
          <AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle className="text-xl font-bold">Confirm Cancellation</AlertDialogTitle><AlertDialogDescription className="text-base text-gray-500 pt-1">Cancel appointment for <span className="font-semibold">{appointmentToCancel.serviceName}</span> with <span className="font-semibold">{appointmentToCancel.barberName}</span> on <span className="font-semibold">{formatDate(appointmentToCancel.date)} at {appointmentToCancel.startTime}</span>? This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="mt-4"><AlertDialogCancel onClick={() => setAppointmentToCancel(null)} className="rounded-full h-10 px-4" disabled={isCancelling}>Keep</AlertDialogCancel><AlertDialogAction onClick={handleCancelAppointment} className="rounded-full h-10 px-4" variant="destructive" disabled={isCancelling}>{isCancelling ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}{isCancelling ? 'Cancelling...' : 'Yes, Cancel'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}
    </TooltipProvider></ProtectedPage>
  );
}
