
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
      setServices((prev) => [{ ...newServiceData, id: docRef.id }, ...prev]);
      toast({ title: "Success", description: "Service added successfully." });
    } catch (error) {
      console.error("Error adding service:", error);
      toast({ title: "Error", description: "Could not add service.", variant: "destructive" });
    }
  };

  const handleUpdateService = async (serviceId: string, serviceData: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => {
    try {
      const serviceRef = doc(firestore, 'services', serviceId);
      const updatedServiceData = { ...serviceData, updatedAt: Timestamp.now() };
      await updateDoc(serviceRef, updatedServiceData);
      setServices((prev) => prev.map(s => s.id === serviceId ? { ...s, ...updatedServiceData } : s));
      toast({ title: "Success", description: "Service updated successfully." });
    } catch (error) {
      console.error("Error updating service:", error);
      toast({ title: "Error", description: "Could not update service.", variant: "destructive" });
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      const serviceRef = doc(firestore, 'services', serviceId);
      await deleteDoc(serviceRef);
      setServices((prev) => prev.filter(s => s.id !== serviceId));
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
      if (docSnap.exists()) {
        const scheduleData = docSnap.data() as BarberScheduleDoc;
        setSchedule(scheduleData.schedule);
      } else {
        setSchedule(INITIAL_SCHEDULE); 
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
      await setDoc(scheduleDocRef, scheduleDataToSave, { merge: true }); 
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
      const q = query(appointmentsCollection, where('barberId', '==', user.uid), orderBy('date', 'desc'), orderBy('startTime'));
      const querySnapshot = await getDocs(q);
      const fetchedAppointments: Appointment[] = [];
      querySnapshot.forEach((doc) => {
        fetchedAppointments.push({ id: doc.id, ...doc.data() } as Appointment);
      });
      setAppointments(fetchedAppointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({ title: "Error", description: "Could not fetch appointments.", variant: "destructive" });
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [user?.uid, toast]);

  const handleUpdateAppointmentStatus = async (appointmentId: string, status: Appointment['status']) => {
    setIsUpdatingAppointment(true);
    try {
      const appointmentRef = doc(firestore, 'appointments', appointmentId);
      await updateDoc(appointmentRef, { status: status, updatedAt: Timestamp.now() });
      setAppointments((prev) =>
        prev.map((app) => (app.id === appointmentId ? { ...app, status, updatedAt: Timestamp.now() } : app))
      );
      toast({ title: "Success", description: `Appointment status updated to ${status}.` });
    } catch (error) {
      console.error("Error updating appointment status:", error);
      toast({ title: "Error", description: "Could not update appointment status.", variant: "destructive" });
    } finally {
      setIsUpdatingAppointment(false);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      fetchServices();
      fetchSchedule();
      fetchAppointments();
    }
  }, [user?.uid, fetchServices, fetchSchedule, fetchAppointments]);


  return (
    <ProtectedPage expectedRole="barber">
      <div className="space-y-8">
        <h1 className="text-2xl font-bold font-headline">
          Barber Dashboard, {user?.firstName || user?.displayName || 'Barber'}!
        </h1>

        {isLoadingAppointments ? (
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
        
        {isLoadingServices ? (
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

        {isLoadingSchedule ? (
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
