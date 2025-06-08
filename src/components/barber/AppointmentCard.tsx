
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Appointment } from '@/types';
import { cn } from '@/lib/utils';
import { User, Clock, CheckCircle2, UserCheck, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../ui/loading-spinner';

interface AppointmentCardProps {
  appointment: Appointment & { displayStatus?: Appointment['status'] }; // displayStatus for UI highlight
  onCheckIn: (appointmentId: string) => Promise<void>;
  onMarkDone: (appointmentId: string) => Promise<void>;
  isInteracting: boolean; // True if any appointment update is in progress
}

export default function AppointmentCard({ appointment, onCheckIn, onMarkDone, isInteracting }: AppointmentCardProps) {
  // Use displayStatus for visual cues, but the actual appointment.status for logic if needed
  const currentStatus = appointment.displayStatus || appointment.status;

  const isNext = currentStatus === 'next';
  const isCheckedIn = currentStatus === 'checked-in';
  const isCompleted = appointment.status === 'completed'; // Original status for "completed" styling

  return (
    <Card className={cn(
      "shadow-lg",
      isNext && "border-primary ring-2 ring-primary",
      isCheckedIn && !isNext && "bg-blue-50", // Don't make 'next' also blue
      isCompleted && "bg-green-50 opacity-70"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
            <CardTitle className={cn("text-xl", isNext && "text-primary")}>
                {appointment.customerName}
            </CardTitle>
            {isNext && <span className="text-xs font-semibold uppercase text-primary px-2 py-1 rounded-full bg-primary/10 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>Next Customer</span>}
        </div>
        <p className="text-sm text-muted-foreground">{appointment.serviceName}</p>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex items-center text-muted-foreground">
          <Clock className="mr-2 h-4 w-4" />
          <span>{appointment.startTime} - {appointment.endTime}</span>
        </div>
      </CardContent>
      {!isCompleted && (
        <CardFooter className="flex justify-end space-x-2">
          {(currentStatus === 'upcoming' || currentStatus === 'next') ? (
            <Button variant="outline" onClick={() => onCheckIn(appointment.id)} size="sm" disabled={isInteracting}>
              {isInteracting && appointment.status === 'upcoming' ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
              Customer is Here
            </Button>
          ) : null}
          {isCheckedIn ? ( // Only show "Mark as Done" if actually checked-in, not if it's 'next' but was 'upcoming'
            <Button onClick={() => onMarkDone(appointment.id)} size="sm" disabled={isInteracting}>
              {isInteracting && appointment.status === 'checked-in' ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Mark as Done
            </Button>
          ) : null}
        </CardFooter>
      )}
    </Card>
  );
}
