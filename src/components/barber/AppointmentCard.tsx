
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Appointment } from '@/types';
import { cn } from '@/lib/utils';
import { User, Clock, CheckCircle2, UserCheck, AlertCircle, AlertTriangle } from 'lucide-react';
import LoadingSpinner from '../ui/loading-spinner';

interface AppointmentCardProps {
  appointment: Appointment & { displayStatus?: Appointment['status'] };
  onCheckIn: (appointmentId: string) => Promise<void>;
  onMarkDone: (appointmentId: string) => Promise<void>;
  isInteracting: boolean;
  isStale?: boolean;
}

export default function AppointmentCard({ appointment, onCheckIn, onMarkDone, isInteracting, isStale }: AppointmentCardProps) {
  const currentStatus = appointment.displayStatus || appointment.status;

  const isNext = currentStatus === 'next';
  const isCheckedIn = currentStatus === 'checked-in';
  const isCompleted = appointment.status === 'completed';

  return (
    <Card className={cn(
      "shadow-lg rounded-xl border transition-all duration-300 ease-in-out",
      isNext && !isStale && "border-primary ring-2 ring-primary shadow-primary/30",
      isCheckedIn && !isStale && "bg-primary/10 border-primary/30",
      isCompleted && "bg-green-500/10 opacity-80 border-green-500/30",
      isStale && (currentStatus === 'upcoming' || currentStatus === 'next') && "bg-yellow-400/10 border-yellow-500 ring-2 ring-yellow-500/70 shadow-yellow-500/30"
    )}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
            <CardTitle className={cn(
              "text-base font-semibold", 
              isNext && !isStale && "text-primary",
              isStale && (currentStatus === 'upcoming' || currentStatus === 'next') && "text-yellow-700 dark:text-yellow-400"
            )}>
                {appointment.customerName}
            </CardTitle>
            {isNext && !isStale && <span className="text-xs font-semibold uppercase text-primary px-2 py-1 rounded-full bg-primary/10 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>Next</span>}
            {isStale && (currentStatus === 'upcoming' || currentStatus === 'next') && (
              <span className="text-xs font-semibold uppercase text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-full bg-yellow-500/10 flex items-center">
                <AlertTriangle className="h-3.5 w-3.5 mr-1"/>Needs Attention
              </span>
            )}
        </div>
        <p className={cn(
            "text-sm text-gray-500 dark:text-gray-400",
            isStale && (currentStatus === 'upcoming' || currentStatus === 'next') && "text-yellow-600/90 dark:text-yellow-500/90"
          )}
        >
          {appointment.serviceName}
        </p>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <div className={cn(
            "flex items-center text-sm",
            isNext && !isStale && "text-primary",
            isCheckedIn && !isStale && "text-primary",
            isStale && (currentStatus === 'upcoming' || currentStatus === 'next') && "text-yellow-700 dark:text-yellow-500",
            isCompleted && "text-green-600 dark:text-green-500"
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          <span>{appointment.startTime} - {appointment.endTime}</span>
        </div>
      </CardContent>
      {!isCompleted && (
        <CardFooter className="flex justify-end space-x-2 pb-4 px-4">
          {(currentStatus === 'upcoming' || currentStatus === 'next') ? ( // 'next' is also a form of 'upcoming' or 'checked-in' (if barber forgot to check-in a next one)
            <Button 
              variant={isStale ? "default" : "outline"} 
              onClick={() => onCheckIn(appointment.id)} 
              size="sm" 
              className={cn(
                "rounded-full h-9",
                isStale && "bg-yellow-500 hover:bg-yellow-600 text-white dark:bg-yellow-600 dark:hover:bg-yellow-700"
              )} 
              disabled={isInteracting}
            >
              {isInteracting && (appointment.status === 'upcoming' || appointment.status === 'next') ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
              Check In
            </Button>
          ) : null}
          {isCheckedIn && currentStatus !== 'next' ? ( // Only show Mark Done if it's truly checked-in and not also 'next'
            <Button onClick={() => onMarkDone(appointment.id)} size="sm" className="rounded-full h-9" disabled={isInteracting}>
              {isInteracting && appointment.status === 'checked-in' ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Mark Done
            </Button>
          ) : null}
        </CardFooter>
      )}
    </Card>
  );
}
