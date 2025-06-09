
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Appointment } from '@/types';
import AppointmentCard from './AppointmentCard';
import { CalendarDays } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import LoadingSpinner from '@/components/ui/loading-spinner';

const getTodayDateStringLocal = () => new Date().toISOString().split('T')[0];

interface TodaysAppointmentsSectionProps {
  appointments: Appointment[]; 
  onUpdateAppointmentStatus: (appointmentId: string, status: Appointment['status']) => Promise<void>;
  isUpdatingAppointment: boolean; 
}

export default function TodaysAppointmentsSection({ appointments, onUpdateAppointmentStatus, isUpdatingAppointment }: TodaysAppointmentsSectionProps) {
  const [todayDate, setTodayDate] = useState<string | null>(null);

  useEffect(() => {
    setTodayDate(getTodayDateStringLocal()); 
  }, []);

  const todaysAppointments = useMemo(() => {
    if (!todayDate) {
      return [];
    }
    return appointments
      .filter(app => app.date === todayDate) 
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
        const firstUpcomingOrCheckedInIndex = arr.findIndex(a => a.status === 'upcoming' || a.status === 'checked-in');
        if ((app.status === 'upcoming' || app.status === 'checked-in') && index === firstUpcomingOrCheckedInIndex) {
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

  if (!todayDate) { 
    return (
      <Card className="border-none shadow-lg rounded-xl overflow-hidden">
        <CardHeader className="p-6">
          <CardTitle className="text-2xl font-bold flex items-center">
            <CalendarDays className="mr-2 h-6 w-6 text-primary" /> Today's Appointments
          </CardTitle>
          <CardDescription className="text-sm text-gray-500 mt-1">Loading appointments for today...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-8 p-6">
          <LoadingSpinner className="h-8 w-8 text-primary" />
        </CardContent>
      </Card>
    );
  }
  
  const formattedTodayDate = new Date(todayDate + 'T00:00:00').toLocaleDateString(undefined, { 
    weekday: 'long', month: 'long', day: 'numeric' 
  });

  return (
    <Card className="border-none shadow-lg rounded-xl overflow-hidden">
      <CardHeader className="p-6">
        <CardTitle className="text-2xl font-bold flex items-center">
          <CalendarDays className="mr-2 h-6 w-6 text-primary" /> Today's Appointments
        </CardTitle>
        <CardDescription className="text-sm text-gray-500 mt-1">View and manage your appointments for <span className="text-[#0088E0]">{formattedTodayDate}</span>.</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {todaysAppointments.length === 0 ? (
          <p className="text-base text-gray-500">No appointments scheduled for today.</p>
        ) : (
          <div className="space-y-4">
            {todaysAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={{...appointment, status: appointment.displayStatus || appointment.status}}
                onCheckIn={handleCheckIn}
                onMarkDone={handleMarkDone}
                isInteracting={isUpdatingAppointment} 
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
