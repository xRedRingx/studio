
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { AppUser, BarberService, Appointment, DayAvailability, BarberScheduleDoc, DayOfWeek, UnavailableDate } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { firestore } from '@/firebase/config';
import { collection, doc, getDoc, getDocs, query, where, addDoc, Timestamp, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { AlertCircle, CalendarDays, CheckCircle, ChevronLeft, Clock, DollarSign, Scissors, Users, Info, Ban, AlertTriangle, Forward, Check, LayoutDashboard, X, UserCircle as UserCircleIcon } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress'; 

type BookingStep = 'selectService' | 'selectDateTime' | 'confirm' | 'confirmed' | 'queued';

const bookingStepTitles: Record<Exclude<BookingStep, 'confirmed' | 'queued'>, string> = {
  selectService: "Select a Service",
  selectDateTime: "Pick Date & Time",
  confirm: "Confirm Your Booking",
};

const bookingStepNumbers: Record<Exclude<BookingStep, 'confirmed' | 'queued'>, number> = {
  selectService: 1,
  selectDateTime: 2,
  confirm: 3,
};
const totalBookingSteps = 3;


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

const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h % 12 === 0 ? 12 : h % 12;
  const modifier = h < 12 || h === 24 ? 'AM' : 'PM';
  return `${String(hours).padStart(2, '0')}:${String(m).padStart(2, '0')} ${modifier}`;
};

const daysOfWeekOrder: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const formatYYYYMMDDToDisplay = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00'); // Ensure parsing as local date
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
};

