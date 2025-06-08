
'use client';

import type { ChangeEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { AppUser, BarberService, Appointment, DayAvailability, BarberScheduleDoc } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { firestore } from '@/firebase/config';
import { collection, doc, getDoc, getDocs, query, where, addDoc, Timestamp, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { AlertCircle, CalendarDays, CheckCircle, ChevronLeft, Clock, DollarSign, Scissors, Users } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

type BookingStep = 'selectService' | 'selectDateTime' | 'confirm' | 'confirmed' | 'queued';

// Helper to parse "HH:MM AM/PM" to minutes from midnight
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

// Helper to format minutes from midnight to "HH:MM AM/PM"
const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h % 12 === 0 ? 12 : h % 12;
  const modifier = h < 12 || h === 24 ? 'AM' : 'PM';
  return `${String(hours).padStart(2, '0')}:${String(m).padStart(2, '0')} ${modifier}`;
};


export default function BookingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const barberId = params.barberId as string;
  const { toast } = useToast();

  const [barber, setBarber] = useState<AppUser | null>(null);
  const [services, setServices] = useState<BarberService[]>([]);
  const [schedule, setSchedule] = useState<DayAvailability[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([]);

  const [selectedService, setSelectedService] = useState<BarberService | null>(null);
  const [selectedDate, setSelectedDate] = useState<'today' | 'tomorrow'>('today');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);

  const [bookingStep, setBookingStep] = useState<BookingStep>('selectService');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for queue view
  const [newlyBookedAppointment, setNewlyBookedAppointment] = useState<Appointment | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number | null>(null);
  const [currentlyServingCustomerName, setCurrentlyServingCustomerName] = useState<string | null>(null);
  const [isCurrentUserNext, setIsCurrentUserNext] = useState<boolean>(false);


  const getDisplayDate = (value: 'today' | 'tomorrow'): string => {
    const date = new Date();
    if (value === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    }
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const getYYYYMMDD = (value: 'today' | 'tomorrow'): string => {
    const date = new Date();
    if (value === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    }
    return date.toISOString().split('T')[0];
  };

  const fetchBarberData = useCallback(async () => {
    if (!barberId) return;
    setIsLoading(true);
    try {
      // Fetch barber details
      const barberDocRef = doc(firestore, 'users', barberId);
      const barberDocSnap = await getDoc(barberDocRef);
      if (barberDocSnap.exists() && barberDocSnap.data().role === 'barber') {
        setBarber({ id: barberDocSnap.id, ...barberDocSnap.data() } as AppUser);
      } else {
        toast({ title: "Error", description: "Barber not found.", variant: "destructive" });
        router.push('/customer/dashboard');
        return;
      }

      // Fetch services
      const servicesQuery = query(collection(firestore, 'services'), where('barberId', '==', barberId), orderBy('createdAt', 'desc'));
      const servicesSnapshot = await getDocs(servicesQuery);
      setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BarberService)));

      // Fetch schedule
      const scheduleDocRef = doc(firestore, 'barberSchedules', barberId);
      const scheduleDocSnap = await getDoc(scheduleDocRef);
      if (scheduleDocSnap.exists()) {
        setSchedule((scheduleDocSnap.data() as BarberScheduleDoc).schedule);
      } else {
        // Default to closed all week if no schedule, or handle as needed
        const defaultSchedule: DayAvailability[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => ({ day: day as DayAvailability['day'], isOpen: false, startTime: '09:00 AM', endTime: '05:00 PM' }));
        setSchedule(defaultSchedule);
      }

      // Fetch existing appointments for today and tomorrow to calculate availability
      const todayStr = new Date().toISOString().split('T')[0];
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

      const appointmentsQuery = query(
        collection(firestore, 'appointments'),
        where('barberId', '==', barberId),
        where('date', 'in', [todayStr, tomorrowStr])
      );
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      setExistingAppointments(appointmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));

    } catch (error) {
      console.error("Error fetching barber data:", error);
      toast({ title: "Error", description: "Could not load barber information.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [barberId, toast, router]);

  useEffect(() => {
    fetchBarberData();
  }, [fetchBarberData]);

  useEffect(() => {
    if (!selectedService || !schedule.length) {
      setAvailableTimeSlots([]);
      return;
    }

    const targetDateStr = getYYYYMMDD(selectedDate);
    const dayOfWeek = new Date(targetDateStr).toLocaleDateString('en-US', { weekday: 'long' }) as DayAvailability['day'];
    const daySchedule = schedule.find(d => d.day === dayOfWeek);

    if (!daySchedule || !daySchedule.isOpen) {
      setAvailableTimeSlots([]);
      return;
    }

    const slots: string[] = [];
    const serviceDuration = selectedService.duration;
    let currentTimeMinutes = timeToMinutes(daySchedule.startTime);
    const endTimeMinutes = timeToMinutes(daySchedule.endTime);

    const bookedSlots = existingAppointments
      .filter(app => app.date === targetDateStr)
      .map(app => ({
        start: timeToMinutes(app.startTime),
        end: timeToMinutes(app.endTime),
      }));

    while (currentTimeMinutes + serviceDuration <= endTimeMinutes) {
      const slotEndMinutes = currentTimeMinutes + serviceDuration;
      const isSlotFree = !bookedSlots.some(
        bookedSlot => currentTimeMinutes < bookedSlot.end && slotEndMinutes > bookedSlot.start
      );

      // Ensure slot is not in the past if selectedDate is today
      let isSlotInFuture = true;
      if (selectedDate === 'today') {
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        if (currentTimeMinutes < nowMinutes) {
          isSlotInFuture = false;
        }
      }

      if (isSlotFree && isSlotInFuture) {
        slots.push(minutesToTime(currentTimeMinutes));
      }
      currentTimeMinutes += 15; // Check for slots every 15 minutes
    }
    setAvailableTimeSlots(slots);
    setSelectedTimeSlot(null); // Reset selected time slot when service or date changes
  }, [selectedService, selectedDate, schedule, existingAppointments]);


  const handleServiceSelect = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service || null);
    setBookingStep('selectDateTime');
  };

  const handleDateChange = (value: 'today' | 'tomorrow') => {
    setSelectedDate(value);
    setSelectedTimeSlot(null);
  };

  const handleTimeSlotSelect = (time: string) => {
    setSelectedTimeSlot(time);
  };

  const handleProceedToConfirm = () => {
    if (selectedService && selectedTimeSlot) {
      setBookingStep('confirm');
    } else {
      toast({ title: "Missing information", description: "Please select a service, date, and time.", variant: "destructive" });
    }
  };
  
  const fetchAndCalculateQueueInfo = async (bookedAppointment: Appointment) => {
    if (!barberId || !bookedAppointment) return;
  
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const q = query(
        collection(firestore, 'appointments'),
        where('barberId', '==', barberId),
        where('date', '==', todayStr), // Only today's appointments for queue
        where('status', 'in', ['upcoming', 'checked-in']),
        orderBy('startTime') // Firestore string sort for "HH:MM AM/PM" might not be perfect, manual sort after fetch
      );
  
      const snapshot = await getDocs(q);
      let todaysOpenAppointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      
      // Manual sort for "HH:MM AM/PM" times
      todaysOpenAppointments.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

      // Add the newly booked appointment to the list if it's for today and not already present
      // This is important if the Firestore write hasn't propagated to the query yet
      if (bookedAppointment.date === todayStr && !todaysOpenAppointments.find(app => app.id === bookedAppointment.id)) {
          todaysOpenAppointments.push(bookedAppointment);
          todaysOpenAppointments.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      }
  
      let position = -1;
      let waitTime = 0;
      let servingName: string | null = null;
      let userIsNext = false;
      let foundCurrentUser = false;
  
      const bookedAppointmentService = services.find(s => s.id === bookedAppointment.serviceId);
      const bookedAppointmentDuration = bookedAppointmentService?.duration || 30; // Fallback

      for (let i = 0; i < todaysOpenAppointments.length; i++) {
        const app = todaysOpenAppointments[i];
        const serviceDetails = services.find(s => s.id === app.serviceId) || { duration: 30 }; // Fallback
  
        if (app.id === bookedAppointment.id) {
          position = i + 1;
          foundCurrentUser = true;
        }
  
        if (app.status === 'checked-in') {
          servingName = app.customerName;
          // If this 'checked-in' appointment is before the user, add its duration to wait time
          if (!foundCurrentUser) {
            waitTime += serviceDetails.duration;
          }
        } else if (app.status === 'upcoming') {
          // If this 'upcoming' appointment is before the user, add its duration
          if (!foundCurrentUser) {
            waitTime += serviceDetails.duration;
          }
          // Check if user is next after a 'checked-in' appointment or if user is first
          if (servingName && todaysOpenAppointments[i-1]?.status === 'checked-in' && app.id === bookedAppointment.id) {
            userIsNext = true;
          } else if (!servingName && i === 0 && app.id === bookedAppointment.id) {
            // No one is being served, and current user is the first in upcoming
            userIsNext = true; 
          }
        }
      }
      
      // If user is first in line and no one is 'checked-in', they are effectively next
      if (position === 1 && !servingName) {
        userIsNext = true;
      }
      
      // If user is 'checked-in' (shouldn't happen for new booking, but good to handle), wait time is 0
      if (bookedAppointment.status === 'checked-in') {
          waitTime = 0;
          position = 1; // Or display as "Currently Serving"
          userIsNext = false; // Not 'next' if being served
      }


      setQueuePosition(position > 0 ? position : null);
      setEstimatedWaitTime(waitTime);
      setCurrentlyServingCustomerName(servingName);
      setIsCurrentUserNext(userIsNext);
      setBookingStep('queued');

    } catch (error) {
      console.error("Error calculating queue info:", error);
      toast({ title: "Queue Error", description: "Could not retrieve current queue information.", variant: "destructive" });
      // Fallback to simple confirmed message if queue calculation fails
      setBookingStep('confirmed');
    }
  };


  const handleConfirmBooking = async () => {
    if (!user || !selectedService || !selectedTimeSlot || !barber) {
      toast({ title: "Error", description: "Missing booking information.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const appointmentDate = getYYYYMMDD(selectedDate);
      const appointmentStartTime = selectedTimeSlot;
      const serviceDuration = selectedService.duration;
      const appointmentEndTime = minutesToTime(timeToMinutes(appointmentStartTime) + serviceDuration);

      const newAppointmentData = {
        barberId: barber.uid,
        barberName: `${barber.firstName} ${barber.lastName}`,
        customerId: user.uid,
        customerName: `${user.firstName} ${user.lastName}`,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        date: appointmentDate,
        startTime: appointmentStartTime,
        endTime: appointmentEndTime,
        status: 'upcoming' as Appointment['status'],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(firestore, 'appointments'), newAppointmentData);
      const finalAppointment: Appointment = { id: docRef.id, ...newAppointmentData };
      setNewlyBookedAppointment(finalAppointment);

      toast({ title: "Booking Confirmed!", description: "Your appointment has been successfully booked." });
      
      if (finalAppointment.date === getYYYYMMDD('today')) { // Only show queue for today's bookings
        await fetchAndCalculateQueueInfo(finalAppointment);
      } else {
        setBookingStep('confirmed'); // For future bookings, just show simple confirmation
      }

    } catch (error) {
      console.error("Error confirming booking:", error);
      toast({ title: "Booking Failed", description: "Could not confirm your appointment. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };


  if (isLoading) {
    return (
      <ProtectedPage expectedRole="customer">
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
          <LoadingSpinner className="h-12 w-12 text-primary" />
          <p className="ml-3 text-lg">Loading barber details...</p>
        </div>
      </ProtectedPage>
    );
  }

  if (!barber) {
    return (
      <ProtectedPage expectedRole="customer">
        <div className="text-center py-10">
          <h2 className="text-2xl font-semibold text-destructive">Barber not found.</h2>
          <Button onClick={() => router.push('/customer/dashboard')} className="mt-4">Go Back</Button>
        </div>
      </ProtectedPage>
    );
  }
  
  const renderStepContent = () => {
    switch (bookingStep) {
      case 'selectService':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Select a Service</CardTitle>
              <CardDescription>Choose from the services offered by {barber.firstName || 'this barber'}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {services.length === 0 ? (
                <p className="text-muted-foreground">This barber has not listed any services yet.</p>
              ) : (
                services.map(service => (
                  <Button
                    key={service.id}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3"
                    onClick={() => handleServiceSelect(service.id)}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{service.name}</span>
                      <span className="text-sm text-muted-foreground">
                        <DollarSign className="inline h-3 w-3 mr-1" />{service.price.toFixed(2)}
                        <Clock className="inline h-3 w-3 ml-3 mr-1" />{service.duration} min
                      </span>
                    </div>
                  </Button>
                ))
              )}
            </CardContent>
          </Card>
        );

      case 'selectDateTime':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Pick Date & Time</CardTitle>
              <CardDescription>
                Selected service: <span className="font-semibold">{selectedService?.name}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-md font-medium mb-2 block">Select Date</Label>
                <RadioGroup
                  defaultValue="today"
                  onValueChange={(value: 'today' | 'tomorrow') => handleDateChange(value)}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="today" id="today" />
                    <Label htmlFor="today" className="text-base cursor-pointer hover:text-primary">{getDisplayDate('today')} (Today)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="tomorrow" id="tomorrow" />
                    <Label htmlFor="tomorrow" className="text-base cursor-pointer hover:text-primary">{getDisplayDate('tomorrow')} (Tomorrow)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-md font-medium mb-2 block">Select Time Slot</Label>
                {availableTimeSlots.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {availableTimeSlots.map(slot => (
                      <Button
                        key={slot}
                        variant={selectedTimeSlot === slot ? 'default' : 'outline'}
                        onClick={() => handleTimeSlotSelect(slot)}
                        className="button-tap-target"
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No available time slots for the selected service and date.</p>
                )}
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setBookingStep('selectService')}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back to Services
                </Button>
                <Button onClick={handleProceedToConfirm} disabled={!selectedTimeSlot || !selectedService}>
                  Proceed to Confirmation
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'confirm':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Confirm Booking</CardTitle>
              <CardDescription>Please review your appointment details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-lg">
                <p><Scissors className="inline mr-2 h-5 w-5 text-primary" /> Service: <span className="font-semibold">{selectedService?.name}</span></p>
                <p><Users className="inline mr-2 h-5 w-5 text-primary" /> With: <span className="font-semibold">{barber.firstName} {barber.lastName}</span></p>
                <p><CalendarDays className="inline mr-2 h-5 w-5 text-primary" /> Date: <span className="font-semibold">{getDisplayDate(selectedDate)}</span></p>
                <p><Clock className="inline mr-2 h-5 w-5 text-primary" /> Time: <span className="font-semibold">{selectedTimeSlot}</span></p>
                <p><DollarSign className="inline mr-2 h-5 w-5 text-primary" /> Price: <span className="font-semibold">${selectedService?.price.toFixed(2)}</span></p>
              </div>
              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={() => setBookingStep('selectDateTime')}>
                     <ChevronLeft className="mr-2 h-4 w-4" /> Back to Time Selection
                </Button>
                <Button onClick={handleConfirmBooking} className="w-full md:w-auto text-lg py-3 px-6 button-tap-target" disabled={isSubmitting}>
                  {isSubmitting ? <LoadingSpinner className="mr-2" /> : null}
                  Confirm Booking
                </Button>
              </div>
            </CardContent>
          </Card>
        );

        case 'confirmed':
            return (
              <Card className="text-center">
                <CardHeader>
                  <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
                  <CardTitle className="text-3xl">Booking Confirmed!</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-lg">
                  <p>Your appointment for <span className="font-semibold">{newlyBookedAppointment?.serviceName}</span></p>
                  <p>with <span className="font-semibold">{barber.firstName} {barber.lastName}</span></p>
                  <p>on <span className="font-semibold">{newlyBookedAppointment ? getDisplayDate(newlyBookedAppointment.date === getYYYYMMDD('today') ? 'today' : 'tomorrow') : ''} at {newlyBookedAppointment?.startTime}</span></p>
                  <p>has been successfully booked.</p>
                  <Button onClick={() => router.push('/customer/dashboard')} className="mt-6 text-lg py-3 px-6">
                    Back to Dashboard
                  </Button>
                </CardContent>
              </Card>
            );
        
        case 'queued':
            return (
                <Card className="text-center">
                <CardHeader>
                    {isCurrentUserNext && <AlertCircle className="mx-auto h-16 w-16 text-primary mb-4" />}
                    {!isCurrentUserNext && queuePosition && <Users className="mx-auto h-16 w-16 text-primary mb-4" />}
                    <CardTitle className="text-3xl">
                    {isCurrentUserNext ? "You're Next!" : (queuePosition ? `You are #${queuePosition} in line` : "Queue Information")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-lg">
                    {newlyBookedAppointment && (
                    <>
                        <p>For your <span className="font-semibold">{newlyBookedAppointment.serviceName}</span> appointment</p>
                        <p>at <span className="font-semibold">{newlyBookedAppointment.startTime}</span> today.</p>
                    </>
                    )}
                    {estimatedWaitTime !== null && estimatedWaitTime > 0 && !isCurrentUserNext && (
                    <p className="font-semibold text-primary">Estimated wait: ~{estimatedWaitTime} minutes</p>
                    )}
                    {currentlyServingCustomerName && (
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">{currentlyServingCustomerName}</span> is currently being served.</p>
                    )}
                    {!currentlyServingCustomerName && queuePosition === 1 && (
                         <p className="text-muted-foreground">You are at the front of the queue.</p>
                    )}
                    <p className="text-xs text-muted-foreground pt-2">
                        Note: Queue information is based on current bookings and may change. It does not update in real-time on this screen.
                    </p>
                    <Button onClick={() => router.push('/customer/dashboard')} className="mt-6 text-lg py-3 px-6">
                    Back to Dashboard
                    </Button>
                </CardContent>
                </Card>
            );

      default:
        return null;
    }
  };

  return (
    <ProtectedPage expectedRole="customer">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-headline font-bold">
            Book with {barber.firstName || APP_NAME}
            </h1>
            { bookingStep !== 'selectService' && bookingStep !== 'queued' && bookingStep !== 'confirmed' && (
                 <Button variant="link" onClick={() => router.push('/customer/dashboard')} className="text-sm">
                    Cancel & Go Back
                </Button>
            )}
        </div>
        {renderStepContent()}
      </div>
    </ProtectedPage>
  );
}

