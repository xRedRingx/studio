
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Appointment, BarberService } from '@/types';
import AppointmentCard from './AppointmentCard';
import { CalendarDays, AlertTriangle } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import LoadingSpinner from '@/components/ui/loading-spinner';

const getTodayDateStringLocal = () => new Date().toISOString().split('T')[0];

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

interface TodaysAppointmentsSectionProps {
  appointments: Appointment[];
  onUpdateAppointmentStatus: (appointmentId: string, status: Appointment['status']) => Promise<void>;
  isUpdatingAppointment: boolean;
  // We might need services if we want to check duration for 'checked-in' staleness later
  // services: BarberService[]; 
}

export default function TodaysAppointmentsSection({ appointments, onUpdateAppointmentStatus, isUpdatingAppointment }: TodaysAppointmentsSectionProps) {
  const [todayDate, setTodayDate] = useState<string | null>(null);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(0);

  useEffect(() => {
    setTodayDate(getTodayDateStringLocal());
    const now = new Date();
    setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());

    // Optional: Update current time periodically if the component stays mounted for long
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000); // Every minute

    return () => clearInterval(timer);
  }, []);

  const todaysAppointments = useMemo(() => {
    if (!todayDate) {
      return [];
    }
    const STALE_THRESHOLD_MINUTES = 5; // e.g., 5 minutes past start time

    return appointments
      .filter(app => app.date === todayDate && app.status !== 'cancelled')
      .sort((a, b) => {
        const dateForComparison = todayDate || '1970-01-01';
        let timeAHours = parseInt(a.startTime.split(':')[0]);
        const timeAMinutes = parseInt(a.startTime.split(':')[1].substring(0,2));
        if (a.startTime.includes('PM') && timeAHours !== 12) timeAHours += 12;
        if (a.startTime.includes('AM') && timeAHours === 12) timeAHours = 0;

        let timeBHours = parseInt(b.startTime.split(':')[0]);
        const timeBMinutes = parseInt(b.startTime.split(':')[1].substring(0,2));
        if (b.startTime.includes('PM') && timeBHours !== 12) timeBHours += 12;
        if (b.startTime.includes('AM') && timeBHours === 12) timeBHours = 0;
        
        const fullTimeA = new Date(`${dateForComparison}T00:00:00`);
        fullTimeA.setHours(timeAHours, timeAMinutes);
        
        const fullTimeB = new Date(`${dateForComparison}T00:00:00`);
        fullTimeB.setHours(timeBHours, timeBMinutes);

        return fullTimeA.getTime() - fullTimeB.getTime();
      })
      .map((app, index, arr) => {
        let displayStatus = app.status;
        let isStale = false;

        const firstUpcomingOrCheckedInIndex = arr.findIndex(a => a.status === 'upcoming' || a.status === 'checked-in');
        if ((app.status === 'upcoming' || app.status === 'checked-in') && index === firstUpcomingOrCheckedInIndex) {
          displayStatus = 'next';
        }

        if (app.status === 'upcoming') {
          const appStartTimeMinutes = timeToMinutes(app.startTime);
          if (currentTimeMinutes > appStartTimeMinutes + STALE_THRESHOLD_MINUTES) {
            isStale = true;
          }
        }
        // Future enhancement: check for stale 'checked-in' appointments
        // if (app.status === 'checked-in') {
        //   const service = services.find(s => s.id === app.serviceId);
        //   if (service) {
        //     const appStartTimeMinutes = timeToMinutes(app.startTime);
        //     const expectedEndTimeMinutes = appStartTimeMinutes + service.duration;
        //     if (currentTimeMinutes > expectedEndTimeMinutes + STALE_THRESHOLD_MINUTES) {
        //       isStale = true;
        //     }
        //   }
        // }

        return { ...app, displayStatus, isStale };
      });
  }, [appointments, todayDate, currentTimeMinutes]);

  const handleCheckIn = async (appointmentId: string) => {
    await onUpdateAppointmentStatus(appointmentId, 'checked-in');
  };

  const handleMarkDone = async (appointmentId: string) => {
    await onUpdateAppointmentStatus(appointmentId, 'completed');
  };

  if (!todayDate) {
    return (
      <Card className="border-none shadow-lg rounded-xl overflow-hidden bg-gradient-to-tr from-card via-muted/10 to-card">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-xl font-bold flex items-center">
            <CalendarDays className="mr-2 h-5 w-5 text-primary" /> Today's Appointments
          </CardTitle>
          <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">Loading appointments for today...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-8 p-4 md:p-6">
          <LoadingSpinner className="h-8 w-8 text-primary" />
        </CardContent>
      </Card>
    );
  }
  
  const formattedTodayDate = new Date(todayDate + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  return (
    <Card className="border-none shadow-lg rounded-xl overflow-hidden bg-gradient-to-tr from-card via-muted/10 to-card">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-xl font-bold flex items-center">
          <CalendarDays className="mr-2 h-5 w-5 text-primary" /> Today's Appointments
        </CardTitle>
        <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">View and manage your appointments for <span className="text-primary font-medium">{formattedTodayDate}</span>.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        {todaysAppointments.length === 0 ? (
          <p className="text-base text-gray-500 dark:text-gray-400">No active appointments scheduled for today.</p>
        ) : (
          <div className="space-y-4">
            {todaysAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={{...appointment, status: appointment.displayStatus || appointment.status}}
                onCheckIn={handleCheckIn}
                onMarkDone={handleMarkDone}
                isInteracting={isUpdatingAppointment}
                isStale={appointment.isStale}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
