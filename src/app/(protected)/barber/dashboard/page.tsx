
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { BarberService, Appointment, DayOfWeek, BarberScheduleDoc, UnavailableDate } from '@/types'; // DayAvailability, BarberScheduleDoc, UnavailableDate might be removable if not used by walkin or today's appts directly
import ManageServicesSection from '@/components/barber/ManageServicesSection'; // Will be removed from here, but WalkInDialog needs services
import TodaysAppointmentsSection from '@/components/barber/TodaysAppointmentsSection';
import WalkInDialog from '@/components/barber/WalkInDialog';
import { firestore } from '@/firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  Timestamp,
  // setDoc, // May not be needed if schedule/unavailable are moved
  // getDoc, // May not be needed if schedule/unavailable are moved
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

// Keep for WalkInDialog time calculations
const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

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


const LS_SERVICES_KEY_DASHBOARD = 'barber_dashboard_services'; // Renamed to avoid conflict
const LS_APPOINTMENTS_KEY_DASHBOARD = 'barber_dashboard_appointments'; // Renamed
// Removed LS keys for schedule and unavailable dates as they are managed on separate pages

// Barber's own schedule and unavailable dates are needed for walk-in validation
import type { DayAvailability as ScheduleDayAvailability } from '@/types'; // Alias for clarity
import { getDoc as getFirestoreDoc } from 'firebase/firestore'; // Specific import for clarity

const INITIAL_SCHEDULE_FOR_WALKIN_CHECK: ScheduleDayAvailability[] = (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as DayOfWeek[]).map(day => ({
  day,
  isOpen: !['Saturday', 'Sunday'].includes(day),
  startTime: '09:00 AM',
  endTime: '05:00 PM',
}));


