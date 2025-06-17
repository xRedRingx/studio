
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Appointment } from '@/types';
import AppointmentCard from './AppointmentCard';
import { CalendarDays } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import LoadingSpinner from '@/components/ui/loading-spinner';

const getTodayDateStringLocal = () => new Date().toISOString().split('T')[0];
const NO_SHOW_GRACE_PERIOD_MINUTES = 5;

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
  onAppointmentAction: (appointmentId: string, action: 'BARBER_CHECK_IN' | 'BARBER_CONFIRM_START' | 'BARBER_MARK_DONE' | 'BARBER_CONFIRM_COMPLETION' | 'BARBER_MARK_NO_SHOW') => Promise<void>;
  isUpdatingAppointmentId: string | null;
}

export default function TodaysAppointmentsSection({ appointments, onAppointmentAction, isUpdatingAppointmentId }: TodaysAppointmentsSectionProps) {
  const [todayDate, setTodayDate] = useState<string | null>(null);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(0);

  useEffect(() => {
    setTodayDate(getTodayDateStringLocal());
    const now = new Date();
    setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());

    const timer = setInterval(() => {
      const nowLocal = new Date();
      setCurrentTimeMinutes(nowLocal.getHours() * 60 + nowLocal.getMinutes());
    }, 60000); // Every minute

    return () => clearInterval(timer);
  }, []);

  const todaysAppointments = useMemo(() => {
    if (!todayDate) {
      return [];
    }
    const STALE_THRESHOLD_MINUTES = 5; 

    return appointments
      .filter(app => app.date === todayDate && app.status !== 'cancelled' && app.status !== 'completed' && app.status !== 'no-show')
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
      .map(app => {
        let isStale = false;
        let isPastGracePeriod = false;
        const appStartTimeMinutes = timeToMinutes(app.startTime);

        if (app.status === 'upcoming' || app.status === 'customer-initiated-check-in') {
          if (currentTimeMinutes > appStartTimeMinutes + STALE_THRESHOLD_MINUTES) {
            isStale = true;
          }
          if (currentTimeMinutes > appStartTimeMinutes + NO_SHOW_GRACE_PERIOD_MINUTES) {
            isPastGracePeriod = true;
          }
        }
        return { ...app, isStale, isPastGracePeriod };
      });
  }, [appointments, todayDate, currentTimeMinutes]);

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
            {todaysAppointments.map((appointment, index) => {
              const isNextAppointment = index === 0 && (appointment.status === 'upcoming' || appointment.status === 'customer-initiated-check-in' || appointment.status === 'barber-initiated-check-in');
              return (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onAppointmentAction={onAppointmentAction}
                  isInteracting={isUpdatingAppointmentId === appointment.id}
                  isStale={appointment.isStale}
                  isNextCandidate={isNextAppointment}
                  isPastGracePeriod={appointment.isPastGracePeriod}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
