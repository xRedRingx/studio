
/**
 * @fileoverview Customer Booking Page.
 * This page allows customers to book an appointment with a specific barber.
 * The booking process involves several steps:
 * 1. Selecting a service offered by the barber.
 * 2. Picking an available date and time slot.
 * 3. Confirming the booking details.
 * The page fetches barber details, services, schedule, unavailable dates, and existing appointments
 * to determine availability and prevent conflicts.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation'; // Hooks for accessing route/query params and navigation.
import ProtectedPage from '@/components/layout/ProtectedPage'; // Ensures authenticated customer access.
import { useAuth } from '@/hooks/useAuth'; // Auth context hook.
import type { AppUser, BarberService, Appointment, DayAvailability, BarberScheduleDoc, DayOfWeek, UnavailableDate } from '@/types'; // Type definitions.
import { Button } from '@/components/ui/button'; // Button UI component.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Card UI component.
import { Label } from '@/components/ui/label'; // Label UI component.
import { firestore } from '@/firebase/config'; // Firebase Firestore instance.
import { collection, doc, getDoc, getDocs, query, where, addDoc, Timestamp, orderBy } from 'firebase/firestore'; // Firestore methods.
import { useToast } from '@/hooks/use-toast'; // Toast notification hook.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.
import { AlertCircle, CalendarDays, CheckCircle, ChevronLeft, Clock, DollarSign, Scissors, Users, Info, Ban, AlertTriangle, Forward, Check, LayoutDashboard, X, UserCircle as UserCircleIcon, Hourglass } from 'lucide-react'; // Icons.
import { APP_NAME } from '@/lib/constants'; // App constants like name.
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Popover for calendar.
import { Calendar } from '@/components/ui/calendar'; // Calendar UI component.
import { cn } from '@/lib/utils'; // Utility for conditional class names.
import { Progress } from '@/components/ui/progress'; // Progress bar UI component.
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Alert UI component.

// Defines the possible steps in the booking process.
type BookingStep = 'selectService' | 'selectDateTime' | 'confirm' | 'confirmed' | 'queued';

// Titles for each booking step (excluding final confirmation/queue steps).
const bookingStepTitles: Record<Exclude<BookingStep, 'confirmed' | 'queued'>, string> = {
  selectService: "Select a Service",
  selectDateTime: "Pick Date & Time",
  confirm: "Confirm Your Booking",
};

// Numeric representation of each booking step for progress calculation.
const bookingStepNumbers: Record<Exclude<BookingStep, 'confirmed' | 'queued'>, number> = {
  selectService: 1,
  selectDateTime: 2,
  confirm: 3,
};
const totalBookingSteps = 3; // Total number of primary booking steps.

// Minimum lead time (in minutes) required for a customer to book an appointment.
const MIN_BOOKING_LEAD_TIME_MINUTES = 15;

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
 * Converts total minutes from midnight to a time string (e.g., "09:00 AM").
 * @param {number} minutes - Total minutes from midnight.
 * @returns {string} The formatted time string.
 */
const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h % 12 === 0 ? 12 : h % 12;
  const modifier = h < 12 || h === 24 ? 'AM' : 'PM';
  return `${String(hours).padStart(2, '0')}:${String(m).padStart(2, '0')} ${modifier}`;
};

// Order of days for display and logic.
const daysOfWeekOrder: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// Formats a Date object to YYYY-MM-DD string.
const formatDateToYYYYMMDD = (date: Date): string => date.toISOString().split('T')[0];
// Formats a YYYY-MM-DD string to a human-readable display format (e.g., "Monday, January 1").
const formatYYYYMMDDToDisplay = (dateStr: string): string => new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
// Formats a selected Date object for display in the calendar trigger button.
const formatSelectedDateForDisplay = (date: Date): string => date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

/**
 * Calculates the start and end dates of the week containing the given date.
 * Week starts on Monday.
 * @param {Date} date - The date for which to find week boundaries.
 * @returns {{ weekStart: Date, weekEnd: Date }} The start and end dates of the week.
 */
const getWeekBoundaries = (date: Date): { weekStart: Date, weekEnd: Date } => {
  const d = new Date(date);
  const day = d.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
  // Adjust to make Monday the first day of the week.
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1); // If Sunday (0), go back 6 days. If Monday (1), go back 0 days.
  const weekStart = new Date(d.getFullYear(), d.getMonth(), diffToMonday);
  weekStart.setHours(0, 0, 0, 0); // Set to start of the day.
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // End of Sunday.
  weekEnd.setHours(23, 59, 59, 999); // Set to end of the day.
  return { weekStart, weekEnd };
};

