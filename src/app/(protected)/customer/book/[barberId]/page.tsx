
'use client';

import type { ChangeEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { AppUser, BarberService, Appointment, DayAvailability, BarberScheduleDoc } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { firestore } from '@/firebase/config';
import { collection, doc, getDoc, getDocs, query, where, addDoc, Timestamp, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { AlertCircle, CalendarDays, CheckCircle, ChevronLeft, Clock, DollarSign, Scissors, Users } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

type BookingStep = 'selectService' | 'selectDateTime' | 'confirm' | 'confirmed' | 'queued';

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
      const barberDocRef = doc(firestore, 'users', barberId);
      const barberDocSnap = await getDoc(barberDocRef);
      if (barberDocSnap.exists() && barberDocSnap.data().role === 'barber') {
        setBarber({ id: barberDocSnap.id, ...barberDocSnap.data() } as AppUser);
      } else {
        toast({ title: "Error", description: "Barber not found.", variant: "destructive" });
        router.push('/customer/dashboard');
        return;
      }

      const servicesQuery = query(collection(firestore, 'services'), where('barberId', '==', barberId), orderBy('createdAt', 'desc'));
      const servicesSnapshot = await getDocs(servicesQuery);
      setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BarberService)));

      const scheduleDocRef = doc(firestore, 'barberSchedules', barberId);
      const scheduleDocSnap = await getDoc(scheduleDocRef);
      if (scheduleDocSnap.exists()) {
        setSchedule((scheduleDocSnap.data() as BarberScheduleDoc).schedule);
      } else {
        const defaultSchedule: DayAvailability[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => ({ day: day as DayAvailability['day'], isOpen: false, startTime: '09:00 AM', endTime: '05:00 PM' }));
        setSchedule(defaultSchedule);
      }

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
      currentTimeMinutes += 15; 
    }
    setAvailableTimeSlots(slots);
    setSelectedTimeSlot(null); 
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
        where('date', '==', todayStr), 
        where('status', 'in', ['upcoming', 'checked-in']),
        orderBy('startTime') 
      );
  
      const snapshot = await getDocs(q);
      let todaysOpenAppointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      
      todaysOpenAppointments.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

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
      const bookedAppointmentDuration = bookedAppointmentService?.duration || 30; 

      for (let i = 0; i < todaysOpenAppointments.length; i++) {
        const app = todaysOpenAppointments[i];
        const serviceDetails = services.find(s => s.id === app.serviceId) || { duration: 30 }; 
  
        if (app.id === bookedAppointment.id) {
          position = i + 1;
          foundCurrentUser = true;
        }
  
        if (app.status === 'checked-in') {
          servingName = app.customerName;
          if (!foundCurrentUser) {
            waitTime += serviceDetails.duration;
          }
        } else if (app.status === 'upcoming') {
          if (!foundCurrentUser) {
            waitTime += serviceDetails.duration;
          }
          if (servingName && todaysOpenAppointments[i-1]?.status === 'checked-in' && app.id === bookedAppointment.id) {
            userIsNext = true;
          } else if (!servingName && i === 0 && app.id === bookedAppointment.id) {
            userIsNext = true; 
          }
        }
      }
      
      if (position === 1 && !servingName) {
        userIsNext = true;
      }
      
      if (bookedAppointment.status === 'checked-in') {
          waitTime = 0;
          position = 1; 
          userIsNext = false; 
      }

      setQueuePosition(position > 0 ? position : null);
      setEstimatedWaitTime(waitTime);
      setCurrentlyServingCustomerName(servingName);
      setIsCurrentUserNext(userIsNext);
      setBookingStep('queued');

    } catch (error) {
      console.error("Error calculating queue info:", error);
      toast({ title: "Queue Error", description: "Could not retrieve current queue information.", variant: "destructive" });
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
      
      if (finalAppointment.date === getYYYYMMDD('today')) { 
        await fetchAndCalculateQueueInfo(finalAppointment);
      } else {
        setBookingStep('confirmed'); 
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
          <p className="ml-3 text-base">Loading barber details...</p>
        </div>
      </ProtectedPage>
    );
  }

  if (!barber) {
    return (
      <ProtectedPage expectedRole="customer">
        <div className="text-center py-10">
          <h2 className="text-2xl font-bold text-destructive">Barber not found.</h2>
          <Button onClick={() => router.push('/customer/dashboard')} className="mt-6 h-14 rounded-full px-8 text-lg">Go Back</Button>
        </div>
      </ProtectedPage>
    );
  }
  
  const renderStepContent = () => {
    switch (bookingStep) {
      case 'selectService':
        return (
          <Card className="border-none shadow-none">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-2xl font-bold">Step 1: Select a Service</CardTitle>
              <CardDescription className="text-sm text-gray-500">Choose from the services offered by {barber.firstName || 'this barber'}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 md:p-6">
              {services.length === 0 ? (
                <p className="text-sm text-gray-500">This barber has not listed any services yet.</p>
              ) : (
                services.map(service => (
                  <Button
                    key={service.id}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-4 px-4 rounded-lg border shadow-sm hover:bg-accent/10"
                    onClick={() => handleServiceSelect(service.id)}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-base">{service.name}</span>
                      <span className="text-sm text-gray-500 mt-1">
                        <DollarSign className="inline h-4 w-4 mr-1" />{service.price.toFixed(2)}
                        <Clock className="inline h-4 w-4 ml-3 mr-1" />
                        <span className="text-[#0088E0]">{service.duration} min</span>
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
          <Card className="border-none shadow-none">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-2xl font-bold">Step 2: Pick Date & Time</CardTitle>
              <CardDescription className="text-sm text-gray-500">
                Selected service: <span className="font-semibold text-foreground">{selectedService?.name}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-4 md:p-6">
              <div>
                <Label className="text-base font-medium mb-3 block">Select Date</Label>
                <RadioGroup
                  value={selectedDate}
                  onValueChange={(value: 'today' | 'tomorrow') => handleDateChange(value)}
                  className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-4"
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
                <Label className="text-base font-medium mb-3 block">Select Time Slot</Label>
                {availableTimeSlots.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {availableTimeSlots.map(slot => (
                      <Button
                        key={slot}
                        variant={selectedTimeSlot === slot ? 'default' : 'outline'}
                        onClick={() => handleTimeSlotSelect(slot)}
                        className="h-12 rounded-md text-base"
                      >
                        <span className={selectedTimeSlot === slot ? "" : "text-[#0088E0]"}>{slot}</span>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No available time slots for the selected service and date.</p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row justify-between pt-6 space-y-3 sm:space-y-0 sm:space-x-3">
                <Button variant="outline" onClick={() => setBookingStep('selectService')} className="w-full sm:w-auto h-12 rounded-full text-base">
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back to Services
                </Button>
                <Button onClick={handleProceedToConfirm} disabled={!selectedTimeSlot || !selectedService} className="w-full sm:w-auto h-12 rounded-full text-base">
                  Proceed to Confirmation
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'confirm':
        return (
          <Card className="border-none shadow-none">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-2xl font-bold">Step 3: Confirm Booking</CardTitle>
              <CardDescription className="text-sm text-gray-500">Please review your appointment details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 md:p-6">
              <div className="space-y-2 text-base">
                <p><Scissors className="inline mr-2 h-5 w-5 text-primary" /> Service: <span className="font-semibold">{selectedService?.name}</span></p>
                <p><Users className="inline mr-2 h-5 w-5 text-primary" /> With: <span className="font-semibold">{barber.firstName} {barber.lastName}</span></p>
                <p><CalendarDays className="inline mr-2 h-5 w-5 text-primary" /> Date: <span className="font-semibold">{getDisplayDate(selectedDate)}</span></p>
                <p><Clock className="inline mr-2 h-5 w-5 text-primary" /> Time: <span className="font-semibold text-[#0088E0]">{selectedTimeSlot}</span></p>
                <p><DollarSign className="inline mr-2 h-5 w-5 text-primary" /> Price: <span className="font-semibold">${selectedService?.price.toFixed(2)}</span></p>
              </div>
              <div className="flex flex-col sm:flex-row justify-between pt-8 space-y-3 sm:space-y-0 sm:space-x-3">
                <Button variant="outline" onClick={() => setBookingStep('selectDateTime')} className="w-full sm:w-auto h-12 rounded-full text-base">
                     <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleConfirmBooking} className="w-full sm:w-auto h-14 rounded-full text-lg" disabled={isSubmitting}>
                  {isSubmitting ? <LoadingSpinner className="mr-2 h-5 w-5" /> : null}
                  Confirm Booking
                </Button>
              </div>
            </CardContent>
          </Card>
        );

        case 'confirmed':
            return (
              <Card className="text-center border-none shadow-none p-4 md:p-6">
                <CardHeader>
                  <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
                  <CardTitle className="text-2xl font-bold">Booking Confirmed!</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-base">
                  <p>Your appointment for <span className="font-semibold">{newlyBookedAppointment?.serviceName}</span></p>
                  <p>with <span className="font-semibold">{barber.firstName} {barber.lastName}</span></p>
                  <p>on <span className="font-semibold">{newlyBookedAppointment ? getDisplayDate(newlyBookedAppointment.date === getYYYYMMDD('today') ? 'today' : 'tomorrow') : ''} at <span className="text-[#0088E0]">{newlyBookedAppointment?.startTime}</span></span></p>
                  <p>has been successfully booked.</p>
                  <Button onClick={() => router.push('/customer/dashboard')} className="mt-8 w-full max-w-xs mx-auto h-14 rounded-full text-lg">
                    Back to Dashboard
                  </Button>
                </CardContent>
              </Card>
            );
        
        case 'queued':
            return (
                <Card className="text-center border-none shadow-none p-4 md:p-6">
                <CardHeader>
                    {isCurrentUserNext && <AlertCircle className="mx-auto h-16 w-16 text-primary mb-4" />}
                    {!isCurrentUserNext && queuePosition && <Users className="mx-auto h-16 w-16 text-primary mb-4" />}
                    <CardTitle className="text-2xl font-bold">
                    {isCurrentUserNext ? "You're Next!" : (queuePosition ? `You are #${queuePosition} in line` : "Queue Information")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-base">
                    {newlyBookedAppointment && (
                    <>
                        <p>For your <span className="font-semibold">{newlyBookedAppointment.serviceName}</span> appointment</p>
                        <p>at <span className="font-semibold text-[#0088E0]">{newlyBookedAppointment.startTime}</span> today.</p>
                    </>
                    )}
                    {estimatedWaitTime !== null && estimatedWaitTime > 0 && !isCurrentUserNext && (
                    <p className="font-semibold text-primary">Estimated wait: ~{estimatedWaitTime} minutes</p>
                    )}
                    {currentlyServingCustomerName && (
                    <p className="text-sm text-gray-500"><span className="font-medium text-foreground">{currentlyServingCustomerName}</span> is currently being served.</p>
                    )}
                    {!currentlyServingCustomerName && queuePosition === 1 && (
                         <p className="text-sm text-gray-500">You are at the front of the queue.</p>
                    )}
                    <p className="text-xs text-gray-500 pt-4">
                        Note: Queue information is based on current bookings and may change.
                    </p>
                    <Button onClick={() => router.push('/customer/dashboard')} className="mt-8 w-full max-w-xs mx-auto h-14 rounded-full text-lg">
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-headline">
            Book with {barber.firstName || APP_NAME}
            </h1>
            { bookingStep !== 'selectService' && bookingStep !== 'queued' && bookingStep !== 'confirmed' && (
                 <Button variant="link" onClick={() => router.push('/customer/dashboard')} className="text-sm text-primary">
                    Cancel & Go Back
                </Button>
            )}
        </div>
        {renderStepContent()}
      </div>
    </ProtectedPage>
  );
}
