/**
 * @fileoverview Barber Earnings Page.
 * This page provides barbers with a financial overview, displaying:
 * - Daily and weekly earnings from completed appointments.
 * - Daily and weekly spendings manually entered by the barber.
 * - Calculated daily and weekly profits (Earnings - Spendings).
 * It also includes a section for barbers to manage (add/delete) their spending entries.
 * Data is fetched from Firestore.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage'; // Ensures authenticated barber access.
import { useAuth } from '@/hooks/useAuth'; // Auth context hook.
import type { Appointment, SpendingEntry } from '@/types'; // Type definitions.
import { firestore } from '@/firebase/config'; // Firebase Firestore instance.
import { collection, query, where, getDocs, orderBy, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'; // Firestore methods.
import { useToast } from '@/hooks/use-toast'; // Toast notification hook.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Card UI component.
import { DollarSign, CalendarDays, TrendingUp, Wallet, TrendingDown, LineChart, Banknote } from 'lucide-react'; // Icons.
import { format, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns'; // Date formatting utilities.
import ManageSpendingsSection from '@/components/barber/ManageSpendingsSection'; // Component for managing spendings.

/**
 * Formats a number as currency (USD).
 * @param {number} amount - The amount to format.
 * @returns {string} The formatted currency string.
 */
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

/**
 * Formats a Date object into a YYYY-MM-DD string.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * BarberEarningsPage component.
 * Renders the financial overview page for barbers.
 *
 * @returns {JSX.Element} The rendered earnings page.
 */
