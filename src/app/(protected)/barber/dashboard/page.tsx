
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { BarberService, DayAvailability, Appointment, DayOfWeek, BarberScheduleDoc } from '@/types';
import ManageServicesSection from '@/components/barber/ManageServicesSection';
import SetWorkScheduleSection from '@/components/barber/SetWorkScheduleSection';
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
  deleteDoc,
  orderBy,
  Timestamp,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';

const INITIAL_SCHEDULE: DayAvailability[] = (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as DayOfWeek[]).map(day => ({
  day,
  isOpen: !['Saturday', 'Sunday'].includes(day),
  startTime: '09:00 AM',
  endTime: '05:00 PM',
}));

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

// Helper to convert ISO strings in an object back to Timestamps (if needed, for now mainly for consistency if re-saving)
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


export default function BarberDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<BarberService[]>([]);
  const [schedule, setSchedule] = useState<DayAvailability[]>(INITIAL_SCHEDULE);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [isUpdatingAppointment, setIsUpdatingAppointment] = useState(false);

  // State to track if initial localStorage load attempt is done
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    setInitialLoadComplete(true);
  }, []);

  useEffect(() => {
    // Load from localStorage on initial mount
    if (typeof window !== 'undefined') {
      const cachedServices = localStorage.getItem(LS_SERVICES_KEY);
      if (cachedServices) {
        setServices(convertISOToTimestamps(JSON.parse(cachedServices)));
        setIsLoadingServices(false);
      }
      const cachedSchedule = localStorage.getItem(LS_SCHEDULE_KEY);
      if (cachedSchedule) {
        setSchedule(JSON.parse(cachedSchedule)); // Schedule doesn't have timestamps
        setIsLoadingSchedule(false);
      }
      const cachedAppointments = localStorage.getItem(LS_APPOINTMENTS_KEY);
      if (cachedAppointments) {
        setAppointments(convertISOToTimestamps(JSON.parse(cachedAppointments)));
        setIsLoadingAppointments(false);
      }
    }
  }, []);


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
    console.log("Attempting to add service. Current user:", user);
    try {
      const now = Timestamp.now();
      const newServiceData = { ...serviceData, barberId: user.uid, createdAt: now, updatedAt: now };
      console.log("Data for new service:", JSON.stringify(newServiceData, null, 2));
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
      toast({ title: "Error", description: "Could not add service. Check console for details.", variant: "destructive" });
    }
  };

  const handleUpdateService = async (serviceId: string, serviceData: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => {
    console.log("Attempting to update service. Current user:", user);
    try {
      const serviceRef = doc(firestore, 'services', serviceId);
      const updatedServiceData = { ...serviceData, updatedAt: Timestamp.now() };
      console.log("Data for updating service " + serviceId + ":", JSON.stringify(updatedServiceData, null, 2));
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
      toast({ title: "Error", description: "Could not update service. Check console for details.", variant: "destructive" });
    }
  };

  const handleDeleteService = async (serviceId: string) => {
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
        localStorage.setItem(LS_SCHEDULE_KEY, JSON.stringify(newSchedule)); // Schedule doesn't have timestamps
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
    console.log("Attempting to save schedule. Current user:", user);
    try {
      const scheduleDocRef = doc(firestore, 'barberSchedules', user.uid);
      const scheduleDataToSave: BarberScheduleDoc = {
        barberId: user.uid,
        schedule: schedule, // this is the current state
        updatedAt: Timestamp.now(),
      };
      console.log("Data for saving schedule:", JSON.stringify(scheduleDataToSave, null, 2));
      await setDoc(scheduleDocRef, scheduleDataToSave, { merge: true });
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_SCHEDULE_KEY, JSON.stringify(schedule)); // Save current schedule state
      }
      toast({ title: "Success", description: "Work schedule saved successfully." });
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast({ title: "Error", description: "Could not save work schedule. Check console for details.", variant: "destructive" });
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
      const q = query(appointmentsCollection, where('barberId', '==', user.uid), orderBy('date', 'desc'), orderBy('startTime'));
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
    setIsUpdatingAppointment(true);
    console.log("Attempting to update appointment status. Current user:", user);
    try {
      const appointmentRef = doc(firestore, 'appointments', appointmentId);
      const newUpdatedAt = Timestamp.now();
      console.log("Data for updating appointment " + appointmentId + " status to " + status + ":", { status: status, updatedAt: newUpdatedAt });
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
      toast({ title: "Error", description: "Could not update appointment status. Check console for details.", variant: "destructive" });
    } finally {
      setIsUpdatingAppointment(false);
    }
  };

  useEffect(() => {
    if (user?.uid && initialLoadComplete) { // Only fetch if initial load from localStorage is done or not applicable
      fetchServices();
      fetchSchedule();
      fetchAppointments();
    }
  }, [user?.uid, fetchServices, fetchSchedule, fetchAppointments, initialLoadComplete]);


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

        {(isLoadingSchedule && schedule.every(s => s.startTime === INITIAL_SCHEDULE[0].startTime)) ? ( // Check against initial default
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
      </div>
    </ProtectedPage>
  );
}
