
'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { BarberService, Appointment, DayOfWeek, BarberScheduleDoc, UnavailableDate, AppointmentStatus } from '@/types';
import TodaysAppointmentsSection from '@/components/barber/TodaysAppointmentsSection';
import { firestore } from '@/firebase/config';
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
  writeBatch,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { PlusCircle, Settings2, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getItemWithTimestampRevival, setItemWithTimestampConversion, LS_SERVICES_KEY_DASHBOARD, LS_APPOINTMENTS_KEY_DASHBOARD } from '@/lib/localStorageUtils';
import type { DayAvailability as ScheduleDayAvailability } from '@/types';
import { getDoc as getFirestoreDoc } from 'firebase/firestore';
// import Link from 'next/link'; // No longer used
import { Alert, AlertDescription } from '@/components/ui/alert';


const WalkInDialog = dynamic(() => import('@/components/barber/WalkInDialog'), {
  loading: () => <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[100]"><LoadingSpinner className="h-8 w-8 text-primary" /></div>,
  ssr: false
});

const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
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

const minutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const period = h < 12 || h === 24 ? 'AM' : 'PM';
  return `${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

const INITIAL_SCHEDULE_FOR_WALKIN_CHECK: ScheduleDayAvailability[] = (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as DayOfWeek[]).map(day => ({
  day,
  isOpen: !['Saturday', 'Sunday'].includes(day),
  startTime: '09:00 AM',
  endTime: '05:00 PM',
}));


export default function BarberDashboardPage() {
  const { user, updateUserAcceptingBookings } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<BarberService[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barberScheduleForWalkin, setBarberScheduleForWalkin] = useState<ScheduleDayAvailability[]>(INITIAL_SCHEDULE_FOR_WALKIN_CHECK);
  const [barberUnavailableDatesForWalkin, setBarberUnavailableDatesForWalkin] = useState<UnavailableDate[]>([]);

  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [isUpdatingAppointment, setIsUpdatingAppointment] = useState<string | null>(null); // Store ID of appointment being updated
  const [isWalkInDialogOpen, setIsWalkInDialogOpen] = useState(false);
  const [isProcessingWalkIn, setIsProcessingWalkIn] = useState(false);
  const [isLoadingBarberSelfData, setIsLoadingBarberSelfData] = useState(true);

  const [localIsAcceptingBookings, setLocalIsAcceptingBookings] = useState(true);
  const [isUpdatingAcceptingBookings, setIsUpdatingAcceptingBookings] = useState(false);

  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    setInitialLoadComplete(true);
  }, []);

 useEffect(() => {
    if (user) {
      setLocalIsAcceptingBookings(user.isAcceptingBookings !== undefined ? user.isAcceptingBookings : true);
    }
  }, [user]);


  useEffect(() => {
    if (initialLoadComplete) {
      const cachedServices = getItemWithTimestampRevival<BarberService[]>(LS_SERVICES_KEY_DASHBOARD);
      if (cachedServices) {
        setServices(cachedServices);
        setIsLoadingServices(false);
      }
      const cachedAppointments = getItemWithTimestampRevival<Appointment[]>(LS_APPOINTMENTS_KEY_DASHBOARD);
      if (cachedAppointments) {
        setAppointments(cachedAppointments);
        setIsLoadingAppointments(false);
      }
    }
  }, [initialLoadComplete]);

  const fetchServices = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingServices(true);
    try {
      const servicesCollection = collection(firestore, 'services');
      const q = query(servicesCollection, where('barberId', '==', user.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedServices: BarberService[] = [];
      querySnapshot.forEach((doc) => {
        fetchedServices.push({ id: doc.id, ...doc.data() } as BarberService);
      });
      setServices(fetchedServices);
      setItemWithTimestampConversion(LS_SERVICES_KEY_DASHBOARD, fetchedServices);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({ title: "Error", description: "Could not fetch services for Walk-In.", variant: "destructive" });
    } finally {
      setIsLoadingServices(false);
    }
  }, [user?.uid, toast]);

  const fetchAppointments = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingAppointments(true);
    try {
      const appointmentsCollection = collection(firestore, 'appointments');
      const q = query(appointmentsCollection, where('barberId', '==', user.uid), orderBy('date', 'asc'), orderBy('startTime'));
      const querySnapshot = await getDocs(q);
      const fetchedAppointments: Appointment[] = [];
      querySnapshot.forEach((doc) => {
        fetchedAppointments.push({ id: doc.id, ...doc.data() } as Appointment);
      });
      setAppointments(fetchedAppointments);
      setItemWithTimestampConversion(LS_APPOINTMENTS_KEY_DASHBOARD, fetchedAppointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({ title: "Error", description: "Could not fetch appointments.", variant: "destructive" });
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [user?.uid, toast]);

  const handleAppointmentAction = async (appointmentId: string, action: 'BARBER_CHECK_IN' | 'BARBER_CONFIRM_START' | 'BARBER_MARK_DONE' | 'BARBER_CONFIRM_COMPLETION') => {
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
      const currentAppointment = appointments.find(app => app.id === appointmentId);
      if (!currentAppointment) {
        toast({ title: "Error", description: "Appointment not found.", variant: "destructive" });
        setIsUpdatingAppointment(null);
        return;
      }

      switch (action) {
        case 'BARBER_CHECK_IN': // Barber records customer arrival
          updateData.barberCheckedInAt = now;
          if (currentAppointment.customerCheckedInAt) {
            newStatus = 'in-progress';
            updateData.serviceActuallyStartedAt = now;
            successMessage = "Service started with customer.";
          } else {
            newStatus = 'barber-initiated-check-in';
            successMessage = "Customer arrival recorded. Waiting for customer to confirm check-in if booked.";
          }
          break;

        case 'BARBER_CONFIRM_START': // Barber confirms customer's check-in and starts service
          if (currentAppointment.status === 'customer-initiated-check-in') {
            updateData.barberCheckedInAt = now;
            updateData.serviceActuallyStartedAt = now;
            newStatus = 'in-progress';
            successMessage = "Service started.";
          } else if (currentAppointment.customerId === null && currentAppointment.status === 'barber-initiated-check-in') { // Walk-in, barber is starting it
            updateData.serviceActuallyStartedAt = now;
            newStatus = 'in-progress';
            successMessage = "Walk-in service started.";
          }
          break;

        case 'BARBER_MARK_DONE': // Barber marks their part as done
          updateData.barberMarkedDoneAt = now;
          if (currentAppointment.customerMarkedDoneAt || currentAppointment.customerId === null) { // If customer also done OR it's a walk-in
            newStatus = 'completed';
            updateData.serviceActuallyCompletedAt = now;
            successMessage = currentAppointment.customerId === null ? "Walk-in service completed." : "Service mutually completed.";
          } else {
            newStatus = 'barber-initiated-completion';
            successMessage = "Service marked as done by you. Waiting for customer confirmation.";
          }
          break;

        case 'BARBER_CONFIRM_COMPLETION': // Barber confirms customer's completion mark
           if (currentAppointment.status === 'customer-initiated-completion') {
            updateData.barberMarkedDoneAt = now;
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

      setAppointments(prev => {
        const updatedList = prev.map(app =>
          app.id === appointmentId ? { ...app, ...updateData, status: newStatus || app.status } : app
        );
        setItemWithTimestampConversion(LS_APPOINTMENTS_KEY_DASHBOARD, updatedList);
        return updatedList;
      });
      toast({ title: "Success", description: successMessage || `Appointment updated.` });

    } catch (error) {
      console.error("Error updating appointment:", error);
      toast({ title: "Error", description: "Could not update appointment status.", variant: "destructive" });
    } finally {
      setIsUpdatingAppointment(null);
    }
  };


  const fetchBarberSelfDataForWalkIn = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingBarberSelfData(true);
    try {
      const scheduleDocRef = doc(firestore, 'barberSchedules', user.uid);
      const scheduleSnap = await getFirestoreDoc(scheduleDocRef);
      if (scheduleSnap.exists()) {
        setBarberScheduleForWalkin((scheduleSnap.data() as BarberScheduleDoc).schedule);
      } else {
        setBarberScheduleForWalkin(INITIAL_SCHEDULE_FOR_WALKIN_CHECK);
      }

      const unavailableDatesColRef = collection(firestore, `barberSchedules/${user.uid}/unavailableDates`);
      const unavailableDatesQuery = query(unavailableDatesColRef);
      const unavailableDatesSnapshot = await getDocs(unavailableDatesQuery);
      const fetchedUnavailable: UnavailableDate[] = [];
      unavailableDatesSnapshot.forEach((d) => {
        fetchedUnavailable.push({ id: d.id, ...d.data() } as UnavailableDate);
      });
      setBarberUnavailableDatesForWalkin(fetchedUnavailable);

    } catch (error) {
      console.error("Error fetching barber's own schedule/unavailable dates for walk-in:", error);
      toast({ title: "Error", description: "Could not load barber's availability for walk-in validation.", variant: "destructive" });
    } finally {
      setIsLoadingBarberSelfData(false);
    }
  }, [user?.uid, toast]);

  const handleSaveWalkIn = async (serviceId: string, customerName: string) => {
    if (!user || !user.uid || !user.firstName || !user.lastName) {
      toast({ title: "Error", description: "User information is incomplete.", variant: "destructive" });
      return;
    }
    if (isLoadingBarberSelfData) {
      toast({ title: "Please Wait", description: "Still loading barber's availability for validation.", variant: "default" });
      return;
    }
    setIsProcessingWalkIn(true);

    const selectedService = services.find(s => s.id === serviceId);
    if (!selectedService) {
      toast({ title: "Error", description: "Selected service not found.", variant: "destructive" });
      setIsProcessingWalkIn(false);
      return;
    }

    const todayDateStr = formatDateToYYYYMMDD(new Date());
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' }) as DayOfWeek;
    const daySchedule = barberScheduleForWalkin.find(d => d.day === dayOfWeek);

    if (!daySchedule || !daySchedule.isOpen) {
      toast({ title: "Barber Closed", description: "Cannot add walk-in. Barber is closed today according to schedule.", variant: "destructive" });
      setIsProcessingWalkIn(false);
      return;
    }

    if (barberUnavailableDatesForWalkin.some(ud => ud.date === todayDateStr)) {
        toast({ title: "Barber Unavailable", description: "Cannot add walk-in. Barber is marked as unavailable today.", variant: "destructive" });
        setIsProcessingWalkIn(false);
        return;
    }

    const serviceDuration = selectedService.duration;
    const scheduleStartTimeMinutes = timeToMinutes(daySchedule.startTime);
    const scheduleEndTimeMinutes = timeToMinutes(daySchedule.endTime);

    const now = new Date();
    const nowTimestamp = Timestamp.fromDate(now);
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    const earliestPossibleStartMinutes = Math.max(scheduleStartTimeMinutes, currentTimeMinutes + 5); // 5 min buffer

    const todaysAppointmentsForSlotFinding = appointments
      .filter(app => app.date === todayDateStr && app.status !== 'cancelled' && app.status !== 'completed')
      .map(app => ({
        start: timeToMinutes(app.startTime),
        end: app.serviceActuallyStartedAt && app.status === 'in-progress'
               ? timeToMinutes(app.startTime) + selectedService.duration // Use actual start + duration for in-progress
               : timeToMinutes(app.endTime), // Otherwise, use original estimate
      }))
      .sort((a, b) => a.start - b.start);

    let foundSlotStartMinutes: number | null = null;

    for (let potentialStart = earliestPossibleStartMinutes; potentialStart + serviceDuration <= scheduleEndTimeMinutes; potentialStart += 15) {
        const potentialEnd = potentialStart + serviceDuration;
        const isSlotFree = !todaysAppointmentsForSlotFinding.some(
            bookedSlot => potentialStart < bookedSlot.end && potentialEnd > bookedSlot.start
        );
        if (isSlotFree) {
            foundSlotStartMinutes = potentialStart;
            break;
        }
    }
    
    if (foundSlotStartMinutes === null) {
      const lastAppointmentEnd = todaysAppointmentsForSlotFinding.length > 0 ? todaysAppointmentsForSlotFinding[todaysAppointmentsForSlotFinding.length - 1].end : scheduleStartTimeMinutes;
      const potentialStartAfterLast = Math.max(earliestPossibleStartMinutes, lastAppointmentEnd);
      if (potentialStartAfterLast + serviceDuration <= scheduleEndTimeMinutes) {
          const potentialEnd = potentialStartAfterLast + serviceDuration;
           const isSlotFree = !todaysAppointmentsForSlotFinding.some(
            bookedSlot => potentialStartAfterLast < bookedSlot.end && potentialEnd > bookedSlot.start
          );
          if(isSlotFree){
            foundSlotStartMinutes = potentialStartAfterLast;
          }
      }
    }


    if (foundSlotStartMinutes === null) {
      toast({ title: "No Slot Available", description: "Could not find an immediate available time slot for this service.", variant: "destructive" });
      setIsProcessingWalkIn(false);
      return;
    }

    const appointmentStartTime = minutesToTime(foundSlotStartMinutes);
    const appointmentEndTime = minutesToTime(foundSlotStartMinutes + serviceDuration);

    try {
      const newAppointmentData: Omit<Appointment, 'id'> = {
        barberId: user.uid,
        barberName: `${user.firstName} ${user.lastName}`,
        customerId: null, // Walk-in
        customerName: customerName,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        date: todayDateStr,
        startTime: appointmentStartTime,
        endTime: appointmentEndTime, // Original estimated end time
        status: 'in-progress', // Walk-ins start as in-progress
        createdAt: nowTimestamp,
        updatedAt: nowTimestamp,
        barberCheckedInAt: nowTimestamp, // Barber is checking them in
        customerCheckedInAt: nowTimestamp, // Implicit customer check-in for walk-in
        serviceActuallyStartedAt: nowTimestamp, // Service starts immediately
        customerMarkedDoneAt: null,
        barberMarkedDoneAt: null,
        serviceActuallyCompletedAt: null,
      };

      const docRef = await addDoc(collection(firestore, 'appointments'), newAppointmentData);
      const finalAppointment: Appointment = { id: docRef.id, ...newAppointmentData };

      setAppointments(prev => {
        const updated = [...prev, finalAppointment].sort((a,b) => {
            if (a.date === b.date) return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
        setItemWithTimestampConversion(LS_APPOINTMENTS_KEY_DASHBOARD, updated);
        return updated;
      });

      toast({ title: "Walk-In Added!", description: `${customerName}'s appointment for ${selectedService.name} at ${appointmentStartTime} has been added and started.` });
      setIsWalkInDialogOpen(false);
    } catch (error) {
      console.error("Error adding walk-in appointment:", error);
      toast({ title: "Error", description: "Could not add walk-in appointment.", variant: "destructive" });
    } finally {
      setIsProcessingWalkIn(false);
    }
  };

  const handleToggleAcceptingBookings = async (newCheckedState: boolean) => {
    if (!user || !updateUserAcceptingBookings) return;

    setLocalIsAcceptingBookings(newCheckedState);
    setIsUpdatingAcceptingBookings(true);
    try {
      await updateUserAcceptingBookings(user.uid, newCheckedState);
      toast({
        title: "Status Updated",
        description: `You are now ${newCheckedState ? 'accepting' : 'not accepting'} new online bookings.`,
      });
    } catch (error) {
      console.error("Error updating accepting bookings status:", error);
      toast({ title: "Error", description: "Could not update your booking status.", variant: "destructive" });
      setLocalIsAcceptingBookings(!newCheckedState); // Revert on error
    } finally {
      setIsUpdatingAcceptingBookings(false);
    }
  };

  useEffect(() => {
    if (user?.uid && initialLoadComplete) {
      fetchServices();
      fetchAppointments();
      fetchBarberSelfDataForWalkIn();
    }
  }, [user?.uid, fetchServices, fetchAppointments, fetchBarberSelfDataForWalkIn, initialLoadComplete]);

  const isAddWalkInDisabled = isProcessingWalkIn || isLoadingServices || services.length === 0 || isLoadingBarberSelfData;
  
  let walkInTooltipMessage = null;
  if (isLoadingServices || isLoadingBarberSelfData) {
    walkInTooltipMessage = "Loading necessary data...";
  } else if (services.length === 0) {
    walkInTooltipMessage = "Please add services first to enable walk-ins.";
  } else if (isProcessingWalkIn) {
    walkInTooltipMessage = "Processing previous walk-in...";
  }


  return (
    <ProtectedPage expectedRole="barber">
      <TooltipProvider>
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h1 className="text-2xl font-bold font-headline">
              Welcome, {user?.firstName || user?.displayName || 'Barber'}!
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={isAddWalkInDisabled ? 0 : -1}> {/* For Tooltip to work on disabled button */}
                    <Button
                      onClick={() => setIsWalkInDialogOpen(true)}
                      className="w-full sm:w-auto h-11 rounded-full px-6 text-base"
                      disabled={isAddWalkInDisabled}
                      aria-describedby={isAddWalkInDisabled ? "add-walkin-tooltip" : undefined}
                    >
                        <PlusCircle className="mr-2 h-5 w-5" />
                        Add Walk-In
                    </Button>
                  </span>
                </TooltipTrigger>
                {walkInTooltipMessage && (
                  <TooltipContent id="add-walkin-tooltip">
                    <p>{walkInTooltipMessage}</p>
                  </TooltipContent>
                )}
              </Tooltip>
          </div>


          <Card className="border-none shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
              <CardTitle className="text-xl font-bold flex items-center">
                <Settings2 className="mr-2 h-5 w-5 text-primary" />
                Online Booking Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              {user ? (
                <div className="flex items-center space-x-3">
                  <Switch
                    id="accepting-bookings-toggle"
                    checked={localIsAcceptingBookings}
                    onCheckedChange={handleToggleAcceptingBookings}
                    disabled={isUpdatingAcceptingBookings}
                    aria-label="Toggle accepting new online bookings"
                  />
                  <Label htmlFor="accepting-bookings-toggle" className="text-base">
                    {localIsAcceptingBookings ? 'Accepting New Online Bookings' : 'Not Accepting New Online Bookings'}
                  </Label>
                  {isUpdatingAcceptingBookings && <LoadingSpinner className="h-5 w-5 text-primary ml-2" />}
                </div>
              ) : (
                <div className="flex items-center">
                   <LoadingSpinner className="h-5 w-5 text-primary mr-2" />
                   <p>Loading booking status...</p>
                </div>
              )}
               <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Turn this off to temporarily prevent new customers from booking online. Existing appointments will not be affected.
              </p>
            </CardContent>
          </Card>

          {(isLoadingAppointments && !appointments.length) ? (
            <div className="flex justify-center items-center py-10">
              <LoadingSpinner className="h-8 w-8 text-primary" />
              <p className="ml-2 text-base">Loading appointments...</p>
            </div>
          ) : (
            <TodaysAppointmentsSection
              appointments={appointments}
              onAppointmentAction={handleAppointmentAction}
              isUpdatingAppointmentId={isUpdatingAppointment}
            />
          )}
        </div>
      </TooltipProvider>
      {isWalkInDialogOpen && (
        <WalkInDialog
            isOpen={isWalkInDialogOpen}
            onClose={() => setIsWalkInDialogOpen(false)}
            onSubmit={handleSaveWalkIn}
            services={services}
            isSubmitting={isProcessingWalkIn}
        />
      )}
    </ProtectedPage>
  );
}
