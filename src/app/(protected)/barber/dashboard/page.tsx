/**
 * @fileoverview Barber Dashboard Page.
 * This is the main landing page for barbers after they log in. It provides an overview of:
 * - Today's appointments and actions to manage them (check-in, mark done, no-show).
 * - Ability to add walk-in appointments.
 * - Toggles for managing online booking acceptance and temporary unavailability.
 * - Prompts to add services if none exist.
 * Data is fetched from Firestore and cached in local storage where appropriate.
 */
'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic'; // For dynamically importing components (code splitting).
import ProtectedPage from '@/components/layout/ProtectedPage'; // Ensures authenticated barber access.
import { useAuth } from '@/hooks/useAuth'; // Auth context hook.
import type { BarberService, Appointment, DayOfWeek, BarberScheduleDoc, UnavailableDate, AppointmentStatus, AppUser } from '@/types'; // Type definitions.
import TodaysAppointmentsSection from '@/components/barber/TodaysAppointmentsSection'; // Component for today's appointments.
import { firestore } from '@/firebase/config'; // Firebase Firestore instance.
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  Timestamp,
  orderBy,
  writeBatch, // For atomic multi-document updates.
} from 'firebase/firestore'; // Firestore methods.
import { useToast } from '@/hooks/use-toast'; // Toast notification hook.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.
import { Button } from '@/components/ui/button'; // Button UI component.
import { PlusCircle, Settings2, AlertTriangle, Info, Briefcase, Hourglass } from 'lucide-react'; // Icons.
import { Switch } from '@/components/ui/switch'; // Switch UI component.
import { Label } from '@/components/ui/label'; // Label UI component.
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; // Card UI component.
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Tooltip UI component.
// Local storage utilities with Timestamp conversion.
import { getItemWithTimestampRevival, setItemWithTimestampConversion, LS_SERVICES_KEY_DASHBOARD, LS_APPOINTMENTS_KEY_DASHBOARD } from '@/lib/localStorageUtils';
import type { DayAvailability as ScheduleDayAvailability } from '@/types'; // Specific type alias.
import { getDoc as getFirestoreDoc } from 'firebase/firestore'; // Specific Firestore method import.
import Link from 'next/link'; // Next.js Link component.
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Alert UI component.
import { formatDistanceToNowStrict } from 'date-fns'; // Date formatting utility.

// Dynamically import WalkInDialog to improve initial page load time.
// Shows a loading spinner while the dialog component is being loaded.
const WalkInDialog = dynamic(() => import('@/components/barber/WalkInDialog'), {
  loading: () => <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[100]"><LoadingSpinner className="h-8 w-8 text-primary" /></div>,
  ssr: false // This component is client-side only.
});

/**
 * Formats a Date object into a YYYY-MM-DD string.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Converts a time string (e.g., "09:00 AM") to total minutes from midnight.
 * @param {string} timeStr - The time string to convert.
 * @returns {number} Total minutes from midnight.
 */
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(' ')) return 0;
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (hours === 12) {
    hours = modifier.toUpperCase() === 'AM' ? 0 : 12;
  } else if (modifier.toUpperCase() === 'PM' && hours < 12) {
    hours += 12;
  }
  return hours * 60 + minutes;
};

/**
 * Converts total minutes from midnight to a time string (e.g., "09:00 AM").
 * @param {number} totalMinutes - Total minutes from midnight.
 * @returns {string} The formatted time string.
 */
const minutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const period = h < 12 || h === 24 ? 'AM' : 'PM';
  return `${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

// Initial default schedule used for walk-in availability checks if no schedule is fetched.
const INITIAL_SCHEDULE_FOR_WALKIN_CHECK: ScheduleDayAvailability[] = (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as DayOfWeek[]).map(day => ({
  day,
  isOpen: !['Saturday', 'Sunday'].includes(day), // Default to closed on weekends.
  startTime: '09:00 AM',
  endTime: '05:00 PM',
}));

/**
 * BarberDashboardPage component.
 * Renders the main dashboard for barbers.
 *
 * @returns {JSX.Element} The rendered barber dashboard page.
 */
export default function BarberDashboardPage() {
  // Auth context for user data and auth actions.
  const { user, updateUserAcceptingBookings, updateBarberTemporaryStatus, setIsProcessingAuth } = useAuth();
  const { toast } = useToast(); // For displaying notifications.

  // State for barber's services, appointments, and schedule/availability data for walk-ins.
  const [services, setServices] = useState<BarberService[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barberScheduleForWalkin, setBarberScheduleForWalkin] = useState<ScheduleDayAvailability[]>(INITIAL_SCHEDULE_FOR_WALKIN_CHECK);
  const [barberUnavailableDatesForWalkin, setBarberUnavailableDatesForWalkin] = useState<UnavailableDate[]>([]);

  // Loading states for various data fetching operations.
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [isUpdatingAppointment, setIsUpdatingAppointment] = useState<string | null>(null); // Tracks ID of appointment being updated.
  const [isWalkInDialogOpen, setIsWalkInDialogOpen] = useState(false); // Controls visibility of walk-in dialog.
  const [isProcessingWalkIn, setIsProcessingWalkIn] = useState(false); // True if walk-in submission is in progress.
  const [isLoadingBarberSelfData, setIsLoadingBarberSelfData] = useState(true); // Loading barber's own schedule for walk-in.

  // State for barber's booking acceptance status.
  const [localIsAcceptingBookings, setLocalIsAcceptingBookings] = useState(true);
  const [isUpdatingAcceptingBookings, setIsUpdatingAcceptingBookings] = useState(false);

  // State for barber's temporary unavailability status.
  const [localIsTemporarilyUnavailable, setLocalIsTemporarilyUnavailable] = useState(false);
  const [isUpdatingTemporaryStatus, setIsUpdatingTemporaryStatus] = useState(false);
  const [unavailableSinceDuration, setUnavailableSinceDuration] = useState<string | null>(null); // Formatted duration of unavailability.

  // Tracks if the initial component mount and setup has completed.
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Effect to mark initial load as complete.
  useEffect(() => {
    setInitialLoadComplete(true);
  }, []);

  // Effect to update local booking/temporary status based on user data from AuthContext.
  // Also calculates and updates the duration of temporary unavailability.
  useEffect(() => {
    if (user) {
      // Set local state based on user object, defaulting isAcceptingBookings to true if undefined.
      setLocalIsAcceptingBookings(user.isAcceptingBookings !== undefined ? user.isAcceptingBookings : true);
      setLocalIsTemporarilyUnavailable(user.isTemporarilyUnavailable || false);

      // If temporarily unavailable and timestamp exists, calculate and display duration.
      if (user.isTemporarilyUnavailable && user.unavailableSince) {
        const calculateDuration = () => {
          // Formats the duration (e.g., "2 hours ago").
          setUnavailableSinceDuration(formatDistanceToNowStrict(user.unavailableSince!.toDate(), { addSuffix: true }));
        };
        calculateDuration(); // Initial calculation.
        const intervalId = setInterval(calculateDuration, 60000); // Update every minute.
        return () => clearInterval(intervalId); // Cleanup interval on unmount or user change.
      } else {
        setUnavailableSinceDuration(null); // Clear duration if not unavailable.
      }
    }
  }, [user]); // Rerun when user object changes.

  // Effect to load data from local storage on initial load, if available.
  useEffect(() => {
    if (initialLoadComplete) {
      // Load cached services.
      const cachedServices = getItemWithTimestampRevival<BarberService[]>(LS_SERVICES_KEY_DASHBOARD);
      if (cachedServices) setServices(cachedServices);
      setIsLoadingServices(!cachedServices); // Set loading based on cache hit.

      // Load cached appointments.
      const cachedAppointments = getItemWithTimestampRevival<Appointment[]>(LS_APPOINTMENTS_KEY_DASHBOARD);
      if (cachedAppointments) setAppointments(cachedAppointments);
      setIsLoadingAppointments(!cachedAppointments); // Set loading based on cache hit.
    }
  }, [initialLoadComplete]);

  /**
   * Fetches the barber's services from Firestore.
   */
  const fetchServices = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingServices(true);
    try {
      const servicesCollection = collection(firestore, 'services');
      const q = query(servicesCollection, where('barberId', '==', user.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedServices: BarberService[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BarberService));
      setServices(fetchedServices);
      setItemWithTimestampConversion(LS_SERVICES_KEY_DASHBOARD, fetchedServices); // Cache results.
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({ title: "Error", description: "Could not fetch services for Walk-In.", variant: "destructive" });
    } finally {
      setIsLoadingServices(false);
    }
  }, [user?.uid, toast]);

  /**
   * Fetches all appointments for the barber from Firestore.
   */
  const fetchAppointments = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingAppointments(true);
    try {
      const appointmentsCollection = collection(firestore, 'appointments');
      // Query appointments for the current barber, ordered by date and start time.
      const q = query(appointmentsCollection, where('barberId', '==', user.uid), orderBy('date', 'asc'), orderBy('startTime'));
      const querySnapshot = await getDocs(q);
      const fetchedAppointments: Appointment[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(fetchedAppointments);
      setItemWithTimestampConversion(LS_APPOINTMENTS_KEY_DASHBOARD, fetchedAppointments); // Cache results.
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({ title: "Error", description: "Could not fetch appointments.", variant: "destructive" });
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [user?.uid, toast]);

  /**
   * Handles actions on an appointment (e.g., check-in, mark done, no-show).
   * Updates the appointment status in Firestore and local state.
   * @param {string} appointmentId - The ID of the appointment.
   * @param {'BARBER_CHECK_IN' | 'BARBER_CONFIRM_START' | 'BARBER_MARK_DONE' | 'BARBER_CONFIRM_COMPLETION' | 'BARBER_MARK_NO_SHOW'} action - The action to perform.
   */
  const handleAppointmentAction = async (appointmentId: string, action: 'BARBER_CHECK_IN' | 'BARBER_CONFIRM_START' | 'BARBER_MARK_DONE' | 'BARBER_CONFIRM_COMPLETION' | 'BARBER_MARK_NO_SHOW') => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsUpdatingAppointment(appointmentId); // Set loading state for this specific appointment.
    const appointmentRef = doc(firestore, 'appointments', appointmentId);
    const now = Timestamp.now(); // Current time for update timestamps.
    let updateData: Partial<Appointment> = { updatedAt: now }; // Data to update in Firestore.
    let newStatus: AppointmentStatus | undefined = undefined; // New status for the appointment.
    let successMessage = ""; // Success message for toast notification.

    try {
      const currentAppointment = appointments.find(app => app.id === appointmentId);
      if (!currentAppointment) throw new Error("Appointment not found.");

      // Determine update data and new status based on the action.
      switch (action) {
        case 'BARBER_CHECK_IN': // Barber records customer arrival.
          updateData.barberCheckedInAt = now;
          // If customer also checked in, service starts. Otherwise, waits for customer confirmation.
          newStatus = currentAppointment.customerCheckedInAt ? 'in-progress' : 'barber-initiated-check-in';
          if (newStatus === 'in-progress') updateData.serviceActuallyStartedAt = now;
          successMessage = newStatus === 'in-progress' ? "Service started." : "Customer arrival recorded.";
          break;
        case 'BARBER_CONFIRM_START': // Barber confirms start after customer check-in, or for walk-in.
          if (currentAppointment.status === 'customer-initiated-check-in' || (currentAppointment.customerId === null && currentAppointment.status === 'barber-initiated-check-in')) {
            updateData.barberCheckedInAt = now; updateData.serviceActuallyStartedAt = now; newStatus = 'in-progress';
            successMessage = "Service started.";
          }
          break;
        case 'BARBER_MARK_DONE': // Barber marks service as done.
          updateData.barberMarkedDoneAt = now;
          // If customer also marked done (or it's a walk-in), service completes. Otherwise, waits for customer confirmation.
          newStatus = (currentAppointment.customerMarkedDoneAt || currentAppointment.customerId === null) ? 'completed' : 'barber-initiated-completion';
          if (newStatus === 'completed') updateData.serviceActuallyCompletedAt = now;
          successMessage = newStatus === 'completed' ? "Service completed." : "Service marked done by you.";
          break;
        case 'BARBER_CONFIRM_COMPLETION': // Barber confirms completion after customer marks done.
          if (currentAppointment.status === 'customer-initiated-completion') {
            updateData.barberMarkedDoneAt = now; updateData.serviceActuallyCompletedAt = now; newStatus = 'completed';
            successMessage = "Service mutually completed.";
          }
          break;
        case 'BARBER_MARK_NO_SHOW': // Barber marks customer as a no-show.
          newStatus = 'no-show'; updateData.noShowMarkedAt = now;
          successMessage = "Appointment marked as No-Show.";
          break;
      }
      if (newStatus) updateData.status = newStatus; // Set new status if defined.
      await updateDoc(appointmentRef, updateData); // Update Firestore.

      // Update local state optimistically.
      setAppointments(prev => {
        const updatedList = prev.map(app => app.id === appointmentId ? { ...app, ...updateData, status: newStatus || app.status } : app);
        setItemWithTimestampConversion(LS_APPOINTMENTS_KEY_DASHBOARD, updatedList); // Update cache.
        return updatedList;
      });
      toast({ title: "Success", description: successMessage || `Appointment updated.` });
    } catch (error: any) {
      console.error("Error updating appointment:", error);
      toast({ title: "Error", description: error.message || "Could not update appointment status.", variant: "destructive" });
    } finally {
      setIsUpdatingAppointment(null); // Clear loading state for this appointment.
    }
  };

  /**
   * Fetches the barber's own schedule and unavailable dates for walk-in validation.
   */
  const fetchBarberSelfDataForWalkIn = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingBarberSelfData(true);
    try {
      // Fetch barber's regular work schedule.
      const scheduleDocRef = doc(firestore, 'barberSchedules', user.uid);
      const scheduleSnap = await getFirestoreDoc(scheduleDocRef);
      setBarberScheduleForWalkin(scheduleSnap.exists() ? (scheduleSnap.data() as BarberScheduleDoc).schedule : INITIAL_SCHEDULE_FOR_WALKIN_CHECK);

      // Fetch barber's specific unavailable dates.
      const unavailableDatesColRef = collection(firestore, `barberSchedules/${user.uid}/unavailableDates`);
      const unavailableDatesSnapshot = await getDocs(query(unavailableDatesColRef));
      setBarberUnavailableDatesForWalkin(unavailableDatesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as UnavailableDate)));
    } catch (error) {
      console.error("Error fetching barber's data for walk-in:", error);
      toast({ title: "Error", description: "Could not load barber's availability for walk-in.", variant: "destructive" });
    } finally {
      setIsLoadingBarberSelfData(false);
    }
  }, [user?.uid, toast]);

  /**
   * Handles saving a walk-in appointment.
   * Validates availability and finds the earliest possible slot for the walk-in.
   * @param {string} serviceId - The ID of the selected service.
   * @param {string} customerName - The name of the walk-in customer.
   */
  const handleSaveWalkIn = async (serviceId: string, customerName: string) => {
    if (!user || !user.uid || !user.firstName || !user.lastName) {
      toast({ title: "Error", description: "User info incomplete.", variant: "destructive" }); return;
    }
    if (isLoadingBarberSelfData) {
      toast({ title: "Please Wait", description: "Loading availability for validation." }); return;
    }
    setIsProcessingWalkIn(true);
    const selectedService = services.find(s => s.id === serviceId);
    if (!selectedService) {
      toast({ title: "Error", description: "Service not found.", variant: "destructive" });
      setIsProcessingWalkIn(false); return;
    }

    // Validate if barber is open and not marked unavailable today.
    const todayDateStr = formatDateToYYYYMMDD(new Date());
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' }) as DayOfWeek;
    const daySchedule = barberScheduleForWalkin.find(d => d.day === dayOfWeek);

    if (!daySchedule || !daySchedule.isOpen) {
      toast({ title: "Barber Closed", description: "Cannot add walk-in. Barber closed today.", variant: "destructive" });
      setIsProcessingWalkIn(false); return;
    }
    if (barberUnavailableDatesForWalkin.some(ud => ud.date === todayDateStr)) {
        toast({ title: "Barber Unavailable", description: "Cannot add walk-in. Barber unavailable today.", variant: "destructive" });
        setIsProcessingWalkIn(false); return;
    }

    // Find the earliest available slot for the walk-in.
    const serviceDuration = selectedService.duration;
    const scheduleStartTimeMinutes = timeToMinutes(daySchedule.startTime);
    const scheduleEndTimeMinutes = timeToMinutes(daySchedule.endTime);
    const now = new Date();
    const nowTimestamp = Timestamp.fromDate(now);
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    const earliestPossibleStartMinutes = Math.max(scheduleStartTimeMinutes, currentTimeMinutes + 5); // Add 5 min buffer.

    // Get today's non-cancelled/completed appointments to check for conflicts.
    const todaysAppointmentsForSlotFinding = appointments
      .filter(app => app.date === todayDateStr && !['cancelled', 'completed', 'no-show'].includes(app.status))
      .map(app => ({ start: timeToMinutes(app.startTime), end: timeToMinutes(app.endTime) }))
      .sort((a, b) => a.start - b.start);

    // Algorithm to find an open slot.
    let foundSlotStartMinutes: number | null = null;
    // Try slots at 15-minute intervals.
    for (let potentialStart = earliestPossibleStartMinutes; potentialStart + serviceDuration <= scheduleEndTimeMinutes; potentialStart += 15) {
        const potentialEnd = potentialStart + serviceDuration;
        // Check if the potential slot overlaps with any existing appointments.
        if (!todaysAppointmentsForSlotFinding.some(bs => potentialStart < bs.end && potentialEnd > bs.start)) {
            foundSlotStartMinutes = potentialStart; break; // Found a free slot.
        }
    }
    // If no slot found by iterating, try to place it after the last known appointment.
    if (foundSlotStartMinutes === null) {
      const lastApptEnd = todaysAppointmentsForSlotFinding.length > 0 ? todaysAppointmentsForSlotFinding[todaysAppointmentsForSlotFinding.length - 1].end : scheduleStartTimeMinutes;
      const potentialStartAfterLast = Math.max(earliestPossibleStartMinutes, lastApptEnd);
      if (potentialStartAfterLast + serviceDuration <= scheduleEndTimeMinutes &&
          !todaysAppointmentsForSlotFinding.some(bs => potentialStartAfterLast < bs.end && (potentialStartAfterLast + serviceDuration) > bs.start)) {
          foundSlotStartMinutes = potentialStartAfterLast;
      }
    }

    if (foundSlotStartMinutes === null) { // No slot available.
      toast({ title: "No Slot Available", description: "Could not find an immediate slot.", variant: "destructive" });
      setIsProcessingWalkIn(false); return;
    }

    // Prepare appointment data.
    const appointmentStartTime = minutesToTime(foundSlotStartMinutes);
    const appointmentEndTime = minutesToTime(foundSlotStartMinutes + serviceDuration);
    const finalJsDateForWalkin = new Date(todayDateStr + "T00:00:00"); // Ensure correct date part.
    finalJsDateForWalkin.setHours(Math.floor(foundSlotStartMinutes / 60), foundSlotStartMinutes % 60, 0, 0);
    const appointmentTimestampValue = Timestamp.fromDate(finalJsDateForWalkin);

    try {
      // Create new walk-in appointment, defaulting to 'in-progress'.
      const newAppointmentData: Omit<Appointment, 'id'> = {
        barberId: user.uid, barberName: `${user.firstName} ${user.lastName}`, customerId: null, // Walk-ins have null customerId.
        customerName, serviceId: selectedService.id, serviceName: selectedService.name, price: selectedService.price,
        date: todayDateStr, startTime: appointmentStartTime, endTime: appointmentEndTime,
        appointmentTimestamp: appointmentTimestampValue, status: 'in-progress', createdAt: nowTimestamp, updatedAt: nowTimestamp,
        barberCheckedInAt: nowTimestamp, customerCheckedInAt: nowTimestamp, serviceActuallyStartedAt: nowTimestamp, // Walk-ins start immediately.
        customerMarkedDoneAt: null, barberMarkedDoneAt: null, serviceActuallyCompletedAt: null, noShowMarkedAt: null,
      };
      const docRef = await addDoc(collection(firestore, 'appointments'), newAppointmentData); // Add to Firestore.
      const finalAppointment: Appointment = { id: docRef.id, ...newAppointmentData };

      // Update local state and cache.
      setAppointments(prev => {
        const updated = [...prev, finalAppointment].sort((a,b) => a.date.localeCompare(b.date) || timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        setItemWithTimestampConversion(LS_APPOINTMENTS_KEY_DASHBOARD, updated);
        return updated;
      });
      toast({ title: "Walk-In Added!", description: `${customerName}'s appointment for ${selectedService.name} at ${appointmentStartTime} added.` });
      setIsWalkInDialogOpen(false); // Close dialog.
    } catch (error: any) {
      console.error("Error adding walk-in:", error);
      toast({ title: "Error", description: error.message || "Could not add walk-in.", variant: "destructive" });
    } finally {
      setIsProcessingWalkIn(false);
    }
  };

  /**
   * Toggles the barber's online booking acceptance status.
   * @param {boolean} newCheckedState - The new state from the switch (true if accepting).
   */
  const handleToggleAcceptingBookings = async (newCheckedState: boolean) => {
    if (!user || !updateUserAcceptingBookings) return;
    setLocalIsAcceptingBookings(newCheckedState); // Optimistic UI update.
    setIsUpdatingAcceptingBookings(true);
    try {
      await updateUserAcceptingBookings(user.uid, newCheckedState); // Update in AuthContext & Firestore.
      toast({ title: "Status Updated", description: `You are now ${newCheckedState ? 'accepting' : 'not accepting'} online bookings.` });
    } catch (error: any) {
      console.error("Error updating accepting bookings:", error);
      toast({ title: "Error", description: error.message || "Could not update booking status.", variant: "destructive" });
      setLocalIsAcceptingBookings(!newCheckedState); // Revert UI on error.
    } finally {
      setIsUpdatingAcceptingBookings(false);
    }
  };

  /**
   * Toggles the barber's temporary unavailability status.
   * If becoming available, it also triggers logic to shift today's appointments.
   * @param {boolean} newSwitchIsOnState - The new state from the switch (true if available, false if busy).
   */
  const handleToggleTemporaryStatus = async (newSwitchIsOnState: boolean) => {
    if (!user || !user.uid || !updateBarberTemporaryStatus) return;

    // Determine if the barber is becoming unavailable based on the new switch state.
    // Switch ON (newSwitchIsOnState = true) means barber is AVAILABLE (so isTemporarilyUnavailable = false).
    // Switch OFF (newSwitchIsOnState = false) means barber is BUSY (so isTemporarilyUnavailable = true).
    const barberIsBecomingUnavailable = !newSwitchIsOnState;

    setLocalIsTemporarilyUnavailable(barberIsBecomingUnavailable); // Optimistic UI update.
    setIsUpdatingTemporaryStatus(true); // Show loading state.
    setIsProcessingAuth(true); // Signal global processing in AuthContext.

    try {
      // Call AuthContext function to update status and handle appointment shifts.
      await updateBarberTemporaryStatus(user.uid, barberIsBecomingUnavailable, user.unavailableSince);
      toast({
        title: "Availability Updated",
        description: `You are now marked as ${barberIsBecomingUnavailable ? 'temporarily unavailable' : 'available'}. ${!barberIsBecomingUnavailable ? 'Appointments may have been shifted.' : ''}`,
      });
      // If status changed to available and shifts might have occurred, refetch appointments.
      if (!barberIsBecomingUnavailable) {
        fetchAppointments();
      }
    } catch (error: any) {
      console.error("Error updating temporary status:", error);
      toast({ title: "Error", description: error.message || "Could not update temporary status.", variant: "destructive" });
      setLocalIsTemporarilyUnavailable(!barberIsBecomingUnavailable); // Revert UI on error.
    } finally {
      setIsUpdatingTemporaryStatus(false); // Clear loading state.
      setIsProcessingAuth(false); // Clear global processing state.
    }
  };

  // Effect to fetch initial data when user ID is available and initial load is complete.
  useEffect(() => {
    if (user?.uid && initialLoadComplete) {
      fetchServices();
      fetchAppointments();
      fetchBarberSelfDataForWalkIn();
    }
  }, [user?.uid, fetchServices, fetchAppointments, fetchBarberSelfDataForWalkIn, initialLoadComplete]);

  // Determine if the "Add Walk-In" button should be disabled and the reason.
  const isAddWalkInDisabled = isProcessingWalkIn || isLoadingServices || services.length === 0 || isLoadingBarberSelfData || localIsTemporarilyUnavailable;
  let walkInTooltipMessage = null;
  if (localIsTemporarilyUnavailable) walkInTooltipMessage = "You are marked as temporarily unavailable.";
  else if (isLoadingServices || isLoadingBarberSelfData) walkInTooltipMessage = "Loading necessary data...";
  else if (services.length === 0) walkInTooltipMessage = "Please add services first.";
  else if (isProcessingWalkIn) walkInTooltipMessage = "Processing previous walk-in...";


  return (
    <ProtectedPage expectedRole="barber">
      <TooltipProvider> {/* Provides context for all tooltips on the page. */}
        <div className="space-y-8">
          {/* Header section with welcome message and Add Walk-In button. */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h1 className="text-2xl font-bold font-headline">Welcome, {user?.firstName || 'Barber'}!</h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Button to open walk-in dialog. Disabled with tooltip if conditions not met. */}
                  <span tabIndex={isAddWalkInDisabled ? 0 : -1}> {/* For accessibility of disabled button tooltip. */}
                    <Button onClick={() => setIsWalkInDialogOpen(true)} className="w-full sm:w-auto h-11 rounded-full px-6 text-base" disabled={isAddWalkInDisabled} aria-describedby={isAddWalkInDisabled ? "add-walkin-tooltip" : undefined}>
                        <PlusCircle className="mr-2 h-5 w-5" /> Add Walk-In
                    </Button>
                  </span>
                </TooltipTrigger>
                {/* Tooltip content displayed if button is disabled. */}
                {walkInTooltipMessage && <TooltipContent id="add-walkin-tooltip"><p>{walkInTooltipMessage}</p></TooltipContent>}
              </Tooltip>
          </div>

          {/* Grid for status toggles: Online Booking and Temporary Status. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card for Online Booking Status Toggle. */}
            <Card className="border-none shadow-lg rounded-xl overflow-hidden">
              <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
                <CardTitle className="text-xl font-bold flex items-center"><Settings2 className="mr-2 h-5 w-5 text-primary" /> Online Booking Status</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                {user ? ( // Show toggle if user data is loaded.
                  <div className="flex items-center space-x-3">
                    <Switch id="accepting-bookings-toggle" checked={localIsAcceptingBookings} onCheckedChange={handleToggleAcceptingBookings} disabled={isUpdatingAcceptingBookings} aria-label="Toggle online bookings" />
                    <Label htmlFor="accepting-bookings-toggle" className="text-base">{localIsAcceptingBookings ? 'Accepting Online Bookings' : 'Not Accepting Online Bookings'}</Label>
                    {isUpdatingAcceptingBookings && <LoadingSpinner className="h-5 w-5 text-primary ml-2" />}
                  </div>
                ) : <div className="flex items-center"><LoadingSpinner className="h-5 w-5 text-primary mr-2" /><p>Loading status...</p></div>}
                {/* Helper text explaining the toggle's functionality. */}
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Turn this off to prevent new online bookings. Existing appointments are not affected. You can still add walk-ins.</p>
              </CardContent>
            </Card>

            {/* Card for Temporary Availability Status Toggle. */}
            <Card className="border-none shadow-lg rounded-xl overflow-hidden">
              <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
                <CardTitle className="text-xl font-bold flex items-center"><Hourglass className="mr-2 h-5 w-5 text-accent" /> Temporary Status</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                {user ? ( // Show toggle if user data is loaded.
                  <div className="flex items-center space-x-3">
                    <Switch
                        id="temporary-unavailable-toggle"
                        // Switch is ON if barber is Available (i.e., NOT temporarily unavailable).
                        checked={!localIsTemporarilyUnavailable}
                        onCheckedChange={handleToggleTemporaryStatus}
                        disabled={isUpdatingTemporaryStatus}
                        aria-label="Toggle temporary availability. ON means Available, OFF means Busy."
                    />
                    <Label htmlFor="temporary-unavailable-toggle" className="text-base">
                        {/* Label reflects the actual state: "Available" or "Temporarily Unavailable". */}
                        {!localIsTemporarilyUnavailable ? 'Available' : 'Temporarily Unavailable'}
                    </Label>
                    {isUpdatingTemporaryStatus && <LoadingSpinner className="h-5 w-5 text-accent ml-2" />}
                  </div>
                ) : <div className="flex items-center"><LoadingSpinner className="h-5 w-5 text-accent mr-2" /><p>Loading status...</p></div>}
                {/* Descriptive text based on current temporary status. */}
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {!localIsTemporarilyUnavailable
                    ? "Set yourself as temporarily unavailable (e.g., short break). Toggle OFF if you need to step out. Appointments for today will be shifted upon your return."
                    : `You've been unavailable ${unavailableSinceDuration || 'for a bit'}. Toggle ON to become available and shift today's appointments.`
                  }
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Alert prompt to add services if none exist. */}
          {(!isLoadingServices && services.length === 0) && (
            <Alert variant="default" className="border-primary/50 shadow-md rounded-lg">
              <Info className="h-5 w-5 text-primary" />
              <AlertTitle className="font-semibold text-lg">Add Services</AlertTitle>
              <AlertDescription className="text-base">No services added yet. Add services to allow bookings and walk-ins.
                <Button asChild variant="link" className="p-0 h-auto ml-1 text-base text-primary hover:underline"><Link href="/barber/services">Manage Services</Link></Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Section for displaying today's appointments. */}
          {(isLoadingAppointments && !appointments.length) ? ( // Show loading spinner if appointments are loading and none are cached.
            <div className="flex justify-center items-center py-10"><LoadingSpinner className="h-8 w-8 text-primary" /><p className="ml-2 text-base">Loading appointments...</p></div>
          ) : (
            <TodaysAppointmentsSection appointments={appointments} onAppointmentAction={handleAppointmentAction} isUpdatingAppointmentId={isUpdatingAppointment} />
          )}
        </div>
      </TooltipProvider>
      {/* Walk-In Dialog, rendered conditionally. */}
      {isWalkInDialogOpen && <WalkInDialog isOpen={isWalkInDialogOpen} onClose={() => setIsWalkInDialogOpen(false)} onSubmit={handleSaveWalkIn} services={services} isSubmitting={isProcessingWalkIn} />}
    </ProtectedPage>
  );
}
