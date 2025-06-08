
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { BarberService, DayAvailability, Appointment, DayOfWeek } from '@/types';
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
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';

// Helper to get today's date in YYYY-MM-DD format
const getTodayDateString = () => new Date().toISOString().split('T')[0];

// Initial dummy data for schedule and appointments (services will be fetched)
const initialSchedule: DayAvailability[] = (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as DayOfWeek[]).map(day => ({
  day,
  isOpen: !['Saturday', 'Sunday'].includes(day), 
  startTime: '09:00 AM',
  endTime: '05:00 PM',
}));

const appointmentsForTodayBase: Omit<Appointment, 'id' | 'date'>[] = [
  { customerName: 'John Doe', serviceName: "Men's Haircut", startTime: '10:00 AM', endTime: '10:30 AM', status: 'upcoming' },
  { customerName: 'Jane Smith', serviceName: "Beard Trim", startTime: '11:00 AM', endTime: '11:15 AM', status: 'upcoming' },
  { customerName: 'Mike Ross', serviceName: "Men's Haircut", startTime: '02:00 PM', endTime: '02:30 PM', status: 'upcoming' },
  { customerName: 'Sarah Connor', serviceName: "Men's Haircut", startTime: '09:00 AM', endTime: '09:30 AM', status: 'completed' },
  { customerName: 'Kyle Reese', serviceName: "Beard Trim", startTime: '04:00 PM', endTime: '04:15 PM', status: 'upcoming' },
];

const appointmentForAnotherDay: Appointment = {
  id: 'app6', customerName: 'Old Appointment', serviceName: "Men's Haircut", startTime: '10:00 AM', endTime: '10:30 AM', status: 'completed', date: '2023-01-01'
};

export default function BarberDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState<BarberService[]>([]);
  const [schedule, setSchedule] = useState<DayAvailability[]>(initialSchedule);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  // Fetch services from Firestore
  const fetchServices = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingServices(true);
    try {
      const servicesCollection = collection(firestore, 'services');
      const q = query(servicesCollection, where('barberId', '==', user.uid), orderBy('name'));
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

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    const today = getTodayDateString();
    const dynamicAppointmentsForToday: Appointment[] = appointmentsForTodayBase.map((app, index) => ({
      ...app,
      id: `app${index + 1}`,
      date: today,
    }));
    setAppointments([...dynamicAppointmentsForToday, appointmentForAnotherDay]);
  }, []);


  // Manage Services Handlers
  const handleAddService = async (serviceData: Omit<BarberService, 'id' | 'barberId'>) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in to add services.", variant: "destructive" });
      return;
    }
    try {
      const newServiceData = { ...serviceData, barberId: user.uid, createdAt: Timestamp.now() };
      const docRef = await addDoc(collection(firestore, 'services'), newServiceData);
      setServices((prev) => [...prev, { ...newServiceData, id: docRef.id }]);
      toast({ title: "Success", description: "Service added successfully." });
    } catch (error) {
      console.error("Error adding service:", error);
      toast({ title: "Error", description: "Could not add service.", variant: "destructive" });
    }
  };

  const handleUpdateService = async (serviceId: string, serviceData: Omit<BarberService, 'id' | 'barberId'>) => {
    try {
      const serviceRef = doc(firestore, 'services', serviceId);
      await updateDoc(serviceRef, serviceData);
      setServices((prev) => prev.map(s => s.id === serviceId ? { ...s, ...serviceData } : s));
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

  // Set Work Schedule Handlers (currently local state)
  const handleUpdateSchedule = (day: DayOfWeek, updates: Partial<DayAvailability>) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day === day ? { ...d, ...updates } : d))
    );
  };
  const handleSaveSchedule = () => {
    console.log("Schedule saved (local):", schedule);
    toast({ title: "Schedule Saved (Local)", description: "Schedule changes are saved locally."});
    // TODO: Persist schedule to Firestore
  };

  // Today's Appointments Handlers (currently local state)
  const handleUpdateAppointmentStatus = (appointmentId: string, status: Appointment['status']) => {
    setAppointments((prev) =>
      prev.map((app) => (app.id === appointmentId ? { ...app, status } : app))
    );
     // TODO: Persist appointment status changes to Firestore
  };

  return (
    <ProtectedPage expectedRole="barber">
      <div className="space-y-8">
        <h1 className="text-4xl font-headline font-bold">
          Barber Dashboard, {user?.firstName || user?.displayName || 'Barber'}!
        </h1>

        <TodaysAppointmentsSection
          appointments={appointments}
          onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
        />
        
        {isLoadingServices ? (
          <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-8 w-8 text-primary" />
            <p className="ml-2">Loading services...</p>
          </div>
        ) : (
          <ManageServicesSection
            services={services}
            onAddService={handleAddService}
            onUpdateService={handleUpdateService}
            onDeleteService={handleDeleteService}
          />
        )}

        <SetWorkScheduleSection
          schedule={schedule}
          onUpdateSchedule={handleUpdateSchedule}
          onSaveChanges={handleSaveSchedule} // TODO: Implement Firestore save for schedule
        />
        
      </div>
    </ProtectedPage>
  );
}
