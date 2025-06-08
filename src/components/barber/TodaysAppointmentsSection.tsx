
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Appointment } from '@/types';
import AppointmentCard from './AppointmentCard';
import { CalendarDays } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import LoadingSpinner from '@/components/ui/loading-spinner'; // Assuming you have a spinner

// Helper to get today's date in YYYY-MM-DD format
const getTodayDateStringLocal = () => new Date().toISOString().split('T')[0];

interface TodaysAppointmentsSectionProps {
  appointments: Appointment[];
  onUpdateAppointmentStatus: (appointmentId: string, status: Appointment['status']) => void;
}

export default function TodaysAppointmentsSection({ appointments, onUpdateAppointmentStatus }: TodaysAppointmentsSectionProps) {
  const [todayDate, setTodayDate] = useState<string | null>(null);

  useEffect(() => {
    setTodayDate(getTodayDateStringLocal());
  }, []); // Runs once on mount, client-side

  const todaysAppointments = useMemo(() => {
    if (!todayDate) {
      return [];
    }
    return appointments
      .filter(app => app.date === todayDate)
      .sort((a, b) => {
        // Sort by start time - ensure consistent date for comparison
        const dateForComparison = todayDate || '1970-01-01'; // Fallback, though todayDate should be set
        const timeA = new Date(`${dateForComparison}T${a.startTime.replace(/( AM| PM)/, '')}`);
        const timeB = new Date(`${dateForComparison}T${b.startTime.replace(/( AM| PM)/, '')}`);
        if (a.startTime.includes('PM') && !a.startTime.includes('12:')) timeA.setHours(timeA.getHours() + 12);
        if (b.startTime.includes('PM') && !b.startTime.includes('12:')) timeB.setHours(timeB.getHours() + 12);
        if (a.startTime.includes('AM') && a.startTime.includes('12:')) timeA.setHours(0); 
        if (b.startTime.includes('AM') && b.startTime.includes('12:')) timeB.setHours(0); 
        return timeA.getTime() - timeB.getTime();
      })
      .map((app, index, arr) => {
        const firstUpcomingIndex = arr.findIndex(a => a.status === 'upcoming');
        if (app.status === 'upcoming' && index === firstUpcomingIndex) {
          return { ...app, status: 'next' as Appointment['status'] };
        }
        return app;
      });
  }, [appointments, todayDate]);

  const handleCheckIn = (appointmentId: string) => {
    onUpdateAppointmentStatus(appointmentId, 'checked-in');
  };

  const handleMarkDone = (appointmentId: string) => {
    onUpdateAppointmentStatus(appointmentId, 'completed');
  };

  if (!todayDate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarDays className="mr-2 h-6 w-6 text-primary" /> Today's Appointments
          </CardTitle>
          <CardDescription>Loading appointments for today...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-8">
          <LoadingSpinner className="h-8 w-8 text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CalendarDays className="mr-2 h-6 w-6 text-primary" /> Today's Appointments
        </CardTitle>
        <CardDescription>View and manage your appointments scheduled for today ({new Date(todayDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}).</CardDescription>
      </CardHeader>
      <CardContent>
        {todaysAppointments.length === 0 ? (
          <p className="text-muted-foreground">No appointments scheduled for today.</p>
        ) : (
          <div className="space-y-4">
            {todaysAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onCheckIn={handleCheckIn}
                onMarkDone={handleMarkDone}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
