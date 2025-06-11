
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { BarberService, DayAvailability, Appointment, DayOfWeek, BarberScheduleDoc, UnavailableDate } from '@/types';
import ManageServicesSection from '@/components/barber/ManageServicesSection';
import SetWorkScheduleSection from '@/components/barber/SetWorkScheduleSection';
import TodaysAppointmentsSection from '@/components/barber/TodaysAppointmentsSection';
import ManageUnavailableDatesSection from '@/components/barber/ManageUnavailableDatesSection';
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
  setDoc,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';

const INITIAL_SCHEDULE: DayAvailability[] = (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as DayOfWeek[]).map(day => ({
  day,
  isOpen: !['Saturday', 'Sunday'].includes(day),
  startTime: '09:00 AM',
  endTime: '05:00 PM',
}));

const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
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


const LS_SERVICES_KEY = 'barber_dashboard_services';
const LS_SCHEDULE_KEY = 'barber_dashboard_schedule';
const LS_APPOINTMENTS_KEY = 'barber_dashboard_appointments';
const LS_UNAVAILABLE_DATES_KEY = 'barber_dashboard_unavailable_dates';


export default function BarberDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<BarberService[]>([]);
  const [schedule, setSchedule] = useState<DayAvailability[]>(INITIAL_SCHEDULE);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [unavailableDates, setUnavailableDates] = useState<UnavailableDate[]>([]);

  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [isUpdatingAppointment, setIsUpdatingAppointment] = useState(false);
  const [isLoadingUnavailableDates, setIsLoadingUnavailableDates] = useState(true);
  const [isProcessingUnavailableDate, setIsProcessingUnavailableDate] = useState(false);


  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    setInitialLoadComplete(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && initialLoadComplete) {
      const cachedServices = localStorage.getItem(LS_SERVICES_KEY);
      if (cachedServices) {
        setServices(convertISOToTimestamps(JSON.parse(cachedServices)));
        setIsLoadingServices(false);
      }
      const cachedSchedule = localStorage.getItem(LS_SCHEDULE_KEY);
      if (cachedSchedule) {
        setSchedule(JSON.parse(cachedSchedule));
        setIsLoadingSchedule(false);
      }
      const cachedAppointments = localStorage.getItem(LS_APPOINTMENTS_KEY);
      if (cachedAppointments) {
        setAppointments(convertISOToTimestamps(JSON.parse(cachedAppointments)));
        setIsLoadingAppointments(false);
      }
      const cachedUnavailableDates = localStorage.getItem(LS_UNAVAILABLE_DATES_KEY);
      if (cachedUnavailableDates) {
        setUnavailableDates(convertISOToTimestamps(JSON.parse(cachedUnavailableDates)));
        setIsLoadingUnavailableDates(false);
      }
    }
  }, [initialLoadComplete]);


  // --- Services ---
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
        localStorage.setItem(LS_SERVICES_KEY, JSON.stringify(convertTimestampsToISO(fetchedServices)));
      }
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({ title: "Error", description: "Could not fetch services.", variant: "destructive" });
    } finally {
      setIsLoadingServices(false);
    }
  }, [user?.uid, toast]);

  const handleAddService = async (serviceData: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in to add services.", variant: "destructive" });
      return;
    }
    try {
      const now = Timestamp.now();
      const newServiceData = { ...serviceData, barberId: user.uid, createdAt: now, updatedAt: now };
      const docRef = await addDoc(collection(firestore, 'services'), newServiceData);
      const newServiceEntry = { ...newServiceData, id: docRef.id };
      setServices((prev) => {
        const updated = [newServiceEntry, ...prev];
        if (typeof window !== 'undefined') {
            localStorage.setItem(LS_SERVICES_KEY, JSON.stringify(convertTimestampsToISO(updated)));
        }
        return updated;
      });
      toast({ title: "Success", description: "Service added successfully." });
    } catch (error) {
      console.error("Error adding service:", error);
      toast({ title: "Error", description: "Could not add service.", variant: "destructive" });
    }
  };

  const handleUpdateService = async (serviceId: string, serviceData: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in to update services.", variant: "destructive" });
      return;
    }
    try {
      const serviceRef = doc(firestore, 'services', serviceId);
      const updatedServiceData = { ...serviceData, updatedAt: Timestamp.now() };
      await updateDoc(serviceRef, updatedServiceData);
      setServices((prev) => {
        const updated = prev.map(s => s.id === serviceId ? { ...s, ...updatedServiceData } : s);
        if (typeof window !== 'undefined') {
            localStorage.setItem(LS_SERVICES_KEY, JSON.stringify(convertTimestampsToISO(updated)));
        }
        return updated;
      });
      toast({ title: "Success", description: "Service updated successfully." });
    } catch (error) {
      console.error("Error updating service:", error);
      toast({ title: "Error", description: "Could not update service.", variant: "destructive" });
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in to delete services.", variant: "destructive" });
      return;
    }
    try {
      const serviceRef = doc(firestore, 'services', serviceId);
      await deleteDoc(serviceRef);
      setServices((prev) => {
        const updated = prev.filter(s => s.id !== serviceId);
        if (typeof window !== 'undefined') {
            localStorage.setItem(LS_SERVICES_KEY, JSON.stringify(convertTimestampsToISO(updated)));
        }
        return updated;
      });
      toast({ title: "Success", description: "Service deleted successfully." });
    } catch (error) {
      console.error("Error deleting service:", error);
      toast({ title: "Error", description: "Could not delete service.", variant: "destructive" });
    }
  };

  // --- Schedule ---
  const fetchSchedule = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingSchedule(true);
    try {
      const scheduleDocRef = doc(firestore, 'barberSchedules', user.uid);
      const docSnap = await getDoc(scheduleDocRef);
      let newSchedule = INITIAL_SCHEDULE;
      if (docSnap.exists()) {
        const scheduleData = docSnap.data() as BarberScheduleDoc;
        newSchedule = scheduleData.schedule;
      }
      setSchedule(newSchedule);
       if (typeof window !== 'undefined') {
        localStorage.setItem(LS_SCHEDULE_KEY, JSON.stringify(newSchedule));
      }
    } catch (error) {
      console.error("Error fetching schedule:", error);
      toast({ title: "Error", description: "Could not fetch work schedule.", variant: "destructive" });
      setSchedule(INITIAL_SCHEDULE);
    } finally {
      setIsLoadingSchedule(false);
    }
  }, [user?.uid, toast]);

  const handleUpdateScheduleDay = (day: DayOfWeek, updates: Partial<DayAvailability>) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day === day ? { ...d, ...updates } : d))
    );
  };

  const handleSaveSchedule = async () => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSavingSchedule(true);
    try {
      const scheduleDocRef = doc(firestore, 'barberSchedules', user.uid);
      const scheduleDataToSave: BarberScheduleDoc = {
        barberId: user.uid,
        schedule: schedule,
        updatedAt: Timestamp.now(),
      };
      await setDoc(scheduleDocRef, scheduleDataToSave, { merge: true }); // Use merge if creating/updating doc
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_SCHEDULE_KEY, JSON.stringify(schedule));
      }
      toast({ title: "Success", description: "Work schedule saved successfully." });
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast({ title: "Error", description: "Could not save work schedule.", variant: "destructive" });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // --- Appointments ---
  const fetchAppointments = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingAppointments(true);
    try {
      const appointmentsCollection = collection(firestore, 'appointments');
      // Order by date ascending, then by startTime ascending for Barber Dashboard
      const q = query(appointmentsCollection, where('barberId', '==', user.uid), orderBy('date', 'asc'), orderBy('startTime'));
      const querySnapshot = await getDocs(q);
      const fetchedAppointments: Appointment[] = [];
      querySnapshot.forEach((doc) => {
        fetchedAppointments.push({ id: doc.id, ...doc.data() } as Appointment);
      });
      setAppointments(fetchedAppointments);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_APPOINTMENTS_KEY, JSON.stringify(convertTimestampsToISO(fetchedAppointments)));
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
      toast({ title: "Error", description: "You must be logged in to update appointments.", variant: "destructive" });
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
            localStorage.setItem(LS_APPOINTMENTS_KEY, JSON.stringify(convertTimestampsToISO(updated)));
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

  // --- Unavailable Dates ---
  const fetchUnavailableDates = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingUnavailableDates(true);
    try {
      const unavailableDatesColRef = collection(firestore, `barberSchedules/${user.uid}/unavailableDates`);
      const q = query(unavailableDatesColRef, orderBy('date', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetchedDates: UnavailableDate[] = [];
      querySnapshot.forEach((doc) => {
        fetchedDates.push({ id: doc.id, ...doc.data() } as UnavailableDate);
      });
      setUnavailableDates(fetchedDates);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_UNAVAILABLE_DATES_KEY, JSON.stringify(convertTimestampsToISO(fetchedDates)));
      }
    } catch (error) {
      console.error("Error fetching unavailable dates:", error);
      toast({ title: "Error", description: "Could not fetch unavailable dates.", variant: "destructive" });
    } finally {
      setIsLoadingUnavailableDates(false);
    }
  }, [user?.uid, toast]);

  const handleAddUnavailableDate = async (date: string, reason?: string) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsProcessingUnavailableDate(true);
    try {
      // Check if date already exists
      const existingDate = unavailableDates.find(ud => ud.date === date);
      if (existingDate) {
        toast({ title: "Date Exists", description: "This date is already marked as unavailable.", variant: "destructive" });
        setIsProcessingUnavailableDate(false);
        return;
      }

      const unavailableDateDocRef = doc(firestore, `barberSchedules/${user.uid}/unavailableDates`, date);
      const newUnavailableDate: Omit<UnavailableDate, 'id'> = {
        barberId: user.uid,
        date,
        reason: reason || '',
        createdAt: Timestamp.now(),
      };
      await setDoc(unavailableDateDocRef, newUnavailableDate);
      const finalDateEntry = { ...newUnavailableDate, id: date } as UnavailableDate; // id is the date string itself
      
      setUnavailableDates((prev) => {
        const updated = [...prev, finalDateEntry].sort((a,b) => a.date.localeCompare(b.date));
        if (typeof window !== 'undefined') {
          localStorage.setItem(LS_UNAVAILABLE_DATES_KEY, JSON.stringify(convertTimestampsToISO(updated)));
        }
        return updated;
      });
      toast({ title: "Success", description: "Date marked as unavailable." });
    } catch (error) {
      console.error("Error adding unavailable date:", error);
      toast({ title: "Error", description: "Could not add unavailable date.", variant: "destructive" });
    } finally {
      setIsProcessingUnavailableDate(false);
    }
  };

  const handleRemoveUnavailableDate = async (dateId: string) => { // dateId is the YYYY-MM-DD string
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsProcessingUnavailableDate(true);
    try {
      const unavailableDateDocRef = doc(firestore, `barberSchedules/${user.uid}/unavailableDates`, dateId);
      await deleteDoc(unavailableDateDocRef);
      setUnavailableDates((prev) => {
        const updated = prev.filter(ud => ud.id !== dateId);
        if (typeof window !== 'undefined') {
          localStorage.setItem(LS_UNAVAILABLE_DATES_KEY, JSON.stringify(convertTimestampsToISO(updated)));
        }
        return updated;
      });
      toast({ title: "Success", description: "Unavailable date removed." });
    } catch (error) {
      console.error("Error removing unavailable date:", error);
      toast({ title: "Error", description: "Could not remove unavailable date.", variant: "destructive" });
    } finally {
      setIsProcessingUnavailableDate(false);
    }
  };


  useEffect(() => {
    if (user?.uid && initialLoadComplete) { 
      fetchServices();
      fetchSchedule();
      fetchAppointments();
      fetchUnavailableDates();
    }
  }, [user?.uid, fetchServices, fetchSchedule, fetchAppointments, fetchUnavailableDates, initialLoadComplete]);


  return (
    <ProtectedPage expectedRole="barber">
      <div className="space-y-8">
        <h1 className="text-2xl font-bold font-headline">
          Barber Dashboard, {user?.firstName || user?.displayName || 'Barber'}!
        </h1>

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

        {(isLoadingServices && !services.length) ? (
          <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-8 w-8 text-primary" />
            <p className="ml-2 text-base">Loading services...</p>
          </div>
        ) : (
          <ManageServicesSection
            services={services}
            onAddService={handleAddService}
            onUpdateService={handleUpdateService}
            onDeleteService={handleDeleteService}
          />
        )}

        {(isLoadingSchedule && schedule.every(s => s.startTime === INITIAL_SCHEDULE[0].startTime)) ? ( 
           <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-8 w-8 text-primary" />
            <p className="ml-2 text-base">Loading schedule...</p>
          </div>
        ) : (
          <SetWorkScheduleSection
            schedule={schedule}
            onUpdateSchedule={handleUpdateScheduleDay}
            onSaveChanges={handleSaveSchedule}
            isSaving={isSavingSchedule}
          />
        )}

         {(isLoadingUnavailableDates && !unavailableDates.length) ? (
          <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-8 w-8 text-primary" />
            <p className="ml-2 text-base">Loading unavailable dates...</p>
          </div>
        ) : (
           <ManageUnavailableDatesSection
            unavailableDates={unavailableDates}
            onAddUnavailableDate={handleAddUnavailableDate}
            onRemoveUnavailableDate={handleRemoveUnavailableDate}
            isProcessing={isProcessingUnavailableDate}
          />
        )}
      </div>
    </ProtectedPage>
  );
}
