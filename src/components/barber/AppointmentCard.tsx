
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Appointment } from '@/types';
import { cn } from '@/lib/utils';
import { User, Clock, CheckCircle2, UserCheck, AlertCircle } from 'lucide-react';

interface AppointmentCardProps {
  appointment: Appointment;
  onCheckIn: (appointmentId: string) => void;
  onMarkDone: (appointmentId: string) => void;
}

export default function AppointmentCard({ appointment, onCheckIn, onMarkDone }: AppointmentCardProps) {
  const isNext = appointment.status === 'next';
  const isCheckedIn = appointment.status === 'checked-in';
  const isCompleted = appointment.status === 'completed';

  return (
    <Card className={cn(
      "shadow-lg",
      isNext && "border-primary ring-2 ring-primary",
      isCheckedIn && "bg-blue-50",
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
          {appointment.status === 'upcoming' || appointment.status === 'next' ? (
            <Button variant="outline" onClick={() => onCheckIn(appointment.id)} size="sm">
              <UserCheck className="mr-2 h-4 w-4" /> Customer is Here
            </Button>
          ) : null}
          {isCheckedIn ? (
            <Button onClick={() => onMarkDone(appointment.id)} size="sm">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as Done
            </Button>
          ) : null}
        </CardFooter>
      )}
    </Card>
  );
}
