/**
 * @fileoverview TodaysAppointmentsSection component for the Barber Dashboard.
 * This component displays a list of appointments scheduled for the current day.
 * It fetches appointments, filters them for today, sorts them by time,
 * and applies logic to determine if an appointment is "stale" (past its start time
 * without action) or past the "no-show grace period".
 * It uses the `AppointmentCard` component to render each appointment.
 */
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Card UI components.
import type { Appointment } from '@/types'; // Type definition for an appointment.
import AppointmentCard from './AppointmentCard'; // Component to display individual appointment details.
import { CalendarDays } from 'lucide-react'; // Icon.
import { useMemo, useState, useEffect } from 'react'; // React hooks.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.

/**
 * Gets today's date as a YYYY-MM-DD string using the client's local timezone.
 * @returns {string} Today's date string.
 */
const getTodayDateStringLocal = () => new Date().toISOString().split('T')[0];

// Grace period (in minutes) after an appointment's start time before it can be marked as a no-show.
const NO_SHOW_GRACE_PERIOD_MINUTES = 5;

/**
 * Converts a time string (e.g., "09:00 AM") to total minutes from midnight.
 * @param {string} timeStr - The time string to convert.
 * @returns {number} Total minutes from midnight.
 */
const timeToMinutes = (timeStr: string): number => {
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (hours === 12) { // Handle 12 AM (midnight) and 12 PM (noon).
    hours = modifier.toUpperCase() === 'AM' ? 0 : 12;
  } else if (modifier.toUpperCase() === 'PM') {
    hours += 12; // Convert PM hours to 24-hour format.
  }
  return hours * 60 + minutes;
};

/**
 * Props for the TodaysAppointmentsSection component.
 * @interface TodaysAppointmentsSectionProps
 * @property {Appointment[]} appointments - Array of all appointments (will be filtered for today).
 * @property {(appointmentId: string, action: 'BARBER_CHECK_IN' | 'BARBER_CONFIRM_START' | 'BARBER_MARK_DONE' | 'BARBER_CONFIRM_COMPLETION' | 'BARBER_MARK_NO_SHOW') => Promise<void>} onAppointmentAction - Callback to handle actions on an appointment.
 * @property {string | null} isUpdatingAppointmentId - The ID of the appointment currently being updated, or null.
 */
interface TodaysAppointmentsSectionProps {
  appointments: Appointment[];
  onAppointmentAction: (appointmentId: string, action: 'BARBER_CHECK_IN' | 'BARBER_CONFIRM_START' | 'BARBER_MARK_DONE' | 'BARBER_CONFIRM_COMPLETION' | 'BARBER_MARK_NO_SHOW') => Promise<void>;
  isUpdatingAppointmentId: string | null;
}

/**
 * TodaysAppointmentsSection component.
 * Displays and manages appointments scheduled for the current day.
 *
 * @param {TodaysAppointmentsSectionProps} props - The component's props.
 * @returns {JSX.Element} The rendered section for today's appointments.
 */
export default function TodaysAppointmentsSection({ appointments, onAppointmentAction, isUpdatingAppointmentId }: TodaysAppointmentsSectionProps) {
  // State for today's date string and the current time in minutes from midnight.
  const [todayDate, setTodayDate] = useState<string | null>(null);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(0);

  // Effect to set the initial `todayDate` and `currentTimeMinutes`.
  // Also sets up an interval to update `currentTimeMinutes` every minute to keep UI reactive.
  useEffect(() => {
    setTodayDate(getTodayDateStringLocal());
    const now = new Date();
    setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());

    // Update current time every minute.
    const timer = setInterval(() => {
      const nowLocal = new Date();
      setCurrentTimeMinutes(nowLocal.getHours() * 60 + nowLocal.getMinutes());
    }, 60000); // 60000 ms = 1 minute.

    return () => clearInterval(timer); // Cleanup interval on component unmount.
  }, []);

  // Memoized calculation of today's appointments, including staleness and grace period status.
  // This re-calculates only when `appointments`, `todayDate`, or `currentTimeMinutes` change.
  const todaysAppointments = useMemo(() => {
    if (!todayDate) { // If today's date is not yet set, return empty array.
      return [];
    }
    const STALE_THRESHOLD_MINUTES = 5; // Threshold for an appointment to be considered "stale".

    return appointments
      // Filter for appointments scheduled for today and not yet completed/cancelled/no-show.
      .filter(app => app.date === todayDate && app.status !== 'cancelled' && app.status !== 'completed' && app.status !== 'no-show')
      // Sort appointments by their start time.
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
      // Map over appointments to add `isStale` and `isPastGracePeriod` flags.
      .map(app => {
        let isStale = false;
        let isPastGracePeriod = false;
        const appStartTimeMinutes = timeToMinutes(app.startTime);

        // Check for staleness and grace period only for 'upcoming' or 'customer-initiated-check-in' appointments.
        if (app.status === 'upcoming' || app.status === 'customer-initiated-check-in') {
          if (currentTimeMinutes > appStartTimeMinutes + STALE_THRESHOLD_MINUTES) {
            isStale = true; // Appointment is past its start time + stale threshold.
          }
          if (currentTimeMinutes > appStartTimeMinutes + NO_SHOW_GRACE_PERIOD_MINUTES) {
            isPastGracePeriod = true; // Appointment is past its start time + no-show grace period.
          }
        }
        return { ...app, isStale, isPastGracePeriod };
      });
  }, [appointments, todayDate, currentTimeMinutes]); // Dependencies for useMemo.

  // Display loading state if `todayDate` is not yet determined.
  if (!todayDate) {
    return (
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-xl font-bold flex items-center">
            <CalendarDays className="mr-2 h-5 w-5 text-primary" /> Today's Appointments
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">Loading appointments for today...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-8 p-4 md:p-6">
          <LoadingSpinner className="h-8 w-8 text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Format today's date for display (e.g., "Monday, January 1").
  const formattedTodayDate = new Date(todayDate + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-xl font-bold flex items-center">
          <CalendarDays className="mr-2 h-5 w-5 text-primary" /> Today's Appointments
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground mt-1">View and manage your appointments for <span className="text-primary font-medium">{formattedTodayDate}</span>.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        {/* Display message if no appointments are scheduled for today. */}
        {todaysAppointments.length === 0 ? (
          <p className="text-base text-muted-foreground">No active appointments scheduled for today.</p>
        ) : (
          // List today's appointments using AppointmentCard.
          <div className="space-y-4">
            {todaysAppointments.map((appointment, index) => {
              // Determine if this is the "next" appointment in the sorted list.
              const isNextAppointment = index === 0 && (appointment.status === 'upcoming' || appointment.status === 'customer-initiated-check-in' || appointment.status === 'barber-initiated-check-in');
              return (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onAppointmentAction={onAppointmentAction}
                  isInteracting={isUpdatingAppointmentId === appointment.id} // Pass if this card is being interacted with.
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