export default function BarberEarningsPage() {
  const { user } = useAuth(); // Get current authenticated barber.
  const { toast } = useToast(); // Hook for displaying notifications.

  // State for financial summaries.
  const [dailyEarnings, setDailyEarnings] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [dailySpendings, setDailySpendings] = useState(0);
  const [weeklySpendings, setWeeklySpendings] = useState(0);
  const [dailyProfits, setDailyProfits] = useState(0);
  const [weeklyProfits, setWeeklyProfits] = useState(0);

  // State for appointment counts.
  const [numDailyAppointments, setNumDailyAppointments] = useState(0);
  const [numWeeklyAppointments, setNumWeeklyAppointments] = useState(0);

  // State for all spending entries fetched for the current week.
  const [allSpendingsThisWeek, setAllSpendingsThisWeek] = useState<SpendingEntry[]>([]);

  // Loading states.
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingSpending, setIsProcessingSpending] = useState(false); // True when adding/deleting a spending entry.

  // State for the current date, used as the basis for "today" and "this week".
  // Updated on component mount and window focus to ensure freshness.
  const [currentDate, setCurrentDate] = useState(new Date());

  /**
   * Fetches financial data (earnings from appointments and spendings) for the barber.
   * Calculates daily and weekly totals for earnings, spendings, and profits.
   */
  const fetchFinancialData = useCallback(async () => {
    if (!user?.uid) return; // Ensure user is logged in.
    setIsLoading(true);

    try {
      const today = currentDate; // Use the state's currentDate.
      // Determine the start and end of the current week (Monday to Sunday).
      const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
      const endOfCurrentWeek = endOfWeek(today, { weekStartsOn: 1 });
      // Format dates for Firestore queries.
      const todayYYYYMMDD = formatDateToYYYYMMDD(today);
      const weekStartYYYYMMDD = formatDateToYYYYMMDD(startOfCurrentWeek);
      const weekEndYYYYMMDD = formatDateToYYYYMMDD(endOfCurrentWeek);

      // --- Fetch Appointments (for Earnings) ---
      const appointmentsCollection = collection(firestore, 'appointments');
      // Query for 'completed' appointments within the current week.
      const appointmentsQuery = query(
        appointmentsCollection,
        where('barberId', '==', user.uid),
        where('status', '==', 'completed'), // Only count completed appointments as earnings.
        where('date', '>=', weekStartYYYYMMDD),
        where('date', '<=', weekEndYYYYMMDD),
        orderBy('date', 'desc')
      );
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const completedAppointmentsThisWeek: Appointment[] = [];
      appointmentsSnapshot.forEach((doc) => {
        completedAppointmentsThisWeek.push({ id: doc.id, ...doc.data() } as Appointment);
      });

      // Calculate daily and weekly earnings and appointment counts.
      let dayEarningsSum = 0;
      let dayAppointmentsCount = 0;
      let weekEarningsSum = 0;
      let weekAppointmentsCount = 0;

      completedAppointmentsThisWeek.forEach(app => {
        weekEarningsSum += app.price;
        weekAppointmentsCount++;
        if (app.date === todayYYYYMMDD) { // Check if appointment date is today.
          dayEarningsSum += app.price;
          dayAppointmentsCount++;
        }
      });
      setDailyEarnings(dayEarningsSum);
      setNumDailyAppointments(dayAppointmentsCount);
      setWeeklyEarnings(weekEarningsSum);
      setNumWeeklyAppointments(weekAppointmentsCount);

      // --- Fetch Spendings ---
      const spendingsCollection = collection(firestore, 'spendings');
      // Query for spending entries within the current week.
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
      setAllSpendingsThisWeek(fetchedSpendingsThisWeek); // Store all spendings for the ManageSpendingsSection.

      // Calculate daily and weekly spendings.
      let daySpendingsSum = 0;
      let weekSpendingsSum = 0;
      fetchedSpendingsThisWeek.forEach(sp => {
        weekSpendingsSum += sp.amount;
        if (sp.date === todayYYYYMMDD) { // Check if spending date is today.
          daySpendingsSum += sp.amount;
        }
      });
      setDailySpendings(daySpendingsSum);
      setWeeklySpendings(weekSpendingsSum);

      // --- Calculate Profits ---
      setDailyProfits(dayEarningsSum - daySpendingsSum);
      setWeeklyProfits(weekEarningsSum - weekSpendingsSum);

    } catch (error) {
      console.error("Error fetching financial data:", error);
      toast({ title: "Error", description: "Could not fetch financial data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, toast, currentDate]); // Dependencies for useCallback.

  // Effect to set the initial currentDate on component mount.
  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  // Effect to fetch financial data when user ID or fetchFinancialData function changes.
  useEffect(() => {
    if (user?.uid) {
      fetchFinancialData();
    }
  }, [user?.uid, fetchFinancialData]);

  // Effect to refetch data when the window gains focus.
  // This helps keep the data fresh if the user navigates away and back.
  useEffect(() => {
    const handleFocus = () => {
        setCurrentDate(new Date()); // Update currentDate to ensure calculations are for the actual "today".
        if (user?.uid) {
            fetchFinancialData();
        }
    };
    window.addEventListener('focus', handleFocus);
    return () => { // Cleanup listener on unmount.
        window.removeEventListener('focus', handleFocus);
    };
  }, [user?.uid, fetchFinancialData]);

  /**
   * Handles adding a new spending entry.
   * @param {string} date - The date of the spending (YYYY-MM-DD).
   * @param {string} description - Description of the spending.
   * @param {number} amount - The amount spent.
   */
  const handleAddSpending = async (date: string, description: string, amount: number) => {
    if (!user?.uid) {
        toast({ title: "Error", description: "User not found.", variant: "destructive" });
        return;
    }
    setIsProcessingSpending(true);
    try {
        // Prepare the new spending entry object.
        const newSpending: Omit<SpendingEntry, 'id'> = {
            barberId: user.uid,
            date,
            description,
            amount,
            createdAt: Timestamp.now(), // Record creation time.
        };
        await addDoc(collection(firestore, 'spendings'), newSpending); // Add to Firestore.
        toast({ title: "Success", description: "Spending entry added." });
        fetchFinancialData(); // Refetch all financial data to update summaries.
    } catch (error) {
        console.error("Error adding spending entry:", error);
        toast({ title: "Error", description: "Could not add spending entry.", variant: "destructive" });
    } finally {
        setIsProcessingSpending(false);
    }
  };

  /**
   * Handles deleting a spending entry.
   * @param {string} spendingId - The ID of the spending entry to delete.
   */
  const handleDeleteSpending = async (spendingId: string) => {
    if (!user?.uid) {
        toast({ title: "Error", description: "User not found.", variant: "destructive" });
        return;
    }
    setIsProcessingSpending(true);
    try {
        await deleteDoc(doc(firestore, 'spendings', spendingId)); // Delete from Firestore.
        toast({ title: "Success", description: "Spending entry deleted." });
        fetchFinancialData(); // Refetch all financial data to update summaries.
    } catch (error) {
        console.error("Error deleting spending entry:", error);
        toast({ title: "Error", description: "Could not delete spending entry.", variant: "destructive" });
    } finally {
        setIsProcessingSpending(false);
    }
  };

  return (
    // ProtectedPage ensures only authenticated barbers can access this page.
    <ProtectedPage expectedRole="barber">
      <div className="space-y-8">
        <h1 className="text-2xl font-bold font-headline">My Financials</h1>

        {/* Display loading spinner while data is being fetched. */}
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-10 w-10 text-primary" />
            <p className="ml-3 text-lg">Loading financial data...</p>
          </div>
        ) : (
          <>
            {/* Grid for displaying financial summary cards. */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Daily Earnings Card */}
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center"><CalendarDays className="mr-2 h-6 w-6 text-primary" />Today's Earnings</CardTitle>
                    <Wallet className="h-8 w-8 text-primary/70" />
                  </div>
                  <CardDescription className="text-sm text-muted-foreground mt-1">{format(currentDate, 'eeee, MMM d')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0"><p className="text-4xl font-bold text-primary mb-1">{formatCurrency(dailyEarnings)}</p><p className="text-sm text-muted-foreground">From {numDailyAppointments} appointment(s)</p></CardContent>
              </Card>

              {/* Daily Spendings Card */}
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center"><TrendingDown className="mr-2 h-6 w-6 text-destructive" />Today's Spendings</CardTitle>
                    <Banknote className="h-8 w-8 text-destructive/70" />
                  </div>
                   <CardDescription className="text-sm text-muted-foreground mt-1">{format(currentDate, 'eeee, MMM d')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0"><p className="text-4xl font-bold text-destructive mb-1">{formatCurrency(dailySpendings)}</p><p className="text-sm text-muted-foreground">Manually entered for today</p></CardContent>
              </Card>

              {/* Daily Profits Card */}
              <Card>
                 <CardHeader className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center"><LineChart className="mr-2 h-6 w-6 text-green-600" />Today's Profits</CardTitle>
                    <DollarSign className="h-8 w-8 text-green-600/70" />
                  </div>
                   <CardDescription className="text-sm text-muted-foreground mt-1">{format(currentDate, 'eeee, MMM d')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0"><p className="text-4xl font-bold text-green-600 mb-1">{formatCurrency(dailyProfits)}</p><p className="text-sm text-muted-foreground">Earnings - Spendings</p></CardContent>
              </Card>

              {/* Weekly Earnings Card */}
              <Card className="md:col-start-1">
                <CardHeader className="p-4 md:p-6">
                   <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-bold flex items-center"><TrendingUp className="mr-2 h-6 w-6 text-accent" />This Week's Earnings</CardTitle>
                       <Wallet className="h-8 w-8 text-accent/70" />
                  </div>
                  <CardDescription className="text-sm text-muted-foreground mt-1">{format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0"><p className="text-4xl font-bold text-accent mb-1">{formatCurrency(weeklyEarnings)}</p><p className="text-sm text-muted-foreground">From {numWeeklyAppointments} appointment(s)</p></CardContent>
              </Card>

              {/* Weekly Spendings Card */}
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center"><TrendingDown className="mr-2 h-6 w-6 text-red-600" />This Week's Spendings</CardTitle>
                    <Banknote className="h-8 w-8 text-red-600/70" />
                  </div>
                  <CardDescription className="text-sm text-muted-foreground mt-1">{format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0"><p className="text-4xl font-bold text-red-600 mb-1">{formatCurrency(weeklySpendings)}</p><p className="text-sm text-muted-foreground">Total manually entered</p></CardContent>
              </Card>

              {/* Weekly Profits Card */}
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center"><LineChart className="mr-2 h-6 w-6 text-emerald-600" />This Week's Profits</CardTitle>
                     <DollarSign className="h-8 w-8 text-emerald-600/70" />
                  </div>
                  <CardDescription className="text-sm text-muted-foreground mt-1">{format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0"><p className="text-4xl font-bold text-emerald-600 mb-1">{formatCurrency(weeklyProfits)}</p><p className="text-sm text-muted-foreground">Earnings - Spendings</p></CardContent>
              </Card>
            </div>

            {/* Section for managing spending entries. */}
            <ManageSpendingsSection
                spendingsThisWeek={allSpendingsThisWeek} // Pass all fetched spendings for the week.
                onAddSpending={handleAddSpending}
                onDeleteSpending={handleDeleteSpending}
                isProcessing={isProcessingSpending} // Pass processing state for disabling inputs.
                currentDashboardDate={currentDate} // Pass current date for calendar default.
            />

            {/* Note about data freshness. */}
            <Card className="mt-8">
                <CardHeader className="p-4 md:p-6"><CardTitle className="text-lg font-semibold">Note</CardTitle></CardHeader>
                <CardContent className="p-4 md:p-6 pt-0"><p className="text-sm text-muted-foreground">Earnings are from 'completed' appointments. Spendings are manually entered. Profits are Earnings - Spendings. Data reflects last refresh.</p></CardContent>
            </Card>
          </>
        )}
      </div>
    </ProtectedPage>
  );
}