// Interface for the anonymized booked slots data.
interface BookedSlot {
    startTime: string;
    endTime: string;
    date: string;
}

/**
 * BookingPage component.
 * Renders the multi-step booking process for a customer.
 *
 * @returns {JSX.Element} The rendered booking page.
 */
export default function BookingPage() {
  const { user } = useAuth(); // Current authenticated customer.
  const router = useRouter(); // Next.js router for navigation.
  const params = useParams(); // Hook for accessing route parameters (e.g., barberId).
  const searchParams = useSearchParams(); // Hook for accessing URL query parameters.
  const barberId = params.barberId as string; // The ID of the barber being booked.
  const { toast } = useToast(); // For displaying notifications.

  // State for barber's details, services, schedule, and appointments.
  const [barber, setBarber] = useState<AppUser | null>(null);
  const [services, setServices] = useState<BarberService[]>([]);
  const [schedule, setSchedule] = useState<DayAvailability[]>([]);
  const [barberUnavailableDates, setBarberUnavailableDates] = useState<UnavailableDate[]>([]);
  // NEW: State for publicly readable, anonymized booked slots.
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [customerExistingAppointments, setCustomerExistingAppointments] = useState<Appointment[]>([]); // Customer's own existing appointments.

  // State for the booking flow.
  const [selectedService, setSelectedService] = useState<BarberService | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // Default to today.
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); // Controls calendar popover.
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);

  // State for current booking step and loading/submission states.
  const [bookingStep, setBookingStep] = useState<BookingStep>('selectService');
  const [isLoadingBarberDetails, setIsLoadingBarberDetails] = useState(true);
  const [isLoadingCustomerAppointments, setIsLoadingCustomerAppointments] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // True when booking is being confirmed.
  const [newlyBookedAppointment, setNewlyBookedAppointment] = useState<Appointment | null>(null); // Stores the confirmed appointment.

  // State for queue information (not fully implemented here, placeholder).
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number | null>(null);
  const [currentlyServingCustomerName, setCurrentlyServingCustomerName] = useState<string | null>(null);
  const [isCurrentUserNext, setIsCurrentUserNext] = useState<boolean>(false);

  // Date constants for calendar range.
  const today = new Date(); today.setHours(0, 0, 0, 0); // Start of today.
  const sevenDaysFromNow = new Date(today); sevenDaysFromNow.setDate(today.getDate() + 6); // Booking allowed up to 7 days in advance.

  /**
   * Fetches all necessary public data for the specified barber to enable booking.
   * - Barber's profile, services, schedule, unavailable dates.
   * - Barber's anonymized booked slots for availability calculation.
   */
  const fetchBarberData = useCallback(async () => {
    if (!barberId) return;
    setIsLoadingBarberDetails(true);
    try {
      // Fetch barber's user document.
      const barberDocRef = doc(firestore, 'users', barberId);
      const barberDocSnap = await getDoc(barberDocRef);
      if (barberDocSnap.exists() && barberDocSnap.data().role === 'barber') {
        const barberData = barberDocSnap.data() as AppUser;
        setBarber({ uid: barberDocSnap.id, ...barberData });
        // If barber is not accepting bookings or is temporarily unavailable, stop loading early.
        if (!(barberData.isAcceptingBookings !== false) || barberData.isTemporarilyUnavailable) {
          setIsLoadingBarberDetails(false);
          return;
        }
      } else { // Barber not found or not a barber.
        toast({ title: "Error", description: "Barber not found.", variant: "destructive" });
        router.push('/customer/dashboard'); return;
      }

      // Fetch barber's services.
      const servicesQuery = query(collection(firestore, 'services'), where('barberId', '==', barberId), orderBy('createdAt', 'desc'));
      const servicesSnapshot = await getDocs(servicesQuery);
      setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BarberService)));


      // Fetch barber's schedule and unavailable dates.
      const scheduleDocRef = doc(firestore, 'barberSchedules', barberId);
      const scheduleDocSnap = await getDoc(scheduleDocRef);
      if (scheduleDocSnap.exists()) {
        const fetchedSchedule = (scheduleDocSnap.data() as BarberScheduleDoc).schedule;
        // Ensure schedule is ordered by `daysOfWeekOrder`.
        setSchedule(daysOfWeekOrder.map(dayName => fetchedSchedule.find(d => d.day === dayName) || { day: dayName, isOpen: false, startTime: '09:00 AM', endTime: '05:00 PM' }));
        const unavailableDatesSnapshot = await getDocs(query(collection(firestore, `barberSchedules/${barberId}/unavailableDates`)));
        setBarberUnavailableDates(unavailableDatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UnavailableDate)));
      } else { // Default to closed schedule if none found.
        setSchedule(daysOfWeekOrder.map(day => ({ day: day as DayAvailability['day'], isOpen: false, startTime: '09:00 AM', endTime: '05:00 PM' })));
        setBarberUnavailableDates([]);
      }

      // UPDATED: Fetch ANONYMIZED booked slots instead of full appointments.
      const bookedSlotsSnapshot = await getDocs(collection(firestore, `publicBarberData/${barberId}/bookedSlots`));
      setBookedSlots(bookedSlotsSnapshot.docs.map(doc => doc.data() as BookedSlot));

    } catch (error) {
      console.error("Error fetching barber data:", error);
      toast({ title: "Error", description: "Could not load barber information. Please check permissions.", variant: "destructive" });
    } finally {
      setIsLoadingBarberDetails(false);
    }
  }, [barberId, toast, router]); // Dependencies for useCallback.


  /**
   * Fetches the current customer's existing appointments for validation purposes
   * (e.g., limits on bookings per day/week, cancellation history).
   */
  const fetchCustomerAppointments = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingCustomerAppointments(true);
    try {
      // Fetch appointments for the current week and the next week.
      const currentWeek = getWeekBoundaries(today);
      const nextWeek = getWeekBoundaries(new Date(new Date().setDate(today.getDate() + 7)));
      const snapshot = await getDocs(query(
        collection(firestore, 'appointments'),
        where('customerId', '==', user.uid),
        where('date', '>=', formatDateToYYYYMMDD(currentWeek.weekStart)),
        where('date', '<=', formatDateToYYYYMMDD(nextWeek.weekEnd)), // Covers two weeks for policy checks.
        orderBy('date', 'asc')
      ));
      setCustomerExistingAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
    } catch (error) {
      console.error("Error fetching customer appointments:", error);
      toast({ title: "Validation Error", description: "Could not retrieve your appointments.", variant: "destructive" });
    } finally {
      setIsLoadingCustomerAppointments(false);
    }
  }, [user?.uid, toast, today]); // Dependencies for useCallback.

  // Effects to fetch data on component mount or when dependencies change.
  useEffect(() => { fetchBarberData(); }, [fetchBarberData]);
  useEffect(() => { if (user?.uid) fetchCustomerAppointments(); }, [user?.uid, fetchCustomerAppointments]);
  
  // Effect to pre-select a service if provided in the URL, this is separated to break the dependency loop.
  useEffect(() => {
    if (services.length > 0) {
      const serviceIdFromQuery = searchParams.get('serviceId');
      if (serviceIdFromQuery) {
        const serviceToPreselect = services.find(s => s.id === serviceIdFromQuery);
        if (serviceToPreselect) {
          setSelectedService(serviceToPreselect);
          setBookingStep('selectDateTime');
        }
      }
    }
  }, [services, searchParams]);


  /**
   * Effect to calculate available time slots when selected service, date, schedule,
   * or other relevant data changes.
   */
  useEffect(() => {
    // Conditions under which no slots should be available.
    if (!selectedService || !schedule.length || !selectedDate || !(barber?.isAcceptingBookings !== false) || barber?.isTemporarilyUnavailable) {
      setAvailableTimeSlots([]); setSelectedTimeSlot(null); return;
    }
    const targetDateStr = formatDateToYYYYMMDD(selectedDate);
    // Check if the selected date is marked as unavailable by the barber.
    if (barberUnavailableDates.some(ud => ud.date === targetDateStr)) {
      setAvailableTimeSlots([]); setSelectedTimeSlot(null); return;
    }
    // Get the barber's schedule for the selected day of the week.
    const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }) as DayAvailability['day'];
    const daySchedule = schedule.find(d => d.day === dayOfWeek);
    if (!daySchedule || !daySchedule.isOpen) { // Barber is closed on this day.
      setAvailableTimeSlots([]); setSelectedTimeSlot(null); return;
    }

    const slots: string[] = [];
    const serviceDuration = selectedService.duration;
    let currentTimeMinutes = timeToMinutes(daySchedule.startTime); // Start from barber's opening time.
    const endTimeMinutes = timeToMinutes(daySchedule.endTime); // Barber's closing time.
    
    // UPDATED: Use anonymized bookedSlots for conflict checking
    const conflictingSlots = bookedSlots
      .filter(slot => slot.date === targetDateStr)
      .map(slot => ({ start: timeToMinutes(slot.startTime), end: timeToMinutes(slot.endTime) }));

    // Iterate through potential time slots (every 15 minutes).
    while (currentTimeMinutes + serviceDuration <= endTimeMinutes) {
      const slotEndMinutes = currentTimeMinutes + serviceDuration;
      // Check if the potential slot overlaps with any existing booked slots.
      const isSlotFree = !conflictingSlots.some(bs => currentTimeMinutes < bs.end && slotEndMinutes > bs.start);
      // Ensure the slot is in the future, respecting the minimum booking lead time for today.
      let isSlotInFuture = true;
      if (targetDateStr === formatDateToYYYYMMDD(new Date())) { // If booking for today.
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        if (currentTimeMinutes < nowMinutes + MIN_BOOKING_LEAD_TIME_MINUTES) {
          isSlotInFuture = false; // Slot is too soon.
        }
      }
      if (isSlotFree && isSlotInFuture) {
        slots.push(minutesToTime(currentTimeMinutes)); // Add available slot.
      }
      currentTimeMinutes += 15; // Move to the next potential slot.
    }
    setAvailableTimeSlots(slots); setSelectedTimeSlot(null); // Reset selected time slot when date/service changes.
  }, [selectedService, selectedDate, schedule, bookedSlots, barberUnavailableDates, barber]); // Dependencies for slot calculation.


  // Event handlers for booking step navigation and selections.
  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(services.find(s => s.id === serviceId) || null);
    setBookingStep('selectDateTime'); // Move to next step.
  };
  const handleDateSelect = (date: Date | undefined) => { if (date) { setSelectedDate(date); setSelectedTimeSlot(null); setIsCalendarOpen(false); }};
  const handleTimeSlotSelect = (time: string) => setSelectedTimeSlot(time);
  const handleProceedToConfirm = () => {
    if (selectedService && selectedTimeSlot && selectedDate) setBookingStep('confirm'); // Move to confirmation step.
    else toast({ title: "Missing information", description: "Please select service, date, and time.", variant: "destructive" });
  };

  /**
   * Placeholder function for fetching and calculating queue information.
   * Currently, it simplifies to moving to 'confirmed' step.
   * @param {Appointment} bookedAppointment - The newly booked appointment.
   */
  const fetchAndCalculateQueueInfo = async (bookedAppointment: Appointment) => {
    // Actual implementation would involve:
    // - Fetching other 'upcoming' appointments for the barber on the same day.
    // - Calculating queue position and estimated wait time based on ongoing services.
    // For now, directly go to 'confirmed' as queue display is basic.
    setBookingStep('confirmed');
  };

  /**
   * Handles the final confirmation of the booking.
   * Performs validation checks (booking limits, barber availability) and creates the appointment in Firestore.
   */
  const handleConfirmBooking = async () => {
    if (!user || !selectedService || !selectedTimeSlot || !barber || !selectedDate) {
      toast({ title: "Error", description: "Missing booking information.", variant: "destructive" }); return;
    }
    // Check if barber is currently accepting bookings or is temporarily unavailable.
    if (barber.isAcceptingBookings === false) {
      toast({ title: "Booking Not Allowed", description: "This barber is not accepting online bookings.", variant: "destructive" }); return;
    }
    if (barber.isTemporarilyUnavailable) {
        toast({ title: "Barber Busy", description: "This barber is temporarily unavailable for bookings.", variant: "destructive" }); return;
    }
    setIsSubmitting(true); // Set loading state for submission.
    const selectedDateStr = formatDateToYYYYMMDD(selectedDate);

    // --- Booking Policy Validations ---
    // Check daily cancellation limit.
    if (customerExistingAppointments.filter(app => app.date === selectedDateStr && app.customerId === user.uid && app.status === 'cancelled').length >= 2) {
      toast({ title: "Booking Limit", description: "You've cancelled 2 appointments today. Cannot book another for this day.", variant: "destructive" });
      setIsSubmitting(false); return;
    }
    // Check weekly cancellation limit.
    const { weekStart, weekEnd } = getWeekBoundaries(selectedDate);
    if (customerExistingAppointments.filter(app => app.customerId === user.uid && app.status === 'cancelled' && new Date(app.date + 'T00:00:00') >= weekStart && new Date(app.date + 'T00:00:00') <= weekEnd).length >= 4) {
      toast({ title: "Booking Limit", description: "You've cancelled 4 appointments this week. Cannot book another for this week.", variant: "destructive" });
      setIsSubmitting(false); return;
    }
    // Check daily active booking limit.
    if (customerExistingAppointments.filter(app => app.date === selectedDateStr && app.customerId === user.uid && app.status !== 'cancelled').length >= 1) {
      toast({ title: "Booking Limit", description: "Only one appointment per day allowed.", variant: "destructive" });
      setIsSubmitting(false); return;
    }
    // Check weekly active booking limit.
    if (customerExistingAppointments.filter(app => app.customerId === user.uid && app.status !== 'cancelled' && new Date(app.date + 'T00:00:00') >= weekStart && new Date(app.date + 'T00:00:00') <= weekEnd).length >= 2) {
      toast({ title: "Booking Limit", description: "Only two appointments per week allowed.", variant: "destructive" });
      setIsSubmitting(false); return;
    }

    try {
      // Prepare appointment data.
      const appointmentStartTimeStr = selectedTimeSlot;
      const serviceDuration = selectedService.duration;
      const appointmentEndTimeStr = minutesToTime(timeToMinutes(appointmentStartTimeStr) + serviceDuration);
      const now = Timestamp.now(); // Current time for timestamps.
      // Convert selected time slot to a full Date object for Firestore Timestamp.
      const [timePart, modifier] = appointmentStartTimeStr.split(' ');
      let [hours, minutes] = timePart.split(':').map(Number);
      if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
      else if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0; // Midnight case.
      const finalJsDate = new Date(selectedDate); finalJsDate.setHours(hours, minutes, 0, 0);
      const appointmentTimestampValue = Timestamp.fromDate(finalJsDate);

      // Construct the new appointment object.
      const newAppointmentData: Omit<Appointment, 'id'> = {
        barberId: barber.uid, barberName: `${barber.firstName} ${barber.lastName}`, customerId: user.uid,
        customerName: `${user.firstName} ${user.lastName}`, serviceId: selectedService.id, serviceName: selectedService.name,
        price: selectedService.price, date: selectedDateStr, startTime: appointmentStartTimeStr, endTime: appointmentEndTimeStr,
        appointmentTimestamp: appointmentTimestampValue, status: 'upcoming', createdAt: now, updatedAt: now,
        customerCheckedInAt: null, barberCheckedInAt: null, serviceActuallyStartedAt: null,
        customerMarkedDoneAt: null, barberMarkedDoneAt: null, serviceActuallyCompletedAt: null, noShowMarkedAt: null,
        reminderSent: false, // Explicitly set reminderSent to false
      };
      const docRef = await addDoc(collection(firestore, 'appointments'), newAppointmentData); // Add to Firestore.
      const finalAppointment: Appointment = { id: docRef.id, ...newAppointmentData };
      setNewlyBookedAppointment(finalAppointment); // Store for confirmation display.
      setCustomerExistingAppointments(prev => [...prev, finalAppointment]); // Update local state.
      toast({ title: "Booking Confirmed!", description: "Your appointment is booked." });

      // If booked for today, try to fetch queue info (simplified).
      if (finalAppointment.date === formatDateToYYYYMMDD(new Date())) await fetchAndCalculateQueueInfo(finalAppointment);
      else setBookingStep('confirmed'); // Otherwise, go directly to confirmed step.
    } catch (error) {
      console.error("Error confirming booking:", error);
      toast({ title: "Booking Failed", description: "Could not confirm appointment.", variant: "destructive" });
    } finally {
      setIsSubmitting(false); // Clear submission loading state.
    }
  };


  /**
   * Renders the progress bar indicating the current booking step.
   * @returns {JSX.Element | null} The progress bar component or null.
   */
  const renderStepProgress = () => {
    if (bookingStep === 'confirmed' || bookingStep === 'queued') return null; // No progress bar on final steps.
    const currentStepNumber = bookingStepNumbers[bookingStep];
    const currentStepTitle = bookingStepTitles[bookingStep];
    const progressValue = (currentStepNumber / totalBookingSteps) * 100;
    return (
      <div className="mb-6 space-y-2">
        <p className="text-sm text-muted-foreground">Step {currentStepNumber} of {totalBookingSteps}: <span className="font-semibold text-foreground">{currentStepTitle}</span></p>
        <Progress value={progressValue} className="w-full h-2 rounded-full" />
      </div>
    );
  };

  // --- Conditional Rendering for Loading/Error States ---
  if (isLoadingBarberDetails || isLoadingCustomerAppointments) {
    return (<ProtectedPage expectedRole="customer"><div className="flex min-h-[calc(100vh-10rem)] items-center justify-center"><LoadingSpinner className="h-12 w-12 text-primary" /><p className="ml-3 text-base">Loading details...</p></div></ProtectedPage>);
  }
  if (!barber) { // Barber not found after loading.
    return (<ProtectedPage expectedRole="customer"><div className="text-center py-10"><AlertCircle className="mx-auto h-16 w-16 text-destructive mb-4" /><h2 className="text-2xl font-bold text-destructive">Barber not found.</h2><Button onClick={() => router.push('/customer/dashboard')} className="mt-6 h-14 rounded-full px-8 text-lg">Go Back</Button></div></ProtectedPage>);
  }

  // Determine barber's current booking availability.
  const barberIsAcceptingBookings = barber.isAcceptingBookings !== false; // Default to true if undefined.
  const barberIsTemporarilyUnavailable = barber.isTemporarilyUnavailable || false;

  // If barber is not accepting bookings or temporarily unavailable, show appropriate message.
  if (!barberIsAcceptingBookings && bookingStep !== 'confirmed' && bookingStep !== 'queued') {
    return (<ProtectedPage expectedRole="customer"><Card className="border-none text-center py-10"><CardContent className="space-y-4"><AlertTriangle className="mx-auto h-16 w-16 text-yellow-500" /><h1 className="text-2xl font-bold font-headline">Booking Not Available</h1><p className="text-base text-gray-600 dark:text-gray-400">{barber.firstName} {barber.lastName} is not accepting online bookings.</p><Button onClick={() => router.push(`/customer/view-barber/${barberId}`)} className="mt-6 h-12 rounded-full px-6 text-base">Barber's Profile</Button></CardContent></Card></ProtectedPage>);
  }
  if (barberIsTemporarilyUnavailable && bookingStep !== 'confirmed' && bookingStep !== 'queued') {
    return (<ProtectedPage expectedRole="customer"><Card className="border-none text-center py-10"><CardContent className="space-y-4"><Hourglass className="mx-auto h-16 w-16 text-yellow-500" /><h1 className="text-2xl font-bold font-headline">Barber Temporarily Busy</h1><p className="text-base text-gray-600 dark:text-gray-400">{barber.firstName} {barber.lastName} is temporarily unavailable. Please check back soon.</p><Button onClick={() => router.push(`/customer/view-barber/${barberId}`)} className="mt-6 h-12 rounded-full px-6 text-base">Barber's Profile</Button></CardContent></Card></ProtectedPage>);
  }

  /**
   * Renders the content for the current booking step.
   * @returns {JSX.Element | null} The content for the current step.
   */
  const renderStepContent = () => {
    switch (bookingStep) {
      case 'selectService': return ( // --- Step 1: Select Service ---
        <Card className="border-none">
          <CardHeader className="p-4 md:p-6"><CardTitle className="text-xl font-bold">Select a Service</CardTitle><CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">Choose from services by {barber.firstName}.</CardDescription></CardHeader>
          <CardContent className="space-y-3 p-4 md:p-6">
            {services.length === 0 ? <div className="text-center py-6"><Info className="mx-auto h-10 w-10 text-muted-foreground mb-3" /><p className="text-base">This barber has no services listed.</p></div> :
              services.map(service => ( // List each service as a clickable button.
                <Button key={service.id} variant="outline" className="w-full justify-between text-left h-auto py-4 px-4 rounded-lg border hover:bg-accent/50" onClick={() => handleServiceSelect(service.id)}>
                  <div className="flex flex-col flex-grow"><span className="font-semibold text-base">{service.name}</span><span className="text-sm text-gray-500 dark:text-gray-400 mt-1"><DollarSign className="inline h-4 w-4 mr-1" />{service.price.toFixed(2)}<Clock className="inline h-4 w-4 ml-3 mr-1" /><span className="text-primary">{service.duration} min</span></span></div><ChevronLeft className="h-5 w-5 ml-auto text-gray-400 transform rotate-180" /> {/* Chevron indicates "next" action. */}
                </Button>))}
          </CardContent></Card>);
      case 'selectDateTime': // --- Step 2: Select Date & Time ---
        const isDateUnavailable = barberUnavailableDates.some(ud => ud.date === formatDateToYYYYMMDD(selectedDate));
        return (
          <Card className="border-none">
            <CardHeader className="p-4 md:p-6"><CardTitle className="text-xl font-bold">Pick Date &amp; Time</CardTitle><CardDescription className="text-sm text-gray-500 mt-1">Service: <span className="font-semibold">{selectedService?.name}</span></CardDescription></CardHeader>
            <CardContent className="space-y-6 p-4 md:p-6">
              {/* Display barber's weekly availability summary. */}
              {schedule.length > 0 && <div className="mb-6 p-4 border rounded-lg bg-card"><h4 className="text-md font-semibold mb-3 flex items-center"><Info className="h-5 w-5 mr-2 text-primary" />Barber's Weekly Availability</h4><div className="space-y-1.5">{daysOfWeekOrder.map(dayName => { const d = schedule.find(s => s.day === dayName); if (!d) return null; return (<div key={d.day} className="flex justify-between items-center text-sm"><span className="text-gray-600 dark:text-gray-400">{d.day}</span>{d.isOpen ? <span className="font-medium text-primary">{d.startTime} &ndash; {d.endTime}</span> : <span className="text-gray-500">Closed</span>}</div>);})}</div></div>}
              {/* Date Picker */}
              <div><Label className="text-base font-medium mb-2 block">Select Date</Label><Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}><PopoverTrigger asChild><Button variant="outline" className={cn("w-full sm:w-[280px] justify-start text-left font-normal h-12 text-base mb-1 rounded-md",!selectedDate && "text-muted-foreground")}><CalendarDays className="mr-2 h-4 w-4" />{selectedDate ? formatSelectedDateForDisplay(selectedDate) : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 rounded-lg"><Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} disabled={(date) => date < today || date > sevenDaysFromNow || barberUnavailableDates.some(ud => ud.date === formatDateToYYYYMMDD(date))} initialFocus /></PopoverContent></Popover>{isDateUnavailable && <p className="text-sm text-destructive flex items-center mt-1 mb-4"><Ban className="h-4 w-4 mr-1.5" />This date is unavailable.</p>}</div>
              {/* Time Slot Selector */}
              <div><Label className="text-base font-medium mb-3 block">Select Time Slot</Label>
                {isDateUnavailable ? <p className="text-sm text-destructive">Barber unavailable on this date.</p> : availableTimeSlots.length > 0 ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{availableTimeSlots.map(slot => (<Button key={slot} variant={selectedTimeSlot === slot ? 'default' : 'outline'} onClick={() => handleTimeSlotSelect(slot)} className="h-12 rounded-md text-base"><span className={selectedTimeSlot === slot ? "" : "text-primary"}>{slot}</span></Button>))}</div> : <p className="text-sm text-gray-500">No slots available for this service/date. Bookings must be {MIN_BOOKING_LEAD_TIME_MINUTES} min in advance.</p>}</div>
              {/* Navigation Buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-center pt-6 space-y-3 sm:space-y-0 sm:space-x-3 border-t mt-4"><Button variant="outline" onClick={() => setBookingStep('selectService')} className="w-full sm:w-auto h-12 rounded-full text-base"><ChevronLeft className="mr-2 h-4 w-4" />Back to Services</Button><Button onClick={handleProceedToConfirm} disabled={!selectedTimeSlot || !selectedService || isDateUnavailable} className="w-full sm:w-auto h-12 rounded-full text-base">Proceed <Forward className="ml-2 h-4 w-4" /></Button></div>
            </CardContent></Card>);
      case 'confirm': return ( // --- Step 3: Confirm Booking ---
        <Card className="border-none">
          <CardHeader className="p-4 md:p-6"><CardTitle className="text-xl font-bold">Confirm Booking</CardTitle><CardDescription className="text-sm text-gray-500 mt-1">Review your appointment details.</CardDescription></CardHeader>
          <CardContent className="space-y-4 p-4 md:p-6">
            {/* Display booking summary. */}
            <div className="space-y-2 text-base border rounded-lg p-4 bg-card"><p className="font-semibold text-lg text-primary mb-3">Review Details:</p><p><Scissors className="inline mr-2 h-5 w-5 text-gray-500" />Service: <span className="font-medium">{selectedService?.name}</span></p><p><UserCircleIcon className="inline mr-2 h-5 w-5 text-gray-500" />With: <span className="font-medium">{barber.firstName} {barber.lastName}</span></p><p><CalendarDays className="inline mr-2 h-5 w-5 text-gray-500" />Date: <span className="font-medium">{selectedDate ? formatSelectedDateForDisplay(selectedDate) : ''}</span></p><p><Clock className="inline mr-2 h-5 w-5 text-gray-500" />Time: <span className="font-medium text-primary">{selectedTimeSlot}</span></p><p><DollarSign className="inline mr-2 h-5 w-5 text-gray-500" />Price: <span className="font-medium">${selectedService?.price.toFixed(2)}</span></p></div>
            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-center pt-6 space-y-3 sm:space-y-0 sm:space-x-3 border-t mt-4"><Button variant="outline" onClick={() => setBookingStep('selectDateTime')} className="w-full sm:w-auto h-12 rounded-full text-base"><ChevronLeft className="mr-2 h-4 w-4" />Back</Button><Button onClick={handleConfirmBooking} className="w-full sm:w-auto h-14 rounded-full text-lg" disabled={isSubmitting || isLoadingCustomerAppointments}>{(isSubmitting || isLoadingCustomerAppointments) && <LoadingSpinner className="mr-2 h-5 w-5" />}<Check className="mr-2 h-5 w-5" />{(isSubmitting || isLoadingCustomerAppointments) ? 'Validating...' : 'Confirm Booking'}</Button></div>
          </CardContent></Card>);
      case 'confirmed': return ( // --- Final Step: Booking Confirmed ---
        <Card className="text-center border-none p-4 md:p-6">
          <CardHeader className="pt-4 pb-2"><CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" /><CardTitle className="text-2xl font-bold">Booking Confirmed!</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-base pt-2"><p>Your appointment for <span className="font-semibold">{newlyBookedAppointment?.serviceName}</span> with <span className="font-semibold">{barber.firstName} {barber.lastName}</span> on <span className="font-semibold">{formatYYYYMMDDToDisplay(newlyBookedAppointment?.date || '')} at <span className="text-primary">{newlyBookedAppointment?.startTime}</span></span> has been booked.</p><Button onClick={() => router.push('/customer/dashboard')} className="mt-8 w-full max-w-xs mx-auto h-14 rounded-full text-lg"><LayoutDashboard className="mr-2 h-5 w-5" />Back to Dashboard</Button></CardContent></Card>);
      case 'queued': return ( // --- Final Step: Queued (Placeholder) ---
        <Card className="text-center border-none p-4 md:p-6">
          <CardHeader className="pt-4 pb-2">{isCurrentUserNext && <AlertCircle className="mx-auto h-16 w-16 text-primary mb-4" />}{!isCurrentUserNext && queuePosition && <Users className="mx-auto h-16 w-16 text-primary mb-4" />}<CardTitle className="text-2xl font-bold">{isCurrentUserNext ? "You're Next!" : (queuePosition ? `You are #${queuePosition} in line` : "Queue Information")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-base pt-2">{newlyBookedAppointment && barber && (<div className="pb-3 mb-4 border-b border-border"><p className="text-lg font-semibold text-foreground">Your Appointment:</p><p><span className="font-medium">{newlyBookedAppointment.serviceName}</span> with <span className="font-medium">{barber.firstName} {barber.lastName}</span></p><p>Today at <span className="font-medium text-primary">{newlyBookedAppointment.startTime}</span>.</p></div>)}<div className="space-y-1.5">{isCurrentUserNext && (<p className="text-xl font-semibold text-green-600">You are next! Please proceed to the barbershop.</p>)}{queuePosition && !isCurrentUserNext && (<p className="text-lg">Your position: <span className="font-bold text-2xl text-primary">#{queuePosition}</span></p>)}{estimatedWaitTime !== null && estimatedWaitTime > 0 && !isCurrentUserNext && (<p className="text-md">Estimated wait: <span className="font-semibold text-primary">~{estimatedWaitTime} minutes</span></p>)}{currentlyServingCustomerName && (<p className="text-sm text-muted-foreground">Currently serving: <span className="font-medium text-foreground">{currentlyServingCustomerName}</span>.</p>)}{!currentlyServingCustomerName && queuePosition === 1 && !isCurrentUserNext && ( <p className="text-md text-muted-foreground">You are at the front. Barber will call you shortly.</p>)}</div><p className="text-xs text-muted-foreground pt-4">Note: Queue info is an estimate. Please arrive on time.</p><Button onClick={() => router.push('/customer/dashboard')} className="mt-6 w-full max-w-xs mx-auto h-14 rounded-full text-lg"><LayoutDashboard className="mr-2 h-5 w-5" />Back to Dashboard</Button></CardContent></Card>);
      default: return null;
    }
  };

  return (
    // ProtectedPage ensures only authenticated customers can access this page.
    <ProtectedPage expectedRole="customer">
      <div className="space-y-6">
        {/* Page Header with title and cancel button. */}
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold font-headline">Book with {barber.firstName || APP_NAME}</h1>{bookingStep !== 'selectService' && bookingStep !== 'queued' && bookingStep !== 'confirmed' && (<Button variant="ghost" onClick={() => router.push('/customer/dashboard')} className="text-sm text-primary hover:bg-destructive/10 hover:text-destructive rounded-full px-3 py-1.5"><X className="mr-1.5 h-4 w-4"/>Cancel Booking</Button>)}</div>
        {renderStepProgress()} {/* Renders the progress bar. */}
        {renderStepContent()} {/* Renders the content for the current booking step. */}
      </div>
    </ProtectedPage>
  );
}
