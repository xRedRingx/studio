
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
  let cardBgClass = "bg-card"; // Default to card background
  let cardBorderClass = "border border-border"; // Default border
  let statusBadge = null;
  let timeClass = "text-gray-500 dark:text-gray-400";

  if (isStale && (status === 'upcoming' || status === 'customer-initiated-check-in')) {
    cardTitleClass = "text-yellow-700 dark:text-yellow-500";
    cardBgClass = "bg-yellow-500/10 dark:bg-yellow-700/15";
    cardBorderClass = "border-yellow-500 ring-2 ring-yellow-500/50 shadow-lg shadow-yellow-500/20";
    statusBadge = <span className="text-xs font-semibold uppercase text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-full bg-yellow-500/20 flex items-center"><AlertTriangle className="h-3.5 w-3.5 mr-1.5"/>Needs Attention</span>;
    timeClass = "text-yellow-700 dark:text-yellow-500";
  } else if (isNextCandidate && (status === 'upcoming' || status === 'customer-initiated-check-in' || status === 'barber-initiated-check-in')) {
    cardTitleClass = "text-primary-foreground"; // Brighter text on primary background
    cardBgClass = "bg-primary/90 dark:bg-primary/80";
    cardBorderClass = "border-primary ring-2 ring-primary/80 shadow-lg shadow-primary/30";
    statusBadge = <span className="text-xs font-semibold uppercase text-primary-foreground px-2 py-1 rounded-full bg-primary-foreground/20 flex items-center"><AlertCircle className="h-3.5 w-3.5 mr-1.5"/>Next Up</span>;
    timeClass = "text-primary-foreground/90";
  } else if (status === 'in-progress') {
     cardBgClass = "bg-primary/10 dark:bg-primary/15";
     cardBorderClass = "border-primary/50";
     cardTitleClass = "text-primary";
     timeClass = "text-primary";
     statusBadge = <span className="text-xs font-semibold uppercase text-primary px-2 py-1 rounded-full bg-primary/15 flex items-center"><Play className="h-3 w-3 mr-1.5 fill-current"/>In Progress</span>;
  } else if (status === 'completed') {
     cardBgClass = "bg-green-500/10 dark:bg-green-700/15 opacity-90";
     cardBorderClass = "border-green-500/50";
     cardTitleClass = "text-green-700 dark:text-green-400";
     timeClass = "text-green-600 dark:text-green-500";
  }


  const renderActionButtons = () => {
    if (status === 'completed' || status === 'cancelled') return null;

    if (isWalkIn) { // Simplified flow for walk-ins
      if (status === 'in-progress') {
        return (
          <Button onClick={() => onAppointmentAction(appointment.id, 'BARBER_MARK_DONE')} size="sm" className="rounded-full h-9 px-4" disabled={isInteracting}>
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Mark Done
          </Button>
        );
      }
      return null;
    }

    // For booked appointments
    switch (status) {
      case 'upcoming':
        return (
          <Button 
            variant={isStale ? "default" : "outline"} 
            onClick={() => onAppointmentAction(appointment.id, 'BARBER_CHECK_IN')} 
            size="sm" 
            className={cn(
                "rounded-full h-9 px-4", 
                isStale && "bg-yellow-500 hover:bg-yellow-600 text-white dark:text-yellow-900 dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:hover:text-white border-yellow-600"
            )} 
            disabled={isInteracting}
          >
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />} Record Arrival
          </Button>
        );
      case 'customer-initiated-check-in':
        return (
          <Button onClick={() => onAppointmentAction(appointment.id, 'BARBER_CONFIRM_START')} size="sm" className={cn("rounded-full h-9 px-4", isStale && "bg-yellow-500 hover:bg-yellow-600 text-white dark:text-yellow-900 dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:hover:text-white border-yellow-600" )} disabled={isInteracting}>
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />} Confirm & Start
          </Button>
        );
      case 'barber-initiated-check-in':
        return <p className={cn("text-sm", timeClass, isStale ? "font-semibold" : "text-muted-foreground")}>Waiting for customer to confirm check-in.</p>;
      case 'in-progress':
        return (
          <Button onClick={() => onAppointmentAction(appointment.id, 'BARBER_MARK_DONE')} size="sm" className="rounded-full h-9 px-4" disabled={isInteracting}>
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <CheckSquare className="mr-2 h-4 w-4" />} Mark Service Done
          </Button>
        );
      case 'customer-initiated-completion':
        return (
          <Button onClick={() => onAppointmentAction(appointment.id, 'BARBER_CONFIRM_COMPLETION')} size="sm" className="rounded-full h-9 px-4" disabled={isInteracting}>
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Confirm Completion
          </Button>
        );
      case 'barber-initiated-completion':
        return <p className={cn("text-sm text-muted-foreground", timeClass)}>Waiting for customer to confirm completion.</p>;
      default:
        return null;
    }
  };
  
  const getStatusLabel = () => {
    switch (status) {
        case 'upcoming': return isNextCandidate && !isStale ? 'Next Up' : (isStale ? 'Needs Attention' : 'Upcoming');
        case 'customer-initiated-check-in': return isStale ? 'Customer Waiting (Stale)' : 'Customer Checked In';
        case 'barber-initiated-check-in': return isStale ? `Barber Recorded Arrival (Stale)` : `Barber Recorded Arrival ${isWalkIn ? '(Walk-In)' : ''}`;
        case 'in-progress': return 'Service In Progress';
        case 'customer-initiated-completion': return 'Customer Marked Done';
        case 'barber-initiated-completion': return `Barber Marked Done ${isWalkIn ? '(Walk-In)' : ''}`;
        case 'completed': return 'Completed';
        case 'cancelled': return 'Cancelled';
        default: return status;
    }
  };


  return (
    <Card className={cn("shadow-md hover:shadow-lg rounded-xl transition-all duration-200 ease-in-out overflow-hidden", cardBorderClass, cardBgClass)}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
            <CardTitle className={cn(cardTitleClass, "flex items-center")}>
                { isNextCandidate ? <Users className="mr-2 h-4 w-4 opacity-80" /> : <User className="mr-2 h-4 w-4 opacity-70" /> }
                {appointment.customerName} {isWalkIn && <span className="text-xs font-normal ml-1.5 opacity-80">({statusBadge || 'Walk-In'})</span>}
            </CardTitle>
            { !isWalkIn && statusBadge }
        </div>
        <p className={cn("text-sm", timeClass, "opacity-90")}>
          {appointment.serviceName}
        </p>
      </CardHeader>
      <CardContent className="pb-3 pt-1 px-4">
        <div className={cn(
            "flex items-center text-sm mb-1 font-medium",
           timeClass
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          <span>{appointment.startTime} - {appointment.endTime}</span>
        </div>
        <p className={cn("text-xs capitalize", timeClass, "opacity-80")}>Status: {getStatusLabel()}</p>
      </CardContent>
      {(status !== 'completed' && status !== 'cancelled') && (
        <CardFooter className="flex justify-end space-x-2 pb-3 pt-2 px-4 bg-transparent">
          {renderActionButtons()}
        </CardFooter>
      )}
    </Card>
  );
}

