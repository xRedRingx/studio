
'use client';

import type { FormEvent } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SpendingEntry } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CalendarDays, PlusCircle, Trash2, Info, DollarSign } from 'lucide-react';
import LoadingSpinner from '@/components/ui/loading-spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger, // Added missing import
} from "@/components/ui/alert-dialog";
import { format, parseISO, isSameDay } from 'date-fns';


interface ManageSpendingsSectionProps {
  spendingsThisWeek: SpendingEntry[]; // All spendings for the current week fetched by parent
  onAddSpending: (date: string, description: string, amount: number) => Promise<void>;
  onDeleteSpending: (spendingId: string) => Promise<void>;
  isProcessing: boolean;
  currentDashboardDate: Date; // To default the calendar
}

const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const formatDisplayDate = (dateStr: string): string => {
  return format(parseISO(dateStr), 'eeee, MMMM do, yyyy');
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};


export default function ManageSpendingsSection({
  spendingsThisWeek,
  onAddSpending,
  onDeleteSpending,
  isProcessing,
  currentDashboardDate,
}: ManageSpendingsSectionProps) {
  const [selectedEntryDate, setSelectedEntryDate] = useState<Date>(currentDashboardDate);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>(''); // Store as string to handle empty input
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [spendingToDelete, setSpendingToDelete] = useState<SpendingEntry | null>(null);

  // Update selectedEntryDate if currentDashboardDate changes (e.g. on window focus)
  useEffect(() => {
    setSelectedEntryDate(currentDashboardDate);
  }, [currentDashboardDate]);

  const spendingsForSelectedDate = useMemo(() => {
    const dateStr = formatDateToYYYYMMDD(selectedEntryDate);
    return spendingsThisWeek
      .filter(s => s.date === dateStr)
      .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
  }, [spendingsThisWeek, selectedEntryDate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEntryDate || !description.trim() || !amount) {
      // Basic validation, more robust can be added with react-hook-form if needed
      alert("Please select a date, enter a description, and provide an amount.");
      return;
    }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }

    const dateString = formatDateToYYYYMMDD(selectedEntryDate);
    await onAddSpending(dateString, description.trim(), numericAmount);
    setDescription('');
    setAmount('');
    // selectedEntryDate remains the same, allowing multiple entries for one day
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedEntryDate(date);
    }
    setIsCalendarOpen(false);
  };

  const handleConfirmRemove = async () => {
    if (spendingToDelete) {
      await onDeleteSpending(spendingToDelete.id);
      setSpendingToDelete(null);
    }
  };

  const isAddButtonDisabled = !selectedEntryDate || !description.trim() || !amount || isProcessing;

  return (
    <Card className="border-none shadow-xl rounded-xl overflow-hidden mt-8">
      <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
        <CardTitle className="text-xl font-bold font-headline">Manage Your Spendings</CardTitle>
        <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Add, view, and remove your daily operational expenses.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
          <h3 className="text-lg font-semibold">Add New Spending Entry</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1">
              <Label htmlFor="spending-date-picker" className="text-base font-medium mb-2 block">Date of Spending</Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="spending-date-picker"
                    variant={"outline"}
                    className={cn("w-full justify-start text-left font-normal h-12 text-base", !selectedEntryDate && "text-muted-foreground")}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {selectedEntryDate ? format(selectedEntryDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedEntryDate}
                    onSelect={handleDateSelect}
                    initialFocus
                    defaultMonth={selectedEntryDate} // Ensure calendar opens to selected/current month
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="spending-description" className="text-base font-medium mb-2 block">Description</Label>
              <Textarea
                id="spending-description"
                placeholder="e.g., Rent, Supplies, Utilities"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-base min-h-[48px] rounded-md" 
                rows={1}
                disabled={isProcessing}
              />
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="spending-amount" className="text-base font-medium mb-2 block">Amount ($)</Label>
              <Input
                id="spending-amount"
                type="number"
                placeholder="e.g., 50.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 text-base"
                step="0.01"
                min="0.01"
                disabled={isProcessing}
              />
            </div>
          </div>
          <Button type="submit" className="h-12 rounded-full text-base" disabled={isAddButtonDisabled}>
            {isProcessing ? <LoadingSpinner className="mr-2 h-5 w-5" /> : <PlusCircle className="mr-2 h-5 w-5" />}
            {isProcessing ? 'Adding...' : 'Add Spending'}
          </Button>
        </form>

        <div>
          <h3 className="text-lg font-semibold mb-3">
            Spendings for: {selectedEntryDate ? formatDisplayDate(formatDateToYYYYMMDD(selectedEntryDate)) : 'Select a date'}
          </h3>
          {spendingsForSelectedDate.length === 0 ? (
            <div className="text-center py-8 px-4 border-2 border-dashed border-muted rounded-lg bg-card">
              <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-base text-gray-500 dark:text-gray-400">
                No spendings recorded for {selectedEntryDate ? format(selectedEntryDate, 'PPP') : 'this day'}.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {spendingsForSelectedDate.map((spending) => (
                <li key={spending.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md shadow-sm hover:bg-muted/75 transition-colors duration-150">
                  <div className="flex-grow">
                    <p className="font-medium text-foreground">{spending.description}</p>
                    <p className="text-sm text-destructive font-semibold">{formatCurrency(spending.amount)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Added: {format(spending.createdAt.toDate(), 'Pp')}
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full h-9 w-9" onClick={() => setSpendingToDelete(spending)} disabled={isProcessing}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete spending: {spending.description}</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">Confirm Deletion</AlertDialogTitle>
                        <AlertDialogDescription className="text-base text-gray-500 dark:text-gray-400 pt-1">
                          Are you sure you want to delete the spending entry: "{spendingToDelete?.description}" for {spendingToDelete ? formatCurrency(spendingToDelete.amount) : ''}? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel onClick={() => setSpendingToDelete(null)} disabled={isProcessing} className="rounded-full h-10 px-4">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmRemove} disabled={isProcessing} variant="destructive" className="rounded-full h-10 px-4">
                          {isProcessing ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
