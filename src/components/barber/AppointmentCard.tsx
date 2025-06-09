
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Appointment } from '@/types';
import { cn } from '@/lib/utils';
import { User, Clock, CheckCircle2, UserCheck, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../ui/loading-spinner';

interface AppointmentCardProps {
  appointment: Appointment & { displayStatus?: Appointment['status'] }; 
  onCheckIn: (appointmentId: string) => Promise<void>;
  onMarkDone: (appointmentId: string) => Promise<void>;
  isInteracting: boolean; 
}

export default function AppointmentCard({ appointment, onCheckIn, onMarkDone, isInteracting }: AppointmentCardProps) {
  const currentStatus = appointment.displayStatus || appointment.status;

  const isNext = currentStatus === 'next';
  const isCheckedIn = currentStatus === 'checked-in';
  const isCompleted = appointment.status === 'completed'; 

  return (
    <Card className={cn(
      "shadow-lg rounded-xl border",
      isNext && "border-primary ring-2 ring-primary",
      isCheckedIn && !isNext && "bg-blue-500/10", // Using a more vibrant blue from guide potentially
      isCompleted && "bg-green-500/10 opacity-80"
    )}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
            <CardTitle className={cn("text-base font-semibold", isNext && "text-primary")}>
                {appointment.customerName}
            </CardTitle>
            {isNext && <span className="text-xs font-semibold uppercase text-primary px-2 py-1 rounded-full bg-primary/10 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>Next</span>}
        </div>
        <p className="text-sm text-gray-500">{appointment.serviceName}</p>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <div className="flex items-center text-sm text-[#0088E0]">
          <Clock className="mr-2 h-4 w-4" />
          <span>{appointment.startTime} - {appointment.endTime}</span>
        </div>
        {/* Display status text explicitly if needed, e.g., for 'upcoming', 'checked-in' */}
        {/* <p className={cn("text-sm mt-1", currentStatus === 'checked-in' ? "text-[#0088E0]" : "text-gray-500")}>Status: {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}</p> */}
      </CardContent>
      {!isCompleted && (
        <CardFooter className="flex justify-end space-x-2 pb-4 px-4">
          {(currentStatus === 'upcoming' || currentStatus === 'next') ? (
            <Button variant="outline" onClick={() => onCheckIn(appointment.id)} size="sm" className="rounded-full h-9" disabled={isInteracting}>
              {isInteracting && appointment.status === 'upcoming' ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
              Check In
            </Button>
          ) : null}
          {isCheckedIn ? ( 
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
