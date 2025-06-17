
'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { Appointment, SpendingEntry } from '@/types';
import { firestore } from '@/firebase/config';
import { collection, query, where, getDocs, orderBy, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, CalendarDays, TrendingUp, Wallet, TrendingDown, LineChart, Banknote } from 'lucide-react';
import { format, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns';
import ManageSpendingsSection from '@/components/barber/ManageSpendingsSection'; // New component

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export default function BarberEarningsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [dailyEarnings, setDailyEarnings] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [dailySpendings, setDailySpendings] = useState(0);
  const [weeklySpendings, setWeeklySpendings] = useState(0);
  const [dailyProfits, setDailyProfits] = useState(0);
  const [weeklyProfits, setWeeklyProfits] = useState(0);

  const [numDailyAppointments, setNumDailyAppointments] = useState(0);
  const [numWeeklyAppointments, setNumWeeklyAppointments] = useState(0);
  
  const [allSpendingsThisWeek, setAllSpendingsThisWeek] = useState<SpendingEntry[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingSpending, setIsProcessingSpending] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchFinancialData = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoading(true);

    try {
      const today = currentDate;
      const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 }); // Monday
      const endOfCurrentWeek = endOfWeek(today, { weekStartsOn: 1 });
      const todayYYYYMMDD = formatDateToYYYYMMDD(today);
      const weekStartYYYYMMDD = formatDateToYYYYMMDD(startOfCurrentWeek);
      const weekEndYYYYMMDD = formatDateToYYYYMMDD(endOfCurrentWeek);

      // Fetch Appointments (Earnings)
      const appointmentsCollection = collection(firestore, 'appointments');
      const appointmentsQuery = query(
        appointmentsCollection,
        where('barberId', '==', user.uid),
        where('status', '==', 'completed'),
        where('date', '>=', weekStartYYYYMMDD),
        where('date', '<=', weekEndYYYYMMDD),
        orderBy('date', 'desc')
      );
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const completedAppointmentsThisWeek: Appointment[] = [];
      appointmentsSnapshot.forEach((doc) => {
        completedAppointmentsThisWeek.push({ id: doc.id, ...doc.data() } as Appointment);
      });

      let dayEarningsSum = 0;
      let dayAppointmentsCount = 0;
      let weekEarningsSum = 0;
      let weekAppointmentsCount = 0;

      completedAppointmentsThisWeek.forEach(app => {
        weekEarningsSum += app.price;
        weekAppointmentsCount++;
        if (app.date === todayYYYYMMDD) {
          dayEarningsSum += app.price;
          dayAppointmentsCount++;
        }
      });
      setDailyEarnings(dayEarningsSum);
      setNumDailyAppointments(dayAppointmentsCount);
      setWeeklyEarnings(weekEarningsSum);
      setNumWeeklyAppointments(weekAppointmentsCount);

      // Fetch Spendings
      const spendingsCollection = collection(firestore, 'spendings');
      const spendingsQuery = query(
        spendingsCollection,
        where('barberId', '==', user.uid),
        where('date', '>=', weekStartYYYYMMDD),
        where('date', '<=', weekEndYYYYMMDD),
        orderBy('date', 'desc')
      );
      const spendingsSnapshot = await getDocs(spendingsQuery);
      const fetchedSpendingsThisWeek: SpendingEntry[] = [];
      spendingsSnapshot.forEach((doc) => {
        fetchedSpendingsThisWeek.push({ id: doc.id, ...doc.data() } as SpendingEntry);
      });
      setAllSpendingsThisWeek(fetchedSpendingsThisWeek);

      let daySpendingsSum = 0;
      let weekSpendingsSum = 0;
      fetchedSpendingsThisWeek.forEach(sp => {
        weekSpendingsSum += sp.amount;
        if (sp.date === todayYYYYMMDD) {
          daySpendingsSum += sp.amount;
        }
      });
      setDailySpendings(daySpendingsSum);
      setWeeklySpendings(weekSpendingsSum);

      // Calculate Profits
      setDailyProfits(dayEarningsSum - daySpendingsSum);
      setWeeklyProfits(weekEarningsSum - weekSpendingsSum);

    } catch (error) {
      console.error("Error fetching financial data:", error);
      toast({ title: "Error", description: "Could not fetch financial data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, toast, currentDate]);

  useEffect(() => {
    setCurrentDate(new Date()); 
  }, []);

  useEffect(() => {
    if (user?.uid) {
      fetchFinancialData();
    }
  }, [user?.uid, fetchFinancialData]);
  
  useEffect(() => {
    const handleFocus = () => {
        setCurrentDate(new Date()); 
        if (user?.uid) {
            fetchFinancialData();
        }
    };
    window.addEventListener('focus', handleFocus);
    return () => {
        window.removeEventListener('focus', handleFocus);
    };
  }, [user?.uid, fetchFinancialData]);

  const handleAddSpending = async (date: string, description: string, amount: number) => {
    if (!user?.uid) {
        toast({ title: "Error", description: "User not found.", variant: "destructive" });
        return;
    }
    setIsProcessingSpending(true);
    try {
        const newSpending: Omit<SpendingEntry, 'id'> = {
            barberId: user.uid,
            date,
            description,
            amount,
            createdAt: Timestamp.now(),
        };
        await addDoc(collection(firestore, 'spendings'), newSpending);
        toast({ title: "Success", description: "Spending entry added." });
        fetchFinancialData(); // Refetch all data to update sums
    } catch (error) {
        console.error("Error adding spending entry:", error);
        toast({ title: "Error", description: "Could not add spending entry.", variant: "destructive" });
    } finally {
        setIsProcessingSpending(false);
    }
  };

  const handleDeleteSpending = async (spendingId: string) => {
    if (!user?.uid) {
        toast({ title: "Error", description: "User not found.", variant: "destructive" });
        return;
    }
    setIsProcessingSpending(true);
    try {
        await deleteDoc(doc(firestore, 'spendings', spendingId));
        toast({ title: "Success", description: "Spending entry deleted." });
        fetchFinancialData(); // Refetch all data to update sums
    } catch (error) {
        console.error("Error deleting spending entry:", error);
        toast({ title: "Error", description: "Could not delete spending entry.", variant: "destructive" });
    } finally {
        setIsProcessingSpending(false);
    }
  };

  return (
    <ProtectedPage expectedRole="barber">
      <div className="space-y-8">
        <h1 className="text-2xl font-bold font-headline">My Financials</h1>

        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-10 w-10 text-primary" />
            <p className="ml-3 text-lg">Loading financial data...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Daily Cards */}
              <Card className="border-none shadow-xl rounded-xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
                <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-primary/10 via-background to-background">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center"><CalendarDays className="mr-2 h-6 w-6 text-primary" />Today's Earnings</CardTitle>
                    <Wallet className="h-8 w-8 text-primary/70" />
                  </div>
                  <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">{format(currentDate, 'eeee, MMM d')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6"><p className="text-4xl font-bold text-primary mb-1">{formatCurrency(dailyEarnings)}</p><p className="text-sm text-muted-foreground">From {numDailyAppointments} appointment(s)</p></CardContent>
              </Card>

              <Card className="border-none shadow-xl rounded-xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
                <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-destructive/10 via-background to-background">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center"><TrendingDown className="mr-2 h-6 w-6 text-destructive" />Today's Spendings</CardTitle>
                    <Banknote className="h-8 w-8 text-destructive/70" />
                  </div>
                   <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">{format(currentDate, 'eeee, MMM d')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6"><p className="text-4xl font-bold text-destructive mb-1">{formatCurrency(dailySpendings)}</p><p className="text-sm text-muted-foreground">Manually entered for today</p></CardContent>
              </Card>

              <Card className="border-none shadow-xl rounded-xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
                 <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-green-500/10 via-background to-background">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center"><LineChart className="mr-2 h-6 w-6 text-green-600" />Today's Profits</CardTitle>
                    <DollarSign className="h-8 w-8 text-green-600/70" />
                  </div>
                   <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">{format(currentDate, 'eeee, MMM d')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6"><p className="text-4xl font-bold text-green-600 mb-1">{formatCurrency(dailyProfits)}</p><p className="text-sm text-muted-foreground">Earnings - Spendings</p></CardContent>
              </Card>

              {/* Weekly Cards */}
              <Card className="border-none shadow-xl rounded-xl overflow-hidden transform hover:scale-105 transition-transform duration-300 md:col-start-1">
                <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-accent/10 via-background to-background">
                   <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-bold flex items-center"><TrendingUp className="mr-2 h-6 w-6 text-accent" />This Week's Earnings</CardTitle>
                       <Wallet className="h-8 w-8 text-accent/70" />
                  </div>
                  <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">{format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6"><p className="text-4xl font-bold text-accent mb-1">{formatCurrency(weeklyEarnings)}</p><p className="text-sm text-muted-foreground">From {numWeeklyAppointments} appointment(s)</p></CardContent>
              </Card>

              <Card className="border-none shadow-xl rounded-xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
                <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-red-500/10 via-background to-background">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center"><TrendingDown className="mr-2 h-6 w-6 text-red-600" />This Week's Spendings</CardTitle>
                    <Banknote className="h-8 w-8 text-red-600/70" />
                  </div>
                  <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">{format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6"><p className="text-4xl font-bold text-red-600 mb-1">{formatCurrency(weeklySpendings)}</p><p className="text-sm text-muted-foreground">Total manually entered</p></CardContent>
              </Card>

              <Card className="border-none shadow-xl rounded-xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
                <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-emerald-500/10 via-background to-background">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center"><LineChart className="mr-2 h-6 w-6 text-emerald-600" />This Week's Profits</CardTitle>
                     <DollarSign className="h-8 w-8 text-emerald-600/70" />
                  </div>
                  <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">{format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6"><p className="text-4xl font-bold text-emerald-600 mb-1">{formatCurrency(weeklyProfits)}</p><p className="text-sm text-muted-foreground">Earnings - Spendings</p></CardContent>
              </Card>
            </div>
            
            <ManageSpendingsSection
                spendingsThisWeek={allSpendingsThisWeek}
                onAddSpending={handleAddSpending}
                onDeleteSpending={handleDeleteSpending}
                isProcessing={isProcessingSpending}
                currentDashboardDate={currentDate}
            />

            <Card className="mt-8 border-none shadow-lg rounded-xl overflow-hidden">
                <CardHeader className="p-4 md:p-6"><CardTitle className="text-lg font-semibold">Note</CardTitle></CardHeader>
                <CardContent className="p-4 md:p-6 pt-0"><p className="text-sm text-muted-foreground">Earnings are from 'completed' appointments. Spendings are manually entered. Profits are Earnings - Spendings. Data reflects last refresh.</p></CardContent>
            </Card>
          </>
        )}
      </div>
    </ProtectedPage>
  );
}
