
'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { BarberService, Appointment, DayOfWeek, BarberScheduleDoc, UnavailableDate, AppointmentStatus, AppUser } from '@/types';
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
import { PlusCircle, Settings2, AlertTriangle, Info, Briefcase, Hourglass } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getItemWithTimestampRevival, setItemWithTimestampConversion, LS_SERVICES_KEY_DASHBOARD, LS_APPOINTMENTS_KEY_DASHBOARD } from '@/lib/localStorageUtils';
import type { DayAvailability as ScheduleDayAvailability } from '@/types';
import { getDoc as getFirestoreDoc } from 'firebase/firestore';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatDistanceToNowStrict } from 'date-fns';


const WalkInDialog = dynamic(() => import('@/components/barber/WalkInDialog'), {
  loading: () => <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[100]"><LoadingSpinner className="h-8 w-8 text-primary" /></div>,
  ssr: false
});

const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

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
  const { user, updateUserAcceptingBookings, updateBarberTemporaryStatus, setIsProcessingAuth } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<BarberService[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barberScheduleForWalkin, setBarberScheduleForWalkin] = useState<ScheduleDayAvailability[]>(INITIAL_SCHEDULE_FOR_WALKIN_CHECK);
  const [barberUnavailableDatesForWalkin, setBarberUnavailableDatesForWalkin] = useState<UnavailableDate[]>([]);

  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [isUpdatingAppointment, setIsUpdatingAppointment] = useState<string | null>(null);
  const [isWalkInDialogOpen, setIsWalkInDialogOpen] = useState(false);
  const [isProcessingWalkIn, setIsProcessingWalkIn] = useState(false);
  const [isLoadingBarberSelfData, setIsLoadingBarberSelfData] = useState(true);

  const [localIsAcceptingBookings, setLocalIsAcceptingBookings] = useState(true);
  const [isUpdatingAcceptingBookings, setIsUpdatingAcceptingBookings] = useState(false);
  
  const [localIsTemporarilyUnavailable, setLocalIsTemporarilyUnavailable] = useState(false);
  const [isUpdatingTemporaryStatus, setIsUpdatingTemporaryStatus] = useState(false);
  const [unavailableSinceDuration, setUnavailableSinceDuration] = useState<string | null>(null);


  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    setInitialLoadComplete(true);
  }, []);

 useEffect(() => {
    if (user) {
      setLocalIsAcceptingBookings(user.isAcceptingBookings !== undefined ? user.isAcceptingBookings : true);
      setLocalIsTemporarilyUnavailable(user.isTemporarilyUnavailable || false);
      if (user.isTemporarilyUnavailable && user.unavailableSince) {
        const calculateDuration = () => {
          setUnavailableSinceDuration(formatDistanceToNowStrict(user.unavailableSince!.toDate(), { addSuffix: true }));
        };
        calculateDuration();
        const intervalId = setInterval(calculateDuration, 60000); // Update every minute
        return () => clearInterval(intervalId);
      } else {
        setUnavailableSinceDuration(null);
      }
    }
  }, [user]);


  useEffect(() => {
    if (initialLoadComplete) {
      const cachedServices = getItemWithTimestampRevival<BarberService[]>(LS_SERVICES_KEY_DASHBOARD);
      if (cachedServices) setServices(cachedServices); setIsLoadingServices(!cachedServices);
      
      const cachedAppointments = getItemWithTimestampRevival<Appointment[]>(LS_APPOINTMENTS_KEY_DASHBOARD);
      if (cachedAppointments) setAppointments(cachedAppointments); setIsLoadingAppointments(!cachedAppointments);
    }
  }, [initialLoadComplete]);

  const fetchServices = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingServices(true);
    try {
      const servicesCollection = collection(firestore, 'services');
      const q = query(servicesCollection, where('barberId', '==', user.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedServices: BarberService[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BarberService));
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
      const fetchedAppointments: Appointment[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(fetchedAppointments);
      setItemWithTimestampConversion(LS_APPOINTMENTS_KEY_DASHBOARD, fetchedAppointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({ title: "Error", description: "Could not fetch appointments.", variant: "destructive" });
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [user?.uid, toast]);

  const handleAppointmentAction = async (appointmentId: string, action: 'BARBER_CHECK_IN' | 'BARBER_CONFIRM_START' | 'BARBER_MARK_DONE' | 'BARBER_CONFIRM_COMPLETION' | 'BARBER_MARK_NO_SHOW') => {
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
      if (!currentAppointment) throw new Error("Appointment not found.");

      switch (action) {
        case 'BARBER_CHECK_IN':
          updateData.barberCheckedInAt = now;
          newStatus = currentAppointment.customerCheckedInAt ? 'in-progress' : 'barber-initiated-check-in';
          if (newStatus === 'in-progress') updateData.serviceActuallyStartedAt = now;
          successMessage = newStatus === 'in-progress' ? "Service started." : "Customer arrival recorded.";
          break;
        case 'BARBER_CONFIRM_START':
          if (currentAppointment.status === 'customer-initiated-check-in' || (currentAppointment.customerId === null && currentAppointment.status === 'barber-initiated-check-in')) {
            updateData.barberCheckedInAt = now; updateData.serviceActuallyStartedAt = now; newStatus = 'in-progress';
            successMessage = "Service started.";
          }
          break;
        case 'BARBER_MARK_DONE':
          updateData.barberMarkedDoneAt = now;
          newStatus = (currentAppointment.customerMarkedDoneAt || currentAppointment.customerId === null) ? 'completed' : 'barber-initiated-completion';
          if (newStatus === 'completed') updateData.serviceActuallyCompletedAt = now;
          successMessage = newStatus === 'completed' ? "Service completed." : "Service marked done by you.";
          break;
        case 'BARBER_CONFIRM_COMPLETION':
          if (currentAppointment.status === 'customer-initiated-completion') {
            updateData.barberMarkedDoneAt = now; updateData.serviceActuallyCompletedAt = now; newStatus = 'completed';
            successMessage = "Service mutually completed.";
          }
          break;
        case 'BARBER_MARK_NO_SHOW':
          newStatus = 'no-show'; updateData.noShowMarkedAt = now;
          successMessage = "Appointment marked as No-Show.";
          break;
      }
      if (newStatus) updateData.status = newStatus;
      await updateDoc(appointmentRef, updateData);
      setAppointments(prev => {
        const updatedList = prev.map(app => app.id === appointmentId ? { ...app, ...updateData, status: newStatus || app.status } : app);
        setItemWithTimestampConversion(LS_APPOINTMENTS_KEY_DASHBOARD, updatedList);
        return updatedList;
      });
      toast({ title: "Success", description: successMessage || `Appointment updated.` });
    } catch (error: any) {
      console.error("Error updating appointment:", error);
      toast({ title: "Error", description: error.message || "Could not update appointment status.", variant: "destructive" });
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
      setBarberScheduleForWalkin(scheduleSnap.exists() ? (scheduleSnap.data() as BarberScheduleDoc).schedule : INITIAL_SCHEDULE_FOR_WALKIN_CHECK);

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

    const serviceDuration = selectedService.duration;
    const scheduleStartTimeMinutes = timeToMinutes(daySchedule.startTime);
    const scheduleEndTimeMinutes = timeToMinutes(daySchedule.endTime);
    const now = new Date();
    const nowTimestamp = Timestamp.fromDate(now);
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    const earliestPossibleStartMinutes = Math.max(scheduleStartTimeMinutes, currentTimeMinutes + 5);

    const todaysAppointmentsForSlotFinding = appointments
      .filter(app => app.date === todayDateStr && !['cancelled', 'completed', 'no-show'].includes(app.status))
      .map(app => ({ start: timeToMinutes(app.startTime), end: timeToMinutes(app.endTime) }))
      .sort((a, b) => a.start - b.start);

    let foundSlotStartMinutes: number | null = null;
    for (let potentialStart = earliestPossibleStartMinutes; potentialStart + serviceDuration <= scheduleEndTimeMinutes; potentialStart += 15) {
        const potentialEnd = potentialStart + serviceDuration;
        if (!todaysAppointmentsForSlotFinding.some(bs => potentialStart < bs.end && potentialEnd > bs.start)) {
            foundSlotStartMinutes = potentialStart; break;
        }
    }
    if (foundSlotStartMinutes === null) {
      const lastApptEnd = todaysAppointmentsForSlotFinding.length > 0 ? todaysAppointmentsForSlotFinding[todaysAppointmentsForSlotFinding.length - 1].end : scheduleStartTimeMinutes;
      const potentialStartAfterLast = Math.max(earliestPossibleStartMinutes, lastApptEnd);
      if (potentialStartAfterLast + serviceDuration <= scheduleEndTimeMinutes && 
          !todaysAppointmentsForSlotFinding.some(bs => potentialStartAfterLast < bs.end && (potentialStartAfterLast + serviceDuration) > bs.start)) {
          foundSlotStartMinutes = potentialStartAfterLast;
      }
    }

    if (foundSlotStartMinutes === null) {
      toast({ title: "No Slot Available", description: "Could not find an immediate slot.", variant: "destructive" });
      setIsProcessingWalkIn(false); return;
    }

    const appointmentStartTime = minutesToTime(foundSlotStartMinutes);
    const appointmentEndTime = minutesToTime(foundSlotStartMinutes + serviceDuration);
    const finalJsDateForWalkin = new Date(todayDateStr + "T00:00:00");
    finalJsDateForWalkin.setHours(Math.floor(foundSlotStartMinutes / 60), foundSlotStartMinutes % 60, 0, 0);
    const appointmentTimestampValue = Timestamp.fromDate(finalJsDateForWalkin);

    try {
      const newAppointmentData: Omit<Appointment, 'id'> = {
        barberId: user.uid, barberName: `${user.firstName} ${user.lastName}`, customerId: null,
        customerName, serviceId: selectedService.id, serviceName: selectedService.name, price: selectedService.price,
        date: todayDateStr, startTime: appointmentStartTime, endTime: appointmentEndTime,
        appointmentTimestamp: appointmentTimestampValue, status: 'in-progress', createdAt: nowTimestamp, updatedAt: nowTimestamp,
        barberCheckedInAt: nowTimestamp, customerCheckedInAt: nowTimestamp, serviceActuallyStartedAt: nowTimestamp,
        customerMarkedDoneAt: null, barberMarkedDoneAt: null, serviceActuallyCompletedAt: null, noShowMarkedAt: null,
      };
      const docRef = await addDoc(collection(firestore, 'appointments'), newAppointmentData);
      const finalAppointment: Appointment = { id: docRef.id, ...newAppointmentData };
      setAppointments(prev => {
        const updated = [...prev, finalAppointment].sort((a,b) => a.date.localeCompare(b.date) || timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        setItemWithTimestampConversion(LS_APPOINTMENTS_KEY_DASHBOARD, updated);
        return updated;
      });
      toast({ title: "Walk-In Added!", description: `${customerName}'s appointment for ${selectedService.name} at ${appointmentStartTime} added.` });
      setIsWalkInDialogOpen(false);
    } catch (error: any) {
      console.error("Error adding walk-in:", error);
      toast({ title: "Error", description: error.message || "Could not add walk-in.", variant: "destructive" });
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
      toast({ title: "Status Updated", description: `You are now ${newCheckedState ? 'accepting' : 'not accepting'} online bookings.` });
    } catch (error: any) {
      console.error("Error updating accepting bookings:", error);
      toast({ title: "Error", description: error.message || "Could not update booking status.", variant: "destructive" });
      setLocalIsAcceptingBookings(!newCheckedState);
    } finally {
      setIsUpdatingAcceptingBookings(false);
    }
  };
  
  const handleToggleTemporaryStatus = async (newCheckedState: boolean) => {
    if (!user || !user.uid || !updateBarberTemporaryStatus) return;

    setLocalIsTemporarilyUnavailable(newCheckedState); // Optimistic UI update
    setIsUpdatingTemporaryStatus(true);
    setIsProcessingAuth(true); // Signal global processing

    try {
      await updateBarberTemporaryStatus(user.uid, newCheckedState, user.unavailableSince);
      toast({
        title: "Availability Updated",
        description: `You are now marked as ${newCheckedState ? 'temporarily unavailable' : 'available'}. ${newCheckedState ? '' : 'Appointments may have been shifted.'}`,
      });
      // Refetch appointments if status changed to available and shifts might have occurred
      if (!newCheckedState) {
        fetchAppointments();
      }
    } catch (error: any) {
      console.error("Error updating temporary status:", error);
      toast({ title: "Error", description: error.message || "Could not update temporary status.", variant: "destructive" });
      setLocalIsTemporarilyUnavailable(!newCheckedState); // Revert on error
    } finally {
      setIsUpdatingTemporaryStatus(false);
      setIsProcessingAuth(false);
    }
  };


  useEffect(() => {
    if (user?.uid && initialLoadComplete) {
      fetchServices();
      fetchAppointments();
      fetchBarberSelfDataForWalkIn();
    }
  }, [user?.uid, fetchServices, fetchAppointments, fetchBarberSelfDataForWalkIn, initialLoadComplete]);

  const isAddWalkInDisabled = isProcessingWalkIn || isLoadingServices || services.length === 0 || isLoadingBarberSelfData || localIsTemporarilyUnavailable;
  let walkInTooltipMessage = null;
  if (localIsTemporarilyUnavailable) walkInTooltipMessage = "You are marked as temporarily unavailable.";
  else if (isLoadingServices || isLoadingBarberSelfData) walkInTooltipMessage = "Loading necessary data...";
  else if (services.length === 0) walkInTooltipMessage = "Please add services first.";
  else if (isProcessingWalkIn) walkInTooltipMessage = "Processing previous walk-in...";


  return (
    <ProtectedPage expectedRole="barber">
      <TooltipProvider>
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h1 className="text-2xl font-bold font-headline">Welcome, {user?.firstName || 'Barber'}!</h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={isAddWalkInDisabled ? 0 : -1}>
                    <Button onClick={() => setIsWalkInDialogOpen(true)} className="w-full sm:w-auto h-11 rounded-full px-6 text-base" disabled={isAddWalkInDisabled} aria-describedby={isAddWalkInDisabled ? "add-walkin-tooltip" : undefined}>
                        <PlusCircle className="mr-2 h-5 w-5" /> Add Walk-In
                    </Button>
                  </span>
                </TooltipTrigger>
                {walkInTooltipMessage && <TooltipContent id="add-walkin-tooltip"><p>{walkInTooltipMessage}</p></TooltipContent>}
              </Tooltip>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-lg rounded-xl overflow-hidden">
              <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
                <CardTitle className="text-xl font-bold flex items-center"><Settings2 className="mr-2 h-5 w-5 text-primary" /> Online Booking Status</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                {user ? (
                  <div className="flex items-center space-x-3">
                    <Switch id="accepting-bookings-toggle" checked={localIsAcceptingBookings} onCheckedChange={handleToggleAcceptingBookings} disabled={isUpdatingAcceptingBookings} aria-label="Toggle online bookings" />
                    <Label htmlFor="accepting-bookings-toggle" className="text-base">{localIsAcceptingBookings ? 'Accepting Online Bookings' : 'Not Accepting Online Bookings'}</Label>
                    {isUpdatingAcceptingBookings && <LoadingSpinner className="h-5 w-5 text-primary ml-2" />}
                  </div>
                ) : <div className="flex items-center"><LoadingSpinner className="h-5 w-5 text-primary mr-2" /><p>Loading status...</p></div>}
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Turn this off to prevent new online bookings. Existing appointments are not affected. You can still add walk-ins.</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg rounded-xl overflow-hidden">
              <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
                <CardTitle className="text-xl font-bold flex items-center"><Hourglass className="mr-2 h-5 w-5 text-accent" /> Temporary Status</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                {user ? (
                  <div className="flex items-center space-x-3">
                    <Switch id="temporary-unavailable-toggle" checked={localIsTemporarilyUnavailable} onCheckedChange={handleToggleTemporaryStatus} disabled={isUpdatingTemporaryStatus} aria-label="Toggle temporary unavailability" />
                    <Label htmlFor="temporary-unavailable-toggle" className="text-base">{localIsTemporarilyUnavailable ? 'Temporarily Unavailable' : 'Available'}</Label>
                    {isUpdatingTemporaryStatus && <LoadingSpinner className="h-5 w-5 text-accent ml-2" />}
                  </div>
                ) : <div className="flex items-center"><LoadingSpinner className="h-5 w-5 text-accent mr-2" /><p>Loading status...</p></div>}
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {localIsTemporarilyUnavailable 
                    ? `You've been unavailable ${unavailableSinceDuration || 'for a bit'}. Toggle off to become available and shift today's appointments.` 
                    : "Set yourself as temporarily unavailable (e.g., short break). Appointments for today will be shifted upon your return."}
                </p>
              </CardContent>
            </Card>
          </div>


          {(!isLoadingServices && services.length === 0) && (
            <Alert variant="default" className="border-primary/50 shadow-md rounded-lg">
              <Info className="h-5 w-5 text-primary" />
              <AlertTitle className="font-semibold text-lg">Add Services</AlertTitle>
              <AlertDescription className="text-base">No services added yet. Add services to allow bookings and walk-ins.
                <Button asChild variant="link" className="p-0 h-auto ml-1 text-base text-primary hover:underline"><Link href="/barber/services">Manage Services</Link></Button>
              </AlertDescription>
            </Alert>
          )}

          {(isLoadingAppointments && !appointments.length) ? (
            <div className="flex justify-center items-center py-10"><LoadingSpinner className="h-8 w-8 text-primary" /><p className="ml-2 text-base">Loading appointments...</p></div>
          ) : (
            <TodaysAppointmentsSection appointments={appointments} onAppointmentAction={handleAppointmentAction} isUpdatingAppointmentId={isUpdatingAppointment} />
          )}
        </div>
      </TooltipProvider>
      {isWalkInDialogOpen && <WalkInDialog isOpen={isWalkInDialogOpen} onClose={() => setIsWalkInDialogOpen(false)} onSubmit={handleSaveWalkIn} services={services} isSubmitting={isProcessingWalkIn} />}
    </ProtectedPage>
  );
}
