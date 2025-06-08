
'use client';
import { useState, useEffect } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { BarberService, DayAvailability, Appointment, DayOfWeek } from '@/types';
import ManageServicesSection from '@/components/barber/ManageServicesSection';
import SetWorkScheduleSection from '@/components/barber/SetWorkScheduleSection';
import TodaysAppointmentsSection from '@/components/barber/TodaysAppointmentsSection';

// Helper to get today's date in YYYY-MM-DD format
const getTodayDateString = () => new Date().toISOString().split('T')[0];

// Initial dummy data for services and schedule (these are static)
const initialServices: BarberService[] = [
  { id: '1', name: "Men's Haircut", price: 30, duration: 30 },
  { id: '2', name: "Beard Trim", price: 15, duration: 15 },
];

const initialSchedule: DayAvailability[] = (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as DayOfWeek[]).map(day => ({
  day,
  isOpen: !['Saturday', 'Sunday'].includes(day), // Closed on weekends by default
  startTime: '09:00 AM',
  endTime: '05:00 PM',
}));

// Base structure for appointments that will have today's date dynamically assigned
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
  const [services, setServices] = useState<BarberService[]>(initialServices);
  const [schedule, setSchedule] = useState<DayAvailability[]>(initialSchedule);
  const [appointments, setAppointments] = useState<Appointment[]>([]); // Initialize as empty

  useEffect(() => {
    const today = getTodayDateString();
    const dynamicAppointmentsForToday: Appointment[] = appointmentsForTodayBase.map((app, index) => ({
      ...app,
      id: `app${index + 1}`, // Assign IDs dynamically
      date: today,
    }));
    setAppointments([...dynamicAppointmentsForToday, appointmentForAnotherDay]);
  }, []); // Runs once on mount, client-side


  // Manage Services Handlers
  const handleAddService = (serviceData: Omit<BarberService, 'id'>) => {
    setServices((prev) => [...prev, { ...serviceData, id: crypto.randomUUID() }]);
  };

  const handleUpdateService = (serviceId: string, serviceData: Omit<BarberService, 'id'>) => {
    setServices((prev) => prev.map(s => s.id === serviceId ? { ...s, ...serviceData } : s));
  };

  const handleDeleteService = (serviceId: string) => {
    setServices((prev) => prev.filter(s => s.id !== serviceId));
  };

  // Set Work Schedule Handlers
  const handleUpdateSchedule = (day: DayOfWeek, updates: Partial<DayAvailability>) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day === day ? { ...d, ...updates } : d))
    );
  };
  const handleSaveSchedule = () => {
    // Placeholder: In a real app, this would save to a backend.
    console.log("Schedule saved:", schedule);
    // Potentially show a toast message
  };

  // Today's Appointments Handlers
  const handleUpdateAppointmentStatus = (appointmentId: string, status: Appointment['status']) => {
    setAppointments((prev) =>
      prev.map((app) => (app.id === appointmentId ? { ...app, status } : app))
    );
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
        
        <ManageServicesSection
          services={services}
          onAddService={handleAddService}
          onUpdateService={handleUpdateService}
          onDeleteService={handleDeleteService}
        />

        <SetWorkScheduleSection
          schedule={schedule}
          onUpdateSchedule={handleUpdateSchedule}
          onSaveChanges={handleSaveSchedule}
        />
        
      </div>
    </ProtectedPage>
  );
}
