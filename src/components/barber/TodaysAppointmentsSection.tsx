
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Appointment } from '@/types';
import AppointmentCard from './AppointmentCard';
import { CalendarDays } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import LoadingSpinner from '@/components/ui/loading-spinner';

// Helper to get today's date in YYYY-MM-DD format
const getTodayDateStringLocal = () => new Date().toISOString().split('T')[0];

interface TodaysAppointmentsSectionProps {
  appointments: Appointment[]; // All appointments for the barber are passed in
  onUpdateAppointmentStatus: (appointmentId: string, status: Appointment['status']) => Promise<void>;
  isUpdatingAppointment: boolean; // To disable buttons during an update
}

export default function TodaysAppointmentsSection({ appointments, onUpdateAppointmentStatus, isUpdatingAppointment }: TodaysAppointmentsSectionProps) {
  const [todayDate, setTodayDate] = useState<string | null>(null);

  useEffect(() => {
    setTodayDate(getTodayDateStringLocal()); // Set today's date on client mount
  }, []);

  const todaysAppointments = useMemo(() => {
    if (!todayDate) {
      return [];
    }
    return appointments
      .filter(app => app.date === todayDate) // Filter for today
      .sort((a, b) => {
        // Sort by start time
        const dateForComparison = todayDate || '1970-01-01';
        let timeAHours = parseInt(a.startTime.split(':')[0]);
        const timeAMinutes = parseInt(a.startTime.split(':')[1].substring(0,2));
        if (a.startTime.includes('PM') && timeAHours !== 12) timeAHours += 12;
        if (a.startTime.includes('AM') && timeAHours === 12) timeAHours = 0; // Midnight case

        let timeBHours = parseInt(b.startTime.split(':')[0]);
        const timeBMinutes = parseInt(b.startTime.split(':')[1].substring(0,2));
        if (b.startTime.includes('PM') && timeBHours !== 12) timeBHours += 12;
        if (b.startTime.includes('AM') && timeBHours === 12) timeBHours = 0; // Midnight case
        
        const fullTimeA = new Date(`${dateForComparison}T00:00:00`);
        fullTimeA.setHours(timeAHours, timeAMinutes);
        
        const fullTimeB = new Date(`${dateForComparison}T00:00:00`);
        fullTimeB.setHours(timeBHours, timeBMinutes);

        return fullTimeA.getTime() - fullTimeB.getTime();
      })
      .map((app, index, arr) => {
        // Determine "next" status
        const firstUpcomingOrCheckedInIndex = arr.findIndex(a => a.status === 'upcoming' || a.status === 'checked-in');
        if ((app.status === 'upcoming' || app.status === 'checked-in') && index === firstUpcomingOrCheckedInIndex) {
          // If this is the first 'upcoming' or 'checked-in' appointment, mark it as 'next' for display
          // But keep its original status for Firestore updates
          return { ...app, displayStatus: 'next' as Appointment['status'] };
        }
        return {...app, displayStatus: app.status };
      });
  }, [appointments, todayDate]);

  const handleCheckIn = async (appointmentId: string) => {
    await onUpdateAppointmentStatus(appointmentId, 'checked-in');
  };

  const handleMarkDone = async (appointmentId: string) => {
    await onUpdateAppointmentStatus(appointmentId, 'completed');
  };

  if (!todayDate) { // Still determining today's date on the client
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
  
  const formattedTodayDate = new Date(todayDate + 'T00:00:00').toLocaleDateString(undefined, { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CalendarDays className="mr-2 h-6 w-6 text-primary" /> Today's Appointments
        </CardTitle>
        <CardDescription>View and manage your appointments scheduled for today ({formattedTodayDate}).</CardDescription>
      </CardHeader>
      <CardContent>
        {todaysAppointments.length === 0 ? (
          <p className="text-muted-foreground">No appointments scheduled for today.</p>
        ) : (
          <div className="space-y-4">
            {todaysAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                // Pass displayStatus for card styling, but original status for logic if needed
                appointment={{...appointment, status: appointment.displayStatus || appointment.status}}
                onCheckIn={handleCheckIn}
                onMarkDone={handleMarkDone}
                // Disable buttons if any appointment status is currently being updated
                isInteracting={isUpdatingAppointment} 
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
