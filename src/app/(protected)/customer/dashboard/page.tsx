/**
 * @fileoverview Customer Dashboard Page.
 * This is the main landing page for customers after they log in. It displays:
 * - Active upcoming appointments with actions like check-in, confirm start/completion, and cancel.
 * - A history of past appointments (completed, cancelled, no-show) with an option to rebook.
 * - A section to explore available barbers and view their profiles.
 * Data is fetched from Firestore and cached in local storage where appropriate.
 * Implements policies like cancellation lead time.
 */
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage'; // Ensures authenticated customer access.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Card UI component.
import { Button } from '@/components/ui/button'; // Button UI component.
import { useAuth } from '@/hooks/useAuth'; // Auth context hook.
import type { Appointment, AppUser, AppointmentStatus } from '@/types'; // Type definitions.
import { firestore } from '@/firebase/config'; // Firebase Firestore instance.
import { collection, query, where, getDocs, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore'; // Firestore methods.
import { useToast } from '@/hooks/use-toast'; // Toast notification hook.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.
import { CalendarDays, Clock, Scissors, Eye, XCircle, Search, UserCircle, Play, CheckSquare, LogIn, History, CheckCircle, CircleSlash, UserX, Hourglass } from 'lucide-react'; // Icons.
import Link from 'next/link'; // Next.js Link component.
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // Alert dialog for confirmations.
// Local storage utilities.
import { getItemWithTimestampRevival, setItemWithTimestampConversion, LS_MY_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD, getSimpleItem, setSimpleItem, LS_AVAILABLE_BARBERS_KEY_CUSTOMER_DASHBOARD } from '@/lib/localStorageUtils';
import { cn } from '@/lib/utils'; // Utility for conditional class names.
import { Badge } from '@/components/ui/badge'; // Badge UI component.
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Tooltip UI component.
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Alert UI component.

// Local storage key for past appointments on this specific dashboard.
const LS_PAST_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD = 'customer_dashboard_past_appointments';
// Minimum lead time (in hours) required for a customer to cancel an appointment.
const MIN_CANCELLATION_LEAD_TIME_HOURS = 2;

/**
 * Gets today's date as a YYYY-MM-DD string.
 * @returns {string} Today's date string.
 */
const getTodayDateString = () => new Date().toISOString().split('T')[0];

/**
 * Converts a time string (e.g., "09:00 AM") to total minutes from midnight.
 * @param {string} timeStr - The time string to convert.
 * @returns {number} Total minutes from midnight.
 */
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(' ')) return 0;
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (hours === 12) hours = modifier.toUpperCase() === 'AM' ? 0 : 12;
  else if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
  return hours * 60 + minutes;
};

/**
 * CustomerDashboardPage component.
 * Renders the main dashboard for customers.
 *
 * @returns {JSX.Element} The rendered customer dashboard page.
 */
