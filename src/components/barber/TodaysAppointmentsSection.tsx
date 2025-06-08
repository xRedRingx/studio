
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Appointment } from '@/types';
import AppointmentCard from './AppointmentCard';
import { CalendarDays } from 'lucide-react';
import { useMemo } from 'react';

interface TodaysAppointmentsSectionProps {
  appointments: Appointment[];
  onUpdateAppointmentStatus: (appointmentId: string, status: Appointment['status']) => void;
}

export default function TodaysAppointmentsSection({ appointments, onUpdateAppointmentStatus }: TodaysAppointmentsSectionProps) {
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const todaysAppointments = useMemo(() => {
    return appointments
      .filter(app => app.date === today)
      .sort((a, b) => {
        // Sort by start time
        const timeA = new Date(`${today}T${a.startTime.replace(/( AM| PM)/, '')}`);
        const timeB = new Date(`${today}T${b.startTime.replace(/( AM| PM)/, '')}`);
        if (a.startTime.includes('PM') && !a.startTime.includes('12:')) timeA.setHours(timeA.getHours() + 12);
        if (b.startTime.includes('PM') && !b.startTime.includes('12:')) timeB.setHours(timeB.getHours() + 12);
        if (a.startTime.includes('AM') && a.startTime.includes('12:')) timeA.setHours(0); // 12 AM is 00 hours
        if (b.startTime.includes('AM') && b.startTime.includes('12:')) timeB.setHours(0); // 12 AM is 00 hours
        return timeA.getTime() - timeB.getTime();
      })
      .map((app, index, arr) => {
        // Determine 'next' appointment: the first 'upcoming' one
        const firstUpcomingIndex = arr.findIndex(a => a.status === 'upcoming');
        if (app.status === 'upcoming' && index === firstUpcomingIndex) {
          return { ...app, status: 'next' as Appointment['status'] };
        }
        return app;
      });
  }, [appointments, today]);

  const handleCheckIn = (appointmentId: string) => {
    onUpdateAppointmentStatus(appointmentId, 'checked-in');
  };

  const handleMarkDone = (appointmentId: string) => {
    onUpdateAppointmentStatus(appointmentId, 'completed');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CalendarDays className="mr-2 h-6 w-6 text-primary" /> Today's Appointments
        </CardTitle>
        <CardDescription>View and manage your appointments scheduled for today.</CardDescription>
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
