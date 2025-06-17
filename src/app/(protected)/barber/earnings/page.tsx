
'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { Appointment } from '@/types';
import { firestore } from '@/firebase/config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, CalendarDays, TrendingUp, Wallet } from 'lucide-react';
import { format, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function BarberEarningsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [dailyEarnings, setDailyEarnings] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [numDailyAppointments, setNumDailyAppointments] = useState(0);
  const [numWeeklyAppointments, setNumWeeklyAppointments] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchEarningsData = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoading(true);

    try {
      const today = currentDate;
      const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 }); // Monday
      const endOfCurrentWeek = endOfWeek(today, { weekStartsOn: 1 }); // Sunday

      const appointmentsCollection = collection(firestore, 'appointments');
      const q = query(
        appointmentsCollection,
        where('barberId', '==', user.uid),
        where('status', '==', 'completed'),
        where('date', '>=', format(startOfCurrentWeek, 'yyyy-MM-dd')),
        where('date', '<=', format(endOfCurrentWeek, 'yyyy-MM-dd')),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const completedAppointmentsThisWeek: Appointment[] = [];
      querySnapshot.forEach((doc) => {
        completedAppointmentsThisWeek.push({ id: doc.id, ...doc.data() } as Appointment);
      });

      let daySum = 0;
      let dayCount = 0;
      let weekSum = 0;
      let weekCount = 0;

      completedAppointmentsThisWeek.forEach(app => {
        const appDate = parseISO(app.date); // 'yyyy-MM-dd' string to Date

        // Weekly calculation (all appointments fetched are for this week)
        weekSum += app.price;
        weekCount++;

        // Daily calculation
        if (isSameDay(appDate, today)) {
          daySum += app.price;
          dayCount++;
        }
      });

      setDailyEarnings(daySum);
      setNumDailyAppointments(dayCount);
      setWeeklyEarnings(weekSum);
      setNumWeeklyAppointments(weekCount);

    } catch (error) {
      console.error("Error fetching earnings data:", error);
      toast({ title: "Error", description: "Could not fetch earnings data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, toast, currentDate]);

  useEffect(() => {
    setCurrentDate(new Date()); // Ensure currentDate is fresh on component mount/focus
  }, []);


  useEffect(() => {
    if (user?.uid) {
      fetchEarningsData();
    }
  }, [user?.uid, fetchEarningsData]);
  
  // Optionally refetch when window gets focus, to update if user left tab open
  useEffect(() => {
    const handleFocus = () => {
        setCurrentDate(new Date()); // Refresh current date
        if (user?.uid) {
            fetchEarningsData();
        }
    };
    window.addEventListener('focus', handleFocus);
    return () => {
        window.removeEventListener('focus', handleFocus);
    };
  }, [user?.uid, fetchEarningsData]);


  return (
    <ProtectedPage expectedRole="barber">
      <div className="space-y-8">
        <h1 className="text-2xl font-bold font-headline">My Earnings</h1>

        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-10 w-10 text-primary" />
            <p className="ml-3 text-lg">Loading earnings data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-xl rounded-xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
              <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-primary/10 via-background to-background">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center">
                        <CalendarDays className="mr-2 h-6 w-6 text-primary" />
                        Today's Earnings
                    </CardTitle>
                    <Wallet className="h-8 w-8 text-primary/70" />
                </div>
                <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {format(currentDate, 'eeee, MMMM do, yyyy')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <p className="text-4xl font-bold text-primary mb-1">{formatCurrency(dailyEarnings)}</p>
                <p className="text-sm text-muted-foreground">
                  From {numDailyAppointments} completed appointment(s) today.
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl rounded-xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
              <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-accent/10 via-background to-background">
                 <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center">
                        <TrendingUp className="mr-2 h-6 w-6 text-accent" />
                        This Week's Earnings
                    </CardTitle>
                     <DollarSign className="h-8 w-8 text-accent/70" />
                </div>
                <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <p className="text-4xl font-bold text-accent mb-1">{formatCurrency(weeklyEarnings)}</p>
                <p className="text-sm text-muted-foreground">
                  From {numWeeklyAppointments} completed appointment(s) this week.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
        <Card className="mt-8 border-none shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-lg font-semibold">Note</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
                <p className="text-sm text-muted-foreground">
                    Earnings are calculated based on the price of services marked as 'completed'. This page reflects data as of the last refresh. All amounts are estimates and do not include any fees or deductions. For precise accounting, please refer to your financial records.
                </p>
            </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}