export default function BarberDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<BarberService[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  // State for barber's own schedule and unavailable dates, fetched for walk-in validation
  const [barberScheduleForWalkin, setBarberScheduleForWalkin] = useState<ScheduleDayAvailability[]>(INITIAL_SCHEDULE_FOR_WALKIN_CHECK);
  const [barberUnavailableDatesForWalkin, setBarberUnavailableDatesForWalkin] = useState<UnavailableDate[]>([]);


  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [isUpdatingAppointment, setIsUpdatingAppointment] = useState(false);
  const [isWalkInDialogOpen, setIsWalkInDialogOpen] = useState(false);
  const [isProcessingWalkIn, setIsProcessingWalkIn] = useState(false);
  const [isLoadingBarberSelfData, setIsLoadingBarberSelfData] = useState(true); // For schedule/unavailable for walkin


  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    setInitialLoadComplete(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && initialLoadComplete) {
      const cachedServices = localStorage.getItem(LS_SERVICES_KEY_DASHBOARD);
      if (cachedServices) {
        setServices(convertISOToTimestamps(JSON.parse(cachedServices)));
        setIsLoadingServices(false); 
      }
      const cachedAppointments = localStorage.getItem(LS_APPOINTMENTS_KEY_DASHBOARD);
      if (cachedAppointments) {
        setAppointments(convertISOToTimestamps(JSON.parse(cachedAppointments)));
        setIsLoadingAppointments(false);
      }
       // No local storage for barber's own schedule/unavailable for walkin here, fetched fresh
    }
  }, [initialLoadComplete]);


  // --- Services (still needed for WalkInDialog) ---
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
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_SERVICES_KEY_DASHBOARD, JSON.stringify(convertTimestampsToISO(fetchedServices)));
      }
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({ title: "Error", description: "Could not fetch services for Walk-In.", variant: "destructive" });
    } finally {
      setIsLoadingServices(false);
    }
  }, [user?.uid, toast]);

  // --- Appointments ---
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
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_APPOINTMENTS_KEY_DASHBOARD, JSON.stringify(convertTimestampsToISO(fetchedAppointments)));
      }
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({ title: "Error", description: "Could not fetch appointments.", variant: "destructive" });
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [user?.uid, toast]);

  const handleUpdateAppointmentStatus = async (appointmentId: string, status: Appointment['status']) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsUpdatingAppointment(true);
    try {
      const appointmentRef = doc(firestore, 'appointments', appointmentId);
      const newUpdatedAt = Timestamp.now();
      await updateDoc(appointmentRef, { status: status, updatedAt: newUpdatedAt });
      setAppointments((prev) => {
        const updated = prev.map((app) => (app.id === appointmentId ? { ...app, status, updatedAt: newUpdatedAt } : app));
        if (typeof window !== 'undefined') {
            localStorage.setItem(LS_APPOINTMENTS_KEY_DASHBOARD, JSON.stringify(convertTimestampsToISO(updated)));
        }
        return updated;
      });
      toast({ title: "Success", description: `Appointment status updated to ${status}.` });
    } catch (error) {
      console.error("Error updating appointment status:", error);
      toast({ title: "Error", description: "Could not update appointment status.", variant: "destructive" });
    } finally {
      setIsUpdatingAppointment(false);
    }
  };

  // --- Fetch Barber's own schedule and unavailable dates for Walk-In validation ---
  const fetchBarberSelfDataForWalkIn = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingBarberSelfData(true);
    try {
      // Fetch schedule
      const scheduleDocRef = doc(firestore, 'barberSchedules', user.uid);
      const scheduleSnap = await getFirestoreDoc(scheduleDocRef);
      if (scheduleSnap.exists()) {
        setBarberScheduleForWalkin((scheduleSnap.data() as BarberScheduleDoc).schedule);
      } else {
        setBarberScheduleForWalkin(INITIAL_SCHEDULE_FOR_WALKIN_CHECK); // Fallback if no schedule set
      }

      // Fetch unavailable dates
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


  // --- Walk-In ---
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
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    const earliestPossibleStartMinutes = Math.max(scheduleStartTimeMinutes, currentTimeMinutes + 5); 

    const todaysAppointments = appointments
      .filter(app => app.date === todayDateStr)
      .map(app => ({
        start: timeToMinutes(app.startTime),
        end: timeToMinutes(app.endTime),
      }))
      .sort((a, b) => a.start - b.start);

    let foundSlotStartMinutes: number | null = null;

    for (let potentialStart = earliestPossibleStartMinutes; potentialStart + serviceDuration <= scheduleEndTimeMinutes; potentialStart += 15) {
        const potentialEnd = potentialStart + serviceDuration;
        const isSlotFree = !todaysAppointments.some(
            bookedSlot => potentialStart < bookedSlot.end && potentialEnd > bookedSlot.start
        );
        if (isSlotFree) {
            foundSlotStartMinutes = potentialStart;
            break;
        }
    }
    
    if (foundSlotStartMinutes === null) {
      const lastAppointmentEnd = todaysAppointments.length > 0 ? todaysAppointments[todaysAppointments.length - 1].end : scheduleStartTimeMinutes;
      const potentialStartAfterLast = Math.max(earliestPossibleStartMinutes, lastAppointmentEnd);
      if (potentialStartAfterLast + serviceDuration <= scheduleEndTimeMinutes) {
          const potentialEnd = potentialStartAfterLast + serviceDuration;
           const isSlotFree = !todaysAppointments.some(
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
      const newAppointmentData = {
        barberId: user.uid,
        barberName: `${user.firstName} ${user.lastName}`,
        customerId: null, 
        customerName: customerName,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        date: todayDateStr,
        startTime: appointmentStartTime,
        endTime: appointmentEndTime,
        status: 'checked-in' as Appointment['status'],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(firestore, 'appointments'), newAppointmentData);
      const finalAppointment: Appointment = { id: docRef.id, ...newAppointmentData };
      
      setAppointments(prev => {
        const updated = [...prev, finalAppointment].sort((a,b) => {
            if (a.date === b.date) return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
        if (typeof window !== 'undefined') {
            localStorage.setItem(LS_APPOINTMENTS_KEY_DASHBOARD, JSON.stringify(convertTimestampsToISO(updated)));
        }
        return updated;
      });

      toast({ title: "Walk-In Added!", description: `${customerName}'s appointment for ${selectedService.name} at ${appointmentStartTime} has been added.` });
      setIsWalkInDialogOpen(false);
    } catch (error) {
      console.error("Error adding walk-in appointment:", error);
      toast({ title: "Error", description: "Could not add walk-in appointment.", variant: "destructive" });
    } finally {
      setIsProcessingWalkIn(false);
    }
  };


  useEffect(() => {
    if (user?.uid && initialLoadComplete) { 
      fetchServices(); // Still needed for WalkInDialog
      fetchAppointments();
      fetchBarberSelfDataForWalkIn(); // Fetch barber's own data for walk-in validation
    }
  }, [user?.uid, fetchServices, fetchAppointments, fetchBarberSelfDataForWalkIn, initialLoadComplete]);


  return (
    <ProtectedPage expectedRole="barber">
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-2xl font-bold font-headline">
            Barber Dashboard, {user?.firstName || user?.displayName || 'Barber'}!
            </h1>
            <Button 
              onClick={() => setIsWalkInDialogOpen(true)} 
              className="w-full sm:w-auto h-11 rounded-full" 
              disabled={isProcessingWalkIn || isLoadingServices || services.length === 0 || isLoadingBarberSelfData}
            >
                <PlusCircle className="mr-2 h-5 w-5" />
                Add Walk-In
            </Button>
        </div>

        {(isLoadingAppointments && !appointments.length) ? (
          <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-8 w-8 text-primary" />
            <p className="ml-2 text-base">Loading appointments...</p>
          </div>
        ) : (
          <TodaysAppointmentsSection
            appointments={appointments}
            onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
            isUpdatingAppointment={isUpdatingAppointment}
          />
        )}
      </div>
      {isWalkInDialogOpen && (
        <WalkInDialog
            isOpen={isWalkInDialogOpen}
            onClose={() => setIsWalkInDialogOpen(false)}
            onSubmit={handleSaveWalkIn}
            services={services} // Pass services to dialog
            isSubmitting={isProcessingWalkIn}
        />
      )}
    </ProtectedPage>
  );
}
