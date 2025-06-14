
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Appointment, AppointmentStatus } from '@/types';
import { cn } from '@/lib/utils';
import { User, Clock, CheckCircle2, UserCheck, AlertCircle, AlertTriangle, Play, LogIn, CheckSquare, Users } from 'lucide-react';
import LoadingSpinner from '../ui/loading-spinner';

interface AppointmentCardProps {
  appointment: Appointment;
  onAppointmentAction: (appointmentId: string, action: 'BARBER_CHECK_IN' | 'BARBER_CONFIRM_START' | 'BARBER_MARK_DONE' | 'BARBER_CONFIRM_COMPLETION') => Promise<void>;
  isInteracting: boolean;
  isStale?: boolean;
  isNextCandidate?: boolean; // Is this the first active appointment in the list?
}

export default function AppointmentCard({ appointment, onAppointmentAction, isInteracting, isStale, isNextCandidate }: AppointmentCardProps) {
  const { status, customerId } = appointment;
  const isWalkIn = customerId === null;

  let cardTitleClass = "text-base font-semibold";
  let cardBgClass = "";
  let cardBorderClass = "border";
  let nextBadge = null;
  let staleBadge = null;

  if (isStale && (status === 'upcoming' || status === 'customer-initiated-check-in')) {
    cardTitleClass = "text-yellow-700 dark:text-yellow-400";
    cardBgClass = "bg-yellow-400/10";
    cardBorderClass = "border-yellow-500 ring-2 ring-yellow-500/70 shadow-yellow-500/30";
    staleBadge = <span className="text-xs font-semibold uppercase text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-full bg-yellow-500/10 flex items-center"><AlertTriangle className="h-3.5 w-3.5 mr-1"/>Needs Attention</span>;
  } else if (isNextCandidate && (status === 'upcoming' || status === 'customer-initiated-check-in' || status === 'barber-initiated-check-in')) {
    cardTitleClass = "text-primary";
    cardBorderClass = "border-primary ring-2 ring-primary shadow-primary/30";
    nextBadge = <span className="text-xs font-semibold uppercase text-primary px-2 py-1 rounded-full bg-primary/10 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>Next</span>;
  } else if (status === 'in-progress') {
     cardBgClass = "bg-primary/10";
     cardBorderClass = "border-primary/30";
  } else if (status === 'completed') {
     cardBgClass = "bg-green-500/10 opacity-80";
     cardBorderClass = "border-green-500/30";
  }


  const renderActionButtons = () => {
    if (status === 'completed' || status === 'cancelled') return null;

    if (isWalkIn) { // Simplified flow for walk-ins
      if (status === 'in-progress') {
        return (
          <Button onClick={() => onAppointmentAction(appointment.id, 'BARBER_MARK_DONE')} size="sm" className="rounded-full h-9" disabled={isInteracting}>
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Mark Done
          </Button>
        );
      }
      // For walk-ins, initial status is 'in-progress', so no other buttons needed before 'Mark Done'.
      return null;
    }

    // For booked appointments
    switch (status) {
      case 'upcoming':
        return (
          <Button variant={isStale ? "default" : "outline"} onClick={() => onAppointmentAction(appointment.id, 'BARBER_CHECK_IN')} size="sm" className={cn("rounded-full h-9", isStale && "bg-yellow-500 hover:bg-yellow-600 text-white dark:bg-yellow-600 dark:hover:bg-yellow-700")} disabled={isInteracting}>
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />} Record Arrival
          </Button>
        );
      case 'customer-initiated-check-in':
        return (
          <Button onClick={() => onAppointmentAction(appointment.id, 'BARBER_CONFIRM_START')} size="sm" className="rounded-full h-9" disabled={isInteracting}>
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />} Confirm & Start
          </Button>
        );
      case 'barber-initiated-check-in':
        return <p className="text-sm text-muted-foreground">Waiting for customer to confirm check-in.</p>;
      case 'in-progress':
        return (
          <Button onClick={() => onAppointmentAction(appointment.id, 'BARBER_MARK_DONE')} size="sm" className="rounded-full h-9" disabled={isInteracting}>
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <CheckSquare className="mr-2 h-4 w-4" />} Mark Service Done
          </Button>
        );
      case 'customer-initiated-completion':
        return (
          <Button onClick={() => onAppointmentAction(appointment.id, 'BARBER_CONFIRM_COMPLETION')} size="sm" className="rounded-full h-9" disabled={isInteracting}>
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Confirm Completion
          </Button>
        );
      case 'barber-initiated-completion':
        return <p className="text-sm text-muted-foreground">Waiting for customer to confirm completion.</p>;
      default:
        return null;
    }
  };
  
  const getStatusLabel = () => {
    switch (status) {
        case 'upcoming': return 'Upcoming';
        case 'customer-initiated-check-in': return 'Customer Checked In';
        case 'barber-initiated-check-in': return `Barber Recorded Arrival ${isWalkIn ? '(Walk-In)' : ''}`;
        case 'in-progress': return 'Service In Progress';
        case 'customer-initiated-completion': return 'Customer Marked Done';
        case 'barber-initiated-completion': return `Barber Marked Done ${isWalkIn ? '(Walk-In)' : ''}`;
        case 'completed': return 'Completed';
        case 'cancelled': return 'Cancelled';
        default: return status;
    }
  };


  return (
    <Card className={cn("shadow-lg rounded-xl transition-all duration-300 ease-in-out", cardBorderClass, cardBgClass)}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
            <CardTitle className={cn(cardTitleClass)}>
                {appointment.customerName} {isWalkIn && <span className="text-xs font-normal text-muted-foreground">(Walk-In)</span>}
            </CardTitle>
            {staleBadge || nextBadge}
        </div>
        <p className={cn("text-sm text-gray-500 dark:text-gray-400", isStale && "text-yellow-600/90 dark:text-yellow-500/90")}>
          {appointment.serviceName}
        </p>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <div className={cn(
            "flex items-center text-sm mb-1",
            isNextCandidate && !isStale && "text-primary",
            status === 'in-progress' && !isStale && "text-primary",
            isStale && "text-yellow-700 dark:text-yellow-500",
            status === 'completed' && "text-green-600 dark:text-green-500"
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          <span>{appointment.startTime} - {appointment.endTime}</span>
        </div>
        <p className="text-xs text-muted-foreground capitalize">Status: {getStatusLabel()}</p>
      </CardContent>
      {(status !== 'completed' && status !== 'cancelled') && (
        <CardFooter className="flex justify-end space-x-2 pb-4 px-4">
          {renderActionButtons()}
        </CardFooter>
      )}
    </Card>
  );
}