const formatSelectedDateForDisplay = (date: Date): string => {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const getWeekBoundaries = (date: Date): { weekStart: Date, weekEnd: Date } => {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1); // day 0 is Sunday
  const weekStart = new Date(d.getFullYear(), d.getMonth(), diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
};


export default function BookingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const barberId = params.barberId as string;
  const { toast } = useToast();

  const [barber, setBarber] = useState<AppUser | null>(null);
  const [services, setServices] = useState<BarberService[]>([]);
  const [schedule, setSchedule] = useState<DayAvailability[]>([]);
  const [barberUnavailableDates, setBarberUnavailableDates] = useState<UnavailableDate[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([]);
  const [customerExistingAppointments, setCustomerExistingAppointments] = useState<Appointment[]>([]);

  const [selectedService, setSelectedService] = useState<BarberService | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // Default to today
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);

  const [bookingStep, setBookingStep] = useState<BookingStep>('selectService');
  const [isLoadingBarberDetails, setIsLoadingBarberDetails] = useState(true);
  const [isLoadingCustomerAppointments, setIsLoadingCustomerAppointments] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newlyBookedAppointment, setNewlyBookedAppointment] = useState<Appointment | null>(null);
  
  // Queue related states
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number | null>(null);
  const [currentlyServingCustomerName, setCurrentlyServingCustomerName] = useState<string | null>(null);
  const [isCurrentUserNext, setIsCurrentUserNext] = useState<boolean>(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 6);


  const fetchBarberData = useCallback(async () => {
    if (!barberId) return;
    setIsLoadingBarberDetails(true);
    try {
      const barberDocRef = doc(firestore, 'users', barberId);
      const barberDocSnap = await getDoc(barberDocRef);
      if (barberDocSnap.exists() && barberDocSnap.data().role === 'barber') {
        const barberData = barberDocSnap.data() as AppUser;
        const isAccepting = barberData.isAcceptingBookings !== undefined && barberData.isAcceptingBookings !== null 
                            ? barberData.isAcceptingBookings 
                            : true; // Default to true if not set
        setBarber({ uid: barberDocSnap.id, ...barberData, isAcceptingBookings: isAccepting });
        
        if (!isAccepting) {
            // If barber is not accepting bookings, no need to load services etc.
            setIsLoadingBarberDetails(false);
            return;
        }

      } else {
        toast({ title: "Error", description: "Barber not found.", variant: "destructive" });
        router.push('/customer/dashboard');
        return;
      }

      // Fetch services only if barber is accepting bookings
      const servicesQuery = query(collection(firestore, 'services'), where('barberId', '==', barberId), orderBy('createdAt', 'desc'));
      const servicesSnapshot = await getDocs(servicesQuery);
      setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BarberService)));

      const scheduleDocRef = doc(firestore, 'barberSchedules', barberId);
      const scheduleDocSnap = await getDoc(scheduleDocRef);
      if (scheduleDocSnap.exists()) {
        const barberScheduleDoc = scheduleDocSnap.data() as BarberScheduleDoc;
        const fetchedSchedule = barberScheduleDoc.schedule;
        // Ensure schedule is sorted by daysOfWeekOrder and includes all days
        const sortedFetchedSchedule = daysOfWeekOrder.map(dayName => {
            const foundDay = fetchedSchedule.find(d => d.day === dayName);
            return foundDay || { day: dayName, isOpen: false, startTime: '09:00 AM', endTime: '05:00 PM' }; // Default if day missing
        });
        setSchedule(sortedFetchedSchedule);

        // Fetch unavailable dates
        const unavailableDatesColRef = collection(firestore, `barberSchedules/${barberId}/unavailableDates`);
        const unavailableDatesSnapshot = await getDocs(query(unavailableDatesColRef));
        const fetchedUnavailableDates: UnavailableDate[] = [];
        unavailableDatesSnapshot.forEach((doc) => {
            fetchedUnavailableDates.push({ id: doc.id, ...doc.data() } as UnavailableDate);
        });
        setBarberUnavailableDates(fetchedUnavailableDates);

      } else {
        // Default schedule if none found (all days closed)
        const defaultSchedule: DayAvailability[] = daysOfWeekOrder.map(day => ({ day: day as DayAvailability['day'], isOpen: false, startTime: '09:00 AM', endTime: '05:00 PM' }));
        setSchedule(defaultSchedule);
        setBarberUnavailableDates([]);
      }

      // Fetch existing appointments for the next 7 days for this barber to calculate availability
      const dateQueryArray: string[] = [];
      const currentDateIter = new Date(); // Start from today for availability checks
      for (let i = 0; i < 7; i++) { // Look 7 days ahead
        const futureDate = new Date(currentDateIter);
        futureDate.setDate(currentDateIter.getDate() + i);
        dateQueryArray.push(formatDateToYYYYMMDD(futureDate));
      }
      
      const appointmentsQuery = query(
        collection(firestore, 'appointments'),
        where('barberId', '==', barberId),
        where('date', 'in', dateQueryArray)
        // No need to filter by status here, as all non-cancelled/non-completed appointments block time
      );
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      setExistingAppointments(appointmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));

    } catch (error) {
      console.error("Error fetching barber data:", error);
      toast({ title: "Error", description: "Could not load barber information.", variant: "destructive" });
    } finally {
      setIsLoadingBarberDetails(false);
    }
  }, [barberId, toast, router]);

  const fetchCustomerAppointments = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingCustomerAppointments(true);
    try {
      // Fetch customer's appointments for this week and next week for validation
      const today = new Date();
      const currentWeek = getWeekBoundaries(today);
      const nextWeek = getWeekBoundaries(new Date(new Date().setDate(today.getDate() + 7))); // Get start of next week

      const appointmentsQuery = query(
        collection(firestore, 'appointments'),
        where('customerId', '==', user.uid),
        // Query for appointments from the start of the current week to the end of the next week
        where('date', '>=', formatDateToYYYYMMDD(currentWeek.weekStart)),
        where('date', '<=', formatDateToYYYYMMDD(nextWeek.weekEnd)),
        orderBy('date', 'asc') // For easier processing if needed
      );
      const snapshot = await getDocs(appointmentsQuery);
      setCustomerExistingAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
    } catch (error) {
      console.error("Error fetching customer's existing appointments:", error);
      toast({ title: "Validation Error", description: "Could not retrieve your appointments to validate booking limits.", variant: "destructive" });
    } finally {
      setIsLoadingCustomerAppointments(false);
    }
  }, [user?.uid, toast]);

  useEffect(() => {
    fetchBarberData();
  }, [fetchBarberData]);

  useEffect(() => {
    if (user?.uid) {
      fetchCustomerAppointments();
    }
  }, [user?.uid, fetchCustomerAppointments]);


  useEffect(() => {
    if (!selectedService || !schedule.length || !selectedDate || !(barber?.isAcceptingBookings !== false) ) {
      setAvailableTimeSlots([]);
      return;
    }

    const targetDateStr = formatDateToYYYYMMDD(selectedDate);

    // Check if barber is unavailable on the selected date
    if (barberUnavailableDates.some(ud => ud.date === targetDateStr)) {
      setAvailableTimeSlots([]);
      setSelectedTimeSlot(null); // Reset selected time slot
      return;
    }

    const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }) as DayAvailability['day'];
    const daySchedule = schedule.find(d => d.day === dayOfWeek);

    if (!daySchedule || !daySchedule.isOpen) {
      setAvailableTimeSlots([]);
      setSelectedTimeSlot(null); // Reset selected time slot
      return;
    }

    const slots: string[] = [];
    const serviceDuration = selectedService.duration;
    let currentTimeMinutes = timeToMinutes(daySchedule.startTime);
    const endTimeMinutes = timeToMinutes(daySchedule.endTime);

    const bookedSlots = existingAppointments
      .filter(app => app.date === targetDateStr && app.status !== 'cancelled') // Consider only non-cancelled for availability
      .map(app => ({
        start: timeToMinutes(app.startTime),
        end: timeToMinutes(app.endTime), // Use original endTime for blocking
      }));

    while (currentTimeMinutes + serviceDuration <= endTimeMinutes) {
      const slotEndMinutes = currentTimeMinutes + serviceDuration;
      const isSlotFree = !bookedSlots.some(
        bookedSlot => currentTimeMinutes < bookedSlot.end && slotEndMinutes > bookedSlot.start
      );

      // Check if slot is in the future (with a small buffer, e.g., 15 mins from now)
      let isSlotInFuture = true;
      if (targetDateStr === formatDateToYYYYMMDD(new Date())) { // If selected date is today
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const bufferMinutes = 15; // Customer must book at least 15 mins in advance
        if (currentTimeMinutes < nowMinutes + bufferMinutes) {
          isSlotInFuture = false;
        }
      }

      if (isSlotFree && isSlotInFuture) {
        slots.push(minutesToTime(currentTimeMinutes));
      }
      currentTimeMinutes += 15; // Check every 15 minutes
    }
    setAvailableTimeSlots(slots);
    setSelectedTimeSlot(null); // Reset selected time slot when date or service changes
  }, [selectedService, selectedDate, schedule, existingAppointments, barberUnavailableDates, barber?.isAcceptingBookings]);


  const handleServiceSelect = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service || null);
    setBookingStep('selectDateTime');
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setSelectedTimeSlot(null); // Reset time slot when date changes
      setIsCalendarOpen(false);
    }
  };

  const handleTimeSlotSelect = (time: string) => {
    setSelectedTimeSlot(time);
  };

  const handleProceedToConfirm = () => {
    if (selectedService && selectedTimeSlot && selectedDate) {
      setBookingStep('confirm');
    } else {
      toast({ title: "Missing information", description: "Please select a service, date, and time.", variant: "destructive" });
    }
  };
  
  const fetchAndCalculateQueueInfo = async (bookedAppointment: Appointment) => {
    if (!barberId || !bookedAppointment) return;
  
    try {
      const todayStr = formatDateToYYYYMMDD(new Date());
      // Fetch appointments for today that are upcoming, customer-initiated-check-in, barber-initiated-check-in, or in-progress
      const q = query(
        collection(firestore, 'appointments'),
        where('barberId', '==', barberId),
        where('date', '==', todayStr), 
        where('status', 'in', ['upcoming', 'customer-initiated-check-in', 'barber-initiated-check-in', 'in-progress']),
        orderBy('startTime') 
      );
  
      const snapshot = await getDocs(q);
      let todaysOpenAppointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      
      // Ensure the newly booked appointment is in the list if it's for today and matches criteria
      if (bookedAppointment.date === todayStr && 
          ['upcoming', 'customer-initiated-check-in', 'barber-initiated-check-in', 'in-progress'].includes(bookedAppointment.status) &&
          !todaysOpenAppointments.find(app => app.id === bookedAppointment.id)) {
          todaysOpenAppointments.push(bookedAppointment);
          // Re-sort if added
          todaysOpenAppointments.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      }
  
      let position = -1;
      let waitTime = 0;
      let servingName: string | null = null;
      let userIsNext = false;
      let foundCurrentUserInQueue = false;
  
      const currentAppointmentIndex = todaysOpenAppointments.findIndex(app => app.id === bookedAppointment.id);

      if (currentAppointmentIndex !== -1) {
        position = currentAppointmentIndex + 1;
        foundCurrentUserInQueue = true;

        // Calculate wait time based on appointments before the current user's
        for (let i = 0; i < currentAppointmentIndex; i++) {
          const app = todaysOpenAppointments[i];
          const serviceDetails = services.find(s => s.id === app.serviceId) || { duration: 30 }; // Default duration if service not found
          
          if (app.status === 'in-progress') {
             // Estimate remaining time for in-progress appointment
             const startedAt = app.serviceActuallyStartedAt?.toDate() || new Date(app.date + 'T' + app.startTime); // Fallback to startTime
             const elapsedMinutes = (new Date().getTime() - startedAt.getTime()) / (1000 * 60);
             waitTime += Math.max(0, serviceDetails.duration - elapsedMinutes);
          } else {
            // For upcoming or checked-in (but not started), add full duration
            waitTime += serviceDetails.duration;
          }
        }
        
        // Determine who is currently being served
        const currentlyInProgress = todaysOpenAppointments.find(app => app.status === 'in-progress');
        if (currentlyInProgress && currentlyInProgress.id !== bookedAppointment.id) {
            servingName = currentlyInProgress.customerName;
        }

        // Check if current user is next
        if (position === 1 && !currentlyInProgress) { // User is first and no one is being served
            userIsNext = true;
        } else if (currentlyInProgress && position === (todaysOpenAppointments.findIndex(app => app.id === currentlyInProgress.id) + 2) ) {
            // User is right after the one being served
            userIsNext = true;
        }
      }
      
      // If the booked appointment itself is 'in-progress', then wait time is 0, position is effectively 1 (being served)
      if (bookedAppointment.status === 'in-progress') {
          waitTime = 0;
          position = 1; 
          userIsNext = false; // Not "next" because they are "current"
          servingName = bookedAppointment.customerName;
      }


      setQueuePosition(position > 0 ? position : null);
      setEstimatedWaitTime(waitTime > 0 ? Math.round(waitTime) : null);
      setCurrentlyServingCustomerName(servingName);
      setIsCurrentUserNext(userIsNext);
      setBookingStep('queued');

    } catch (error) {
      console.error("Error calculating queue info:", error);
      toast({ title: "Queue Error", description: "Could not retrieve current queue information.", variant: "destructive" });
      setBookingStep('confirmed'); // Fallback to standard confirmation if queue info fails
    }
  };

  const handleConfirmBooking = async () => {
    if (!user || !selectedService || !selectedTimeSlot || !barber || !selectedDate) {
      toast({ title: "Error", description: "Missing booking information.", variant: "destructive" });
      return;
    }
     if (barber.isAcceptingBookings === false) { // Check again before final submission
      toast({ title: "Booking Not Allowed", description: "This barber is not currently accepting new online bookings.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);

    const selectedDateStr = formatDateToYYYYMMDD(selectedDate);
    // Rule 1: One appointment per day with ANY barber
    const dailyBookingsWithAnyBarber = customerExistingAppointments.filter(
      app => app.date === selectedDateStr && app.customerId === user.uid && app.status !== 'cancelled'
    );
    if (dailyBookingsWithAnyBarber.length >= 1) {
      toast({
        title: "Booking Limit Reached",
        description: "You can only book one appointment per day across all barbers.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Rule 2: Max two appointments per week with ANY barber
    const { weekStart, weekEnd } = getWeekBoundaries(selectedDate);
    const weeklyBookingsWithAnyBarber = customerExistingAppointments.filter(app => {
      const appDate = new Date(app.date + 'T00:00:00'); // Ensure local date interpretation
      return app.customerId === user.uid &&
             app.status !== 'cancelled' &&
             appDate >= weekStart &&
             appDate <= weekEnd;
    });

    if (weeklyBookingsWithAnyBarber.length >= 2) {
      toast({
        title: "Booking Limit Reached",
        description: "You can only book two appointments per week across all barbers.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const appointmentDate = formatDateToYYYYMMDD(selectedDate);
      const appointmentStartTime = selectedTimeSlot;
      const serviceDuration = selectedService.duration;
      const appointmentEndTime = minutesToTime(timeToMinutes(appointmentStartTime) + serviceDuration);
      const now = Timestamp.now();

      const newAppointmentData: Omit<Appointment, 'id'> = {
        barberId: barber.uid, 
        barberName: `${barber.firstName} ${barber.lastName}`,
        customerId: user.uid,
        customerName: `${user.firstName} ${user.lastName}`,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        date: appointmentDate,
        startTime: appointmentStartTime,
        endTime: appointmentEndTime,
        status: 'upcoming', // Initial status
        createdAt: now,
        updatedAt: now,
        customerCheckedInAt: null,
        barberCheckedInAt: null,
        serviceActuallyStartedAt: null,
        customerMarkedDoneAt: null,
        barberMarkedDoneAt: null,
        serviceActuallyCompletedAt: null,
      };

      const docRef = await addDoc(collection(firestore, 'appointments'), newAppointmentData);
      const finalAppointment: Appointment = { id: docRef.id, ...newAppointmentData };
      setNewlyBookedAppointment(finalAppointment);
      
      // Add to local list of customer appointments to ensure validation works for immediate re-booking attempts
      setCustomerExistingAppointments(prev => [...prev, finalAppointment]);

      toast({ title: "Booking Confirmed!", description: "Your appointment has been successfully booked." });
      
      // If appointment is for today, try to fetch queue info
      if (finalAppointment.date === formatDateToYYYYMMDD(new Date())) { 
        await fetchAndCalculateQueueInfo(finalAppointment);
      } else {
        setBookingStep('confirmed'); // If not for today, just show standard confirmation
      }

    } catch (error) {
      console.error("Error confirming booking:", error);
      toast({ title: "Booking Failed", description: "Could not confirm your appointment. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepProgress = () => {
    if (bookingStep === 'confirmed' || bookingStep === 'queued') return null;
    
    const currentStepNumber = bookingStepNumbers[bookingStep];
    const currentStepTitle = bookingStepTitles[bookingStep];
    const progressValue = (currentStepNumber / totalBookingSteps) * 100;

    return (
      <div className="mb-6 space-y-2">
        <p className="text-sm text-muted-foreground">
          Step {currentStepNumber} of {totalBookingSteps}: <span className="font-semibold text-foreground">{currentStepTitle}</span>
        </p>
        <Progress value={progressValue} className="w-full h-2 rounded-full" />
      </div>
    );
  };


  if (isLoadingBarberDetails || isLoadingCustomerAppointments) {
    return (
      <ProtectedPage expectedRole="customer">
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
          <LoadingSpinner className="h-12 w-12 text-primary" />
          <p className="ml-3 text-base">Loading barber details and your appointments...</p>
        </div>
      </ProtectedPage>
    );
  }

  if (!barber) { // Should be caught by fetch logic, but good fallback
    return (
      <ProtectedPage expectedRole="customer">
        <div className="text-center py-10">
          <AlertCircle className="mx-auto h-16 w-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold text-destructive">Barber not found.</h2>
          <Button onClick={() => router.push('/customer/dashboard')} className="mt-6 h-14 rounded-full px-8 text-lg">Go Back</Button>
        </div>
      </ProtectedPage>
    );
  }
  
  // Check if barber is accepting bookings (value could be false, so check explicitly)
  const barberIsAcceptingBookings = barber.isAcceptingBookings !== undefined ? barber.isAcceptingBookings : true;

  if (!barberIsAcceptingBookings && bookingStep !== 'confirmed' && bookingStep !== 'queued') {
    return (
      <ProtectedPage expectedRole="customer">
        <div className="space-y-6 max-w-xl mx-auto text-center py-10">
          <AlertTriangle className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
          <h1 className="text-2xl font-bold font-headline">
            Booking Not Available
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            {barber.firstName} {barber.lastName} is not currently accepting new online bookings. Please check back later or contact them directly.
          </p>
          <Button onClick={() => router.push(`/customer/view-barber/${barberId}`)} className="mt-6 h-12 rounded-full px-6 text-base">
            Back to Barber's Profile
          </Button>
        </div>
      </ProtectedPage>
    );
  }

  const renderStepContent = () => {
    switch (bookingStep) {
      case 'selectService':
        return (
          <Card className="border-none shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
              <CardTitle className="text-xl font-bold">Select a Service</CardTitle>
              <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">Choose from the services offered by {barber.firstName || 'this barber'}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 md:p-6">
              {services.length === 0 ? (
                <div className="text-center py-6">
                  <Info className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-base text-gray-500 dark:text-gray-400">This barber has not listed any services yet.</p>
                </div>
              ) : (
                services.map(service => (
                  <Button
                    key={service.id}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-4 px-4 rounded-lg border shadow-sm hover:bg-accent/50 hover:shadow-md transition-all duration-150"
                    onClick={() => handleServiceSelect(service.id)}
                  >
                    <div className="flex flex-col flex-grow">
                      <span className="font-semibold text-base">{service.name}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <DollarSign className="inline h-4 w-4 mr-1" />{service.price.toFixed(2)}
                        <Clock className="inline h-4 w-4 ml-3 mr-1" />
                        <span className="text-primary">{service.duration} min</span>
                      </span>
                    </div>
                    <ChevronLeft className="h-5 w-5 ml-auto text-gray-400 transform rotate-180 flex-shrink-0" />
                  </Button>
                ))
              )}
            </CardContent>
          </Card>
        );

      case 'selectDateTime':
        const isDateUnavailable = barberUnavailableDates.some(ud => ud.date === formatDateToYYYYMMDD(selectedDate));
        return (
          <Card className="border-none shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
              <CardTitle className="text-xl font-bold">Pick Date & Time</CardTitle>
              <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Selected service: <span className="font-semibold text-foreground">{selectedService?.name}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-4 md:p-6">
              {/* Barber's Weekly Availability Display */}
              {schedule.length > 0 && (
                <div className="mb-6 p-4 border rounded-lg bg-card shadow-sm">
                  <h4 className="text-md font-semibold mb-3 text-foreground flex items-center">
                    <Info className="h-5 w-5 mr-2 text-primary" />
                    Barber's Weekly Availability
                  </h4>
                  <div className="space-y-1.5">
                    {daysOfWeekOrder.map(dayName => {
                      const dayInfo = schedule.find(s => s.day === dayName);
                      if (!dayInfo) return null; // Should not happen if schedule is complete
                      return (
                        <div key={dayInfo.day} className="flex justify-between items-center text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{dayInfo.day}</span>
                          {dayInfo.isOpen ? (
                            <span className="font-medium text-primary">{dayInfo.startTime} &ndash; {dayInfo.endTime}</span>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">Closed</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Date Picker */}
              <div>
                <Label className="text-base font-medium mb-2 block">Select Date</Label>
                 <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full sm:w-[280px] justify-start text-left font-normal h-12 text-base mb-1 rounded-md",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {selectedDate ? formatSelectedDateForDisplay(selectedDate) : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-lg">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        disabled={(date) =>
                          date < today || 
                          date > sevenDaysFromNow || 
                          barberUnavailableDates.some(ud => ud.date === formatDateToYYYYMMDD(date)) // Disable if barber marked date unavailable
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {isDateUnavailable && ( // Show message if selected date is specifically marked unavailable
                    <p className="text-sm text-destructive flex items-center mt-1 mb-4">
                        <Ban className="h-4 w-4 mr-1.5" /> This date is unavailable.
                    </p>
                  )}
              </div>

              {/* Time Slot Selector */}
              <div>
                <Label className="text-base font-medium mb-3 block">Select Time Slot</Label>
                {isDateUnavailable ? ( // If date is marked as unavailable by barber
                     <p className="text-sm text-destructive">The barber is unavailable on this selected date.</p>
                ) : availableTimeSlots.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {availableTimeSlots.map(slot => (
                      <Button
                        key={slot}
                        variant={selectedTimeSlot === slot ? 'default' : 'outline'}
                        onClick={() => handleTimeSlotSelect(slot)}
                        className="h-12 rounded-md text-base"
                      >
                        <span className={selectedTimeSlot === slot ? "" : "text-primary"}>{slot}</span>
                      </Button>
                    ))}
                  </div>
                ) : ( // No slots available for other reasons (booked, closed, etc.)
                  <p className="text-sm text-gray-500 dark:text-gray-400">No available time slots for the selected service and date. This could be because all slots are booked, the barber is closed, or it's too late to book for today. Check the barber's weekly availability or try a different date/service.</p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-center pt-6 space-y-3 sm:space-y-0 sm:space-x-3 border-t mt-4">
                <Button variant="outline" onClick={() => setBookingStep('selectService')} className="w-full sm:w-auto h-12 rounded-full text-base">
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back to Services
                </Button>
                <Button onClick={handleProceedToConfirm} disabled={!selectedTimeSlot || !selectedService || isDateUnavailable} className="w-full sm:w-auto h-12 rounded-full text-base">
                  Proceed to Confirmation <Forward className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'confirm':
        return (
          <Card className="border-none shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
              <CardTitle className="text-xl font-bold">Confirm Booking</CardTitle>
              <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">Please review your appointment details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-6">
              <div className="space-y-2 text-base border rounded-lg p-4 shadow-sm bg-card">
                 <p className="font-semibold text-lg text-primary mb-3">Review Details:</p>
                <p><Scissors className="inline mr-2 h-5 w-5 text-gray-500 dark:text-gray-400" /> Service: <span className="font-medium">{selectedService?.name}</span></p>
                <p><UserCircleIcon className="inline mr-2 h-5 w-5 text-gray-500 dark:text-gray-400" /> With: <span className="font-medium">{barber.firstName} {barber.lastName}</span></p>
                <p><CalendarDays className="inline mr-2 h-5 w-5 text-gray-500 dark:text-gray-400" /> Date: <span className="font-medium">{selectedDate ? formatSelectedDateForDisplay(selectedDate) : ''}</span></p>
                <p><Clock className="inline mr-2 h-5 w-5 text-gray-500 dark:text-gray-400" /> Time: <span className="font-medium text-primary">{selectedTimeSlot}</span></p>
                <p><DollarSign className="inline mr-2 h-5 w-5 text-gray-500 dark:text-gray-400" /> Price: <span className="font-medium">${selectedService?.price.toFixed(2)}</span></p>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-center pt-6 space-y-3 sm:space-y-0 sm:space-x-3 border-t mt-4">
                <Button variant="outline" onClick={() => setBookingStep('selectDateTime')} className="w-full sm:w-auto h-12 rounded-full text-base">
                     <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleConfirmBooking} className="w-full sm:w-auto h-14 rounded-full text-lg" disabled={isSubmitting || isLoadingCustomerAppointments}>
                  {(isSubmitting || isLoadingCustomerAppointments) && <LoadingSpinner className="mr-2 h-5 w-5" />}
                  <Check className="mr-2 h-5 w-5" /> {(isSubmitting || isLoadingCustomerAppointments) ? 'Validating...' : 'Confirm Booking'}
                </Button>
              </div>
            </CardContent>
          </Card>
        );

        case 'confirmed': // Standard confirmation if not for today or queue info fails
            return (
              <Card className="text-center border-none shadow-lg rounded-xl overflow-hidden p-4 md:p-6">
                <CardHeader className="pt-4 pb-2">
                  <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
                  <CardTitle className="text-2xl font-bold">Booking Confirmed!</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-base pt-2">
                  <p>Your appointment for <span className="font-semibold">{newlyBookedAppointment?.serviceName}</span></p>
                  <p>with <span className="font-semibold">{barber.firstName} {barber.lastName}</span></p>
                  <p>on <span className="font-semibold">{formatYYYYMMDDToDisplay(newlyBookedAppointment?.date || '')} at <span className="text-primary">{newlyBookedAppointment?.startTime}</span></span></p>
                  <p>has been successfully booked.</p>
                  <Button onClick={() => router.push('/customer/dashboard')} className="mt-8 w-full max-w-xs mx-auto h-14 rounded-full text-lg">
                    <LayoutDashboard className="mr-2 h-5 w-5" /> Back to Dashboard
                  </Button>
                </CardContent>
              </Card>
            );
        
        case 'queued': // Special confirmation screen if appointment is for today showing queue info
            return (
                <Card className="text-center border-none shadow-lg rounded-xl overflow-hidden p-4 md:p-6">
                <CardHeader className="pt-4 pb-2">
                    {isCurrentUserNext && <AlertCircle className="mx-auto h-16 w-16 text-primary mb-4" />}
                    {!isCurrentUserNext && queuePosition && <Users className="mx-auto h-16 w-16 text-primary mb-4" />}
                    <CardTitle className="text-2xl font-bold">
                    {isCurrentUserNext ? "You're Next!" : (queuePosition ? `You are #${queuePosition} in line` : "Queue Information")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-base pt-2">
                    {newlyBookedAppointment && barber && ( // Ensure these are available
                    <div className="pb-3 mb-4 border-b border-border">
                        <p className="text-lg font-semibold text-foreground">Your Appointment:</p>
                        <p><span className="font-medium">{newlyBookedAppointment.serviceName}</span> with <span className="font-medium">{barber.firstName} {barber.lastName}</span></p>
                        <p>Today at <span className="font-medium text-primary">{newlyBookedAppointment.startTime}</span>.</p>
                    </div>
                    )}

                    <div className="space-y-1.5">
                        {isCurrentUserNext && (
                             <p className="text-xl font-semibold text-green-600">You are next in line! Please proceed to the barbershop.</p>
                        )}
                        {queuePosition && !isCurrentUserNext && (
                             <p className="text-lg">Your position: <span className="font-bold text-2xl text-primary">#{queuePosition}</span></p>
                        )}
                        {estimatedWaitTime !== null && estimatedWaitTime > 0 && !isCurrentUserNext && (
                        <p className="text-md">Estimated wait: <span className="font-semibold text-primary">~{estimatedWaitTime} minutes</span></p>
                        )}
                        {currentlyServingCustomerName && (
                        <p className="text-sm text-muted-foreground">Currently serving: <span className="font-medium text-foreground">{currentlyServingCustomerName}</span>.</p>
                        )}
                        {!currentlyServingCustomerName && queuePosition === 1 && !isCurrentUserNext && ( // User is #1 but no one is being served yet
                             <p className="text-md text-muted-foreground">You are at the front of the queue. The barber will call you shortly.</p>
                        )}
                    </div>

                    <p className="text-xs text-muted-foreground pt-4">
                        Note: Queue information is based on current bookings and may change. Please arrive on time for your appointment.
                    </p>
                    <Button onClick={() => router.push('/customer/dashboard')} className="mt-6 w-full max-w-xs mx-auto h-14 rounded-full text-lg">
                     <LayoutDashboard className="mr-2 h-5 w-5" /> Back to Dashboard
                    </Button>
                </CardContent>
                </Card>
            );

      default:
        return null;
    }
  };

  return (
    <ProtectedPage expectedRole="customer">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-headline">
            Book with {barber.firstName || APP_NAME}
            </h1>
            {/* Allow cancellation only before confirmation step or if not already confirmed/queued */}
            { bookingStep !== 'selectService' && bookingStep !== 'queued' && bookingStep !== 'confirmed' && (
                 <Button variant="ghost" onClick={() => router.push('/customer/dashboard')} className="text-sm text-primary hover:bg-destructive/10 hover:text-destructive rounded-full px-3 py-1.5">
                    <X className="mr-1.5 h-4 w-4"/> Cancel Booking
                </Button>
            )}
        </div>
        {renderStepProgress()}
        {renderStepContent()}
      </div>
    </ProtectedPage>
  );
}