export default function CustomerDashboardPage() {
  const { user } = useAuth(); // Current authenticated customer.
  const { toast } = useToast(); // For displaying notifications.

  // State for customer's active and past appointments.
  const [activeAppointments, setActiveAppointments] = useState<Appointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true); // True if appointments are being fetched.

  // State for available barbers list.
  const [availableBarbers, setAvailableBarbers] = useState<AppUser[]>([]);
  const [isLoadingBarbers, setIsLoadingBarbers] = useState(true); // True if barbers are being fetched.

  // State for today's date string and initial load completion.
  const [today, setToday] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // State for appointment cancellation confirmation.
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false); // True if cancellation is in progress.

  // State for tracking which appointment is currently being updated (e.g., check-in).
  const [isUpdatingAppointment, setIsUpdatingAppointment] = useState<string | null>(null);


  // Effect to set today's date and load initial data from local storage on component mount.
  useEffect(() => {
    setToday(getTodayDateString());
    if (typeof window !== 'undefined') { // Ensure localStorage is available.
        // Load cached active appointments.
        const cachedActive = getItemWithTimestampRevival<Appointment[]>(LS_MY_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD);
        if (cachedActive) setActiveAppointments(cachedActive);
        // Load cached past appointments.
        const cachedPast = getItemWithTimestampRevival<Appointment[]>(LS_PAST_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD);
        if (cachedPast) setPastAppointments(cachedPast);
        if (cachedActive || cachedPast) setIsLoadingAppointments(false); // Set loading based on cache hit.

        // Load cached available barbers.
        const cachedBarbers = getSimpleItem<AppUser[]>(LS_AVAILABLE_BARBERS_KEY_CUSTOMER_DASHBOARD);
        if (cachedBarbers) { setAvailableBarbers(cachedBarbers); setIsLoadingBarbers(false); }
        setInitialLoadComplete(true); // Mark initial load as complete.
    }
  }, []);

  /**
   * Fetches the customer's appointments (both active and past) from Firestore.
   * Updates local state and caches the fetched data.
   */
  const fetchMyAppointments = useCallback(async () => {
    if (!user?.uid || !today) return; // Ensure user is logged in and today's date is set.
    setIsLoadingAppointments(true);
    try {
      // Query appointments for the current customer, ordered by date and time (descending for overall list).
      const q = query(collection(firestore, 'appointments'), where('customerId', '==', user.uid), orderBy('date', 'desc'), orderBy('startTime', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedAppointments: Appointment[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));

      // Filter and sort appointments into active and past lists.
      const active = fetchedAppointments.filter(app => !['completed', 'cancelled', 'no-show'].includes(app.status))
                                     .sort((a, b) => a.date.localeCompare(b.date) || timeToMinutes(a.startTime) - timeToMinutes(b.startTime)); // Active sorted ascending.
      const past = fetchedAppointments.filter(app => ['completed', 'cancelled', 'no-show'].includes(app.status))
                                   .sort((a,b) => b.date.localeCompare(a.date) || timeToMinutes(b.startTime) - timeToMinutes(a.startTime)); // Past sorted descending.

      setActiveAppointments(active); setPastAppointments(past);
      // Update local storage caches.
      setItemWithTimestampConversion(LS_MY_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD, active);
      setItemWithTimestampConversion(LS_PAST_APPOINTMENTS_KEY_CUSTOMER_DASHBOARD, past);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({ title: "Error", description: "Could not fetch appointments.", variant: "destructive" });
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [user?.uid, toast, today]); // Dependencies for useCallback.

  /**
   * Handles actions on an appointment initiated by the customer (e.g., check-in, mark done).
   * Updates the appointment status in Firestore and refetches appointments.
   * @param {string} appointmentId - The ID of the appointment.
   * @param {'CUSTOMER_CHECK_IN' | 'CUSTOMER_CONFIRM_START' | 'CUSTOMER_MARK_DONE' | 'CUSTOMER_CONFIRM_COMPLETION'} action - The action to perform.
   */
  const handleAppointmentAction = async (appointmentId: string, action: 'CUSTOMER_CHECK_IN' | 'CUSTOMER_CONFIRM_START' | 'CUSTOMER_MARK_DONE' | 'CUSTOMER_CONFIRM_COMPLETION') => {
    if (!user?.uid) { toast({ title: "Error", description: "Must be logged in.", variant: "destructive" }); return; }
    setIsUpdatingAppointment(appointmentId); // Set loading state for this specific appointment.
    const appointmentRef = doc(firestore, 'appointments', appointmentId);
    const now = Timestamp.now(); // Current time for update timestamps.
    let updateData: Partial<Appointment> = { updatedAt: now }; // Data to update in Firestore.
    let newStatus: AppointmentStatus | undefined = undefined; // New status for the appointment.
    let successMessage = ""; // Success message for toast notification.

    try {
      // Find the current appointment from local state.
      const currentAppointment = [...activeAppointments, ...pastAppointments].find(app => app.id === appointmentId);
      if (!currentAppointment) throw new Error("Appointment not found.");

      // Determine update data and new status based on the action.
      switch (action) {
        case 'CUSTOMER_CHECK_IN': // Customer checks themselves in.
          updateData.customerCheckedInAt = now;
          // If barber also checked in, service starts. Otherwise, waits for barber confirmation.
          newStatus = currentAppointment.barberCheckedInAt ? 'in-progress' : 'customer-initiated-check-in';
          if (newStatus === 'in-progress') updateData.serviceActuallyStartedAt = now;
          successMessage = newStatus === 'in-progress' ? "Check-in confirmed, service started." : "You've checked in. Waiting for barber.";
          break;
        case 'CUSTOMER_CONFIRM_START': // Customer confirms start after barber initiates check-in.
          if (currentAppointment.status === 'barber-initiated-check-in') {
            updateData.customerCheckedInAt = now; updateData.serviceActuallyStartedAt = now; newStatus = 'in-progress';
            successMessage = "Arrival confirmed, service started.";
          } break;
        case 'CUSTOMER_MARK_DONE': // Customer marks service as done.
          updateData.customerMarkedDoneAt = now;
          // If barber also marked done, service completes. Otherwise, waits for barber confirmation.
          newStatus = currentAppointment.barberMarkedDoneAt ? 'completed' : 'customer-initiated-completion';
          if (newStatus === 'completed') updateData.serviceActuallyCompletedAt = now;
          successMessage = newStatus === 'completed' ? "Service mutually completed." : "Service marked done. Waiting for barber.";
          break;
        case 'CUSTOMER_CONFIRM_COMPLETION': // Customer confirms completion after barber marks done.
          if (currentAppointment.status === 'barber-initiated-completion') {
            updateData.customerMarkedDoneAt = now; updateData.serviceActuallyCompletedAt = now; newStatus = 'completed';
            successMessage = "Service mutually completed.";
          } break;
      }
      if (newStatus) updateData.status = newStatus; // Set new status if defined.
      await updateDoc(appointmentRef, updateData); // Update Firestore.
      toast({ title: "Success", description: successMessage || "Appointment updated." });
      fetchMyAppointments(); // Refetch appointments to update the UI.
    } catch (error: any) {
      console.error("Error updating appointment:", error);
      toast({ title: "Error", description: error.message || "Could not update appointment status.", variant: "destructive" });
    } finally {
      setIsUpdatingAppointment(null); // Clear loading state for this appointment.
    }
  };

  /**
   * Fetches a list of all barbers from Firestore.
   * Updates local state and caches the fetched data.
   */
  const fetchAvailableBarbers = useCallback(async () => {
    setIsLoadingBarbers(true);
    try {
      // Query all users with the role 'barber', ordered by first name.
      const q = query(collection(firestore, 'users'), where('role', '==', 'barber'), orderBy('firstName', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetchedBarbersData: AppUser[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Map Firestore data to AppUser type, defaulting booking/temporary status if undefined.
        return {
          uid: doc.id, ...data,
          isAcceptingBookings: data.isAcceptingBookings !== undefined ? data.isAcceptingBookings : true,
          isTemporarilyUnavailable: data.isTemporarilyUnavailable || false,
        } as AppUser;
      });
      setAvailableBarbers(fetchedBarbersData);
      setSimpleItem(LS_AVAILABLE_BARBERS_KEY_CUSTOMER_DASHBOARD, fetchedBarbersData); // Cache results.
    } catch (error) {
      console.error("Error fetching barbers:", error);
      toast({ title: "Error", description: "Could not fetch barbers.", variant: "destructive" });
    } finally {
      setIsLoadingBarbers(false);
    }
  }, [toast]); // Dependency for useCallback.

  // Effect to fetch initial data when component is ready and dependencies are met.
  useEffect(() => {
    if (initialLoadComplete) {
        if (user?.uid && today) fetchMyAppointments();
        fetchAvailableBarbers();
    }
  }, [user?.uid, fetchMyAppointments, fetchAvailableBarbers, today, initialLoadComplete]);

  /**
   * Formats a date string (YYYY-MM-DD) for display.
   * @param {string} dateString - The date string to format.
   * @returns {string} The formatted date string (e.g., "Monday, January 1").
   */
  const formatDate = (dateString: string) => new Date(dateString + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  /**
   * Handles the cancellation of an appointment after confirmation.
   * Updates the appointment status to 'cancelled' in Firestore and refetches appointments.
   */
  const handleCancelAppointment = async () => {
    if (!appointmentToCancel || !user?.uid) return; // Ensure an appointment is selected for cancellation.
    setIsCancelling(true);
    try {
      // Update appointment status to 'cancelled'.
      await updateDoc(doc(firestore, 'appointments', appointmentToCancel.id), { status: 'cancelled', updatedAt: Timestamp.now() });
      fetchMyAppointments(); // Refetch appointments to update UI.
      toast({ title: "Appointment Cancelled", description: "Appointment successfully cancelled." });
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast({ title: "Error", description: "Could not cancel appointment.", variant: "destructive" });
    } finally {
      setIsCancelling(false); setAppointmentToCancel(null); // Clear cancellation state.
    }
  };

  /**
   * Renders action buttons for an active appointment based on its status.
   * @param {Appointment} appointment - The appointment to render actions for.
   * @returns {JSX.Element | null} The action buttons or null.
   */
  const renderAppointmentActions = (appointment: Appointment) => {
    const isProcessingThis = isUpdatingAppointment === appointment.id; // True if this appointment is currently being updated.
    switch (appointment.status) {
      case 'upcoming': return (<Button onClick={() => handleAppointmentAction(appointment.id, 'CUSTOMER_CHECK_IN')} size="sm" className="rounded-full h-9 px-4" disabled={isProcessingThis}>{isProcessingThis ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <LogIn className="mr-1.5 h-4 w-4" />}I'm Here (Check-In)</Button>);
      case 'barber-initiated-check-in': return (<Button onClick={() => handleAppointmentAction(appointment.id, 'CUSTOMER_CONFIRM_START')} size="sm" className="rounded-full h-9 px-4" disabled={isProcessingThis}>{isProcessingThis ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}Confirm Arrival &amp; Start</Button>);
      case 'customer-initiated-check-in': return <p className="text-sm text-muted-foreground text-right">Waiting for barber...</p>; // No action for customer.
      case 'in-progress': return (<Button onClick={() => handleAppointmentAction(appointment.id, 'CUSTOMER_MARK_DONE')} size="sm" className="rounded-full h-9 px-4" disabled={isProcessingThis}>{isProcessingThis ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <CheckSquare className="mr-1.5 h-4 w-4" />}Mark Service Done</Button>);
      case 'barber-initiated-completion': return (<Button onClick={() => handleAppointmentAction(appointment.id, 'CUSTOMER_CONFIRM_COMPLETION')} size="sm" className="rounded-full h-9 px-4" disabled={isProcessingThis}>{isProcessingThis ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <CheckSquare className="mr-1.5 h-4 w-4" />}Confirm Service Done</Button>);
      case 'customer-initiated-completion': return <p className="text-sm text-muted-foreground text-right">Waiting for barber completion...</p>; // No action for customer.
      default: return null; // No actions for other statuses (completed, cancelled, no-show).
    }
  };

  /**
   * Gets a user-friendly label for an appointment status.
   * @param {AppointmentStatus} status - The appointment status.
   * @returns {string} The display label for the status.
   */
  const getStatusLabelForCustomer = (status: AppointmentStatus) => {
    const map: Record<AppointmentStatus, string> = {
        'upcoming': 'Upcoming', 'customer-initiated-check-in': 'Awaiting Barber', 'barber-initiated-check-in': 'Barber Noted Arrival',
        'in-progress': 'In Progress', 'customer-initiated-completion': 'Awaiting Barber Completion', 'barber-initiated-completion': 'Barber Marked Done',
        'completed': 'Completed', 'cancelled': 'Cancelled', 'no-show': 'Missed (No-Show)'
    };
    return map[status] || status; // Default to the status string if no mapping exists.
  };

  return (
    // ProtectedPage ensures only authenticated customers can access this page.
    // TooltipProvider enables tooltips within this page.
    <ProtectedPage expectedRole="customer">
    <TooltipProvider>
      <div className="space-y-8">
        <h1 className="text-2xl font-bold font-headline">Welcome, {user?.firstName || 'Customer'}!</h1>

        {/* Section for Active Appointments */}
        <Card className="border-none shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card"><CardTitle className="text-xl font-bold">Active Appointments</CardTitle><CardDescription className="text-sm text-gray-500 mt-1">Manage check-ins and completions.</CardDescription></CardHeader>
          <CardContent className="p-4 md:p-6">
            {(isLoadingAppointments && !activeAppointments.length && !pastAppointments.length) ? <div className="flex items-center justify-center py-6"><LoadingSpinner className="h-8 w-8 text-primary" /><p className="ml-3 text-base">Loading appointments...</p></div> :
             activeAppointments.length === 0 ? <div className="text-center py-6 space-y-3"><CalendarDays className="mx-auto h-12 w-12 text-muted-foreground" /><p className="text-base text-gray-500">No active appointments.</p><p className="text-base text-gray-500">Ready to book?</p><Button asChild className="rounded-full h-12 px-6 text-base !mt-5"><Link href="#find-barber">Find a Barber</Link></Button></div> :
             <div className="space-y-4">{activeAppointments.map(app => {
                  // Determine if it's too late to cancel based on MIN_CANCELLATION_LEAD_TIME_HOURS.
                  let isTooLateToCancel = false;
                  if (app.appointmentTimestamp && ['upcoming', 'customer-initiated-check-in', 'barber-initiated-check-in'].includes(app.status)) {
                    const diffInHours = (app.appointmentTimestamp.toDate().getTime() - new Date().getTime()) / (1000 * 60 * 60);
                    if (diffInHours < MIN_CANCELLATION_LEAD_TIME_HOURS) isTooLateToCancel = true;
                  }
                  return (
                  <Card key={app.id} className="shadow-md rounded-lg border overflow-hidden hover:shadow-lg transition-shadow">
                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-start">
                      {/* Appointment Details */}
                      <div className="md:col-span-2 space-y-1.5"><h3 className="text-base font-semibold text-primary flex items-center"><Scissors className="mr-2 h-5 w-5" />{app.serviceName}</h3><p className="text-sm text-gray-500 flex items-center"><UserCircle className="mr-2 h-4 w-4" />With: {app.barberName}</p><p className="text-xs text-muted-foreground capitalize">Status: {getStatusLabelForCustomer(app.status)}</p></div>
                      {/* Date and Time */}
                      <div className="space-y-1 text-sm text-left md:text-right"><p className="font-medium flex items-center md:justify-end text-base"><CalendarDays className="mr-2 h-4 w-4" />{formatDate(app.date)}</p><p className="text-primary flex items-center md:justify-end"><Clock className="mr-2 h-4 w-4" />{app.startTime}</p></div>
                      {/* Action Buttons */}
                      <div className="md:col-span-3 flex flex-col sm:flex-row justify-end items-center pt-3 mt-3 border-t gap-2">
                          {!['cancelled', 'completed', 'no-show'].includes(app.status) && renderAppointmentActions(app)}
                          {/* Cancellation Button with Tooltip if disabled */}
                          {['upcoming', 'customer-initiated-check-in', 'barber-initiated-check-in'].includes(app.status) && (isTooLateToCancel ? <Tooltip><TooltipTrigger asChild><span tabIndex={0}><Button variant="destructive" size="sm" className="rounded-full h-9 px-4 text-sm" disabled><XCircle className="mr-1.5 h-4 w-4" />Cancel</Button></span></TooltipTrigger><TooltipContent><p>Cannot cancel: Appt. within {MIN_CANCELLATION_LEAD_TIME_HOURS} hours.</p></TooltipContent></Tooltip> : <Button variant="destructive" size="sm" className="rounded-full h-9 px-4 text-sm" onClick={() => setAppointmentToCancel(app)} disabled={isCancelling || isUpdatingAppointment === app.id}>{isCancelling && appointmentToCancel?.id === app.id ? <LoadingSpinner className="mr-1.5 h-4 w-4" /> : <XCircle className="mr-1.5 h-4 w-4" />}Cancel</Button>)}
                        </div></CardContent></Card>);})}</div>}
          </CardContent></Card>

        {/* Section for Appointment History */}
        <Card className="border-none shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card"><CardTitle className="text-xl font-bold flex items-center"><History className="mr-2 h-5 w-5 text-primary"/>Appointment History</CardTitle><CardDescription className="text-sm text-gray-500 mt-1">View past appointments.</CardDescription></CardHeader>
          <CardContent className="p-4 md:p-6">
            {(isLoadingAppointments && !pastAppointments.length && !activeAppointments.length) ? <div className="flex items-center justify-center py-6"><LoadingSpinner className="h-8 w-8 text-primary" /><p className="ml-3 text-base">Loading history...</p></div> :
             pastAppointments.length === 0 ? <p className="text-base text-gray-500">No past appointments.</p> :
             <div className="space-y-4">{pastAppointments.map(app => (<Card key={app.id} className="shadow-md rounded-lg border opacity-80 hover:opacity-100 transition-opacity"><CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-start"><div className="md:col-span-2 space-y-1.5"><h3 className="text-base font-semibold text-muted-foreground flex items-center"><Scissors className="mr-2 h-5 w-5" />{app.serviceName}</h3><p className="text-sm text-gray-500 flex items-center"><UserCircle className="mr-2 h-4 w-4" />With: {app.barberName}</p><p className={cn("text-xs font-medium capitalize", app.status === 'completed' ? 'text-green-600' : (['cancelled', 'no-show'].includes(app.status) ? 'text-destructive' : 'text-muted-foreground'))}>Status: {getStatusLabelForCustomer(app.status)}</p></div><div className="space-y-1 text-sm text-left md:text-right"><p className="font-medium flex items-center md:justify-end text-base text-muted-foreground"><CalendarDays className="mr-2 h-4 w-4" />{formatDate(app.date)}</p><p className="text-muted-foreground flex items-center md:justify-end"><Clock className="mr-2 h-4 w-4" />{app.startTime}</p></div>{!['no-show', 'cancelled'].includes(app.status) && (<div className="md:col-span-3 flex flex-col sm:flex-row justify-end items-center pt-3 mt-3 border-t gap-2"><Button asChild variant="outline" size="sm" className="rounded-full h-9 px-4"><Link href={`/customer/book/${app.barberId}?serviceId=${app.serviceId}`}>Rebook</Link></Button></div>)}</CardContent></Card>))}</div>}
          </CardContent></Card>

        {/* Section to Explore Barbers */}
        <Card id="find-barber" className="border-none shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card"><CardTitle className="text-xl font-bold">Explore Barbers</CardTitle><CardDescription className="text-sm text-gray-500 mt-1">Discover services by talented barbers.</CardDescription></CardHeader>
          <CardContent className="p-4 md:p-6">
            {(isLoadingBarbers && !availableBarbers.length) ? <div className="flex items-center justify-center py-6"><LoadingSpinner className="h-8 w-8 text-primary" /><p className="ml-3 text-base">Loading barbers...</p></div> :
             availableBarbers.length === 0 ? <div className="text-center py-6"><Search className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><p className="text-base text-gray-500">No barbers listed or accepting online bookings.</p></div> :
             <div className="space-y-4">{availableBarbers.map(barber => (<Card key={barber.uid} className="shadow-md rounded-lg border hover:shadow-lg transition-shadow"><CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"><div className="flex items-center gap-4 flex-grow"><UserCircle className="h-10 w-10 text-muted-foreground" /><div className="flex-grow"><div className="flex flex-col sm:flex-row sm:items-center gap-x-2 gap-y-0.5 mb-0.5"><h3 className="text-base font-semibold">{barber.firstName} {barber.lastName}</h3>
              {/* Display barber's availability status using Badges */}
              {barber.isTemporarilyUnavailable ? <Badge variant="destructive" className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs py-0.5 px-2 whitespace-nowrap"><Hourglass className="mr-1 h-3 w-3" />Temporarily Busy</Badge> :
               barber.isAcceptingBookings ? <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white text-xs py-0.5 px-2 whitespace-nowrap"><CheckCircle className="mr-1 h-3 w-3" />Accepting Bookings</Badge> :
               <Badge variant="secondary" className="text-xs py-0.5 px-2 whitespace-nowrap"><CircleSlash className="mr-1 h-3 w-3" />Not Accepting Bookings</Badge>}</div><span className="text-xs text-muted-foreground ml-1">(Ratings disabled)</span>{barber.address && <p className="text-xs text-gray-500 truncate max-w-[150px] sm:max-w-full mt-0.5">{barber.address}</p>}</div></div><Button asChild variant="outline" size="sm" className="rounded-full h-10 px-4 text-sm sm:text-base w-full sm:w-auto mt-3 sm:mt-0"><Link href={`/customer/view-barber/${barber.uid}`}><Eye className="mr-2 h-4 w-4" />View Profile</Link></Button></CardContent></Card>))}</div>}
          </CardContent></Card>
      </div>
      {/* AlertDialog for confirming appointment cancellation */}
      {appointmentToCancel && (
        <AlertDialog open={!!appointmentToCancel} onOpenChange={(open) => !open && setAppointmentToCancel(null)}>
          <AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle className="text-xl font-bold">Confirm Cancellation</AlertDialogTitle><AlertDialogDescription className="text-base text-gray-500 pt-1">Cancel appointment for <span className="font-semibold">{appointmentToCancel.serviceName}</span> with <span className="font-semibold">{appointmentToCancel.barberName}</span> on <span className="font-semibold">{formatDate(appointmentToCancel.date)} at {appointmentToCancel.startTime}</span>? This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="mt-4"><AlertDialogCancel onClick={() => setAppointmentToCancel(null)} className="rounded-full h-10 px-4" disabled={isCancelling}>Keep</AlertDialogCancel><AlertDialogAction onClick={handleCancelAppointment} className="rounded-full h-10 px-4" variant="destructive" disabled={isCancelling}>{isCancelling ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}{isCancelling ? 'Cancelling...' : 'Yes, Cancel'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}
    </TooltipProvider></ProtectedPage>
  );
}
