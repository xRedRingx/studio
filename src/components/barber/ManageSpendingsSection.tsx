/**
 * @fileoverview ManageSpendingsSection component.
 * This component allows barbers to manage their daily operational expenses.
 * It includes a form to add new spending entries (date, description, amount)
 * and a list to display and delete existing entries for a selected date.
 * Part of the Barber Earnings page.
 */
'use client';

import type { FormEvent } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button'; // Button UI component.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Card UI components.
import type { SpendingEntry } from '@/types'; // Type definition for a spending entry.
import { Calendar } from '@/components/ui/calendar'; // Calendar UI component.
import { Input } from '@/components/ui/input'; // Input UI component.
import { Label } from '@/components/ui/label'; // Label UI component.
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Popover for calendar.
import { Textarea } from '@/components/ui/textarea'; // Textarea UI component.
import { cn } from '@/lib/utils'; // Utility for conditional class names.
import { CalendarDays, PlusCircle, Trash2, Info, DollarSign } from 'lucide-react'; // Icons.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Alert dialog for delete confirmation.
import { format, parseISO, isSameDay } from 'date-fns'; // Date formatting utilities.

/**
 * Props for the ManageSpendingsSection component.
 * @interface ManageSpendingsSectionProps
 * @property {SpendingEntry[]} spendingsThisWeek - Array of all spending entries for the current week.
 * @property {(date: string, description: string, amount: number) => Promise<void>} onAddSpending - Callback to add a new spending entry.
 * @property {(spendingId: string) => Promise<void>} onDeleteSpending - Callback to delete an existing spending entry.
 * @property {boolean} isProcessing - True if an add/delete operation is currently in progress.
 * @property {Date} currentDashboardDate - The current date being viewed on the parent dashboard, used to default the calendar.
 */
interface ManageSpendingsSectionProps {
  spendingsThisWeek: SpendingEntry[];
  onAddSpending: (date: string, description: string, amount: number) => Promise<void>;
  onDeleteSpending: (spendingId: string) => Promise<void>;
  isProcessing: boolean;
  currentDashboardDate: Date;
}

/**
 * Formats a Date object into a YYYY-MM-DD string.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Formats a YYYY-MM-DD date string into a more readable format (e.g., "Monday, January 1st, 2023").
 * @param {string} dateStr - The date string to format.
 * @returns {string} The formatted display date string.
 */
const formatDisplayDate = (dateStr: string): string => {
  return format(parseISO(dateStr), 'eeee, MMMM do, yyyy');
};

/**
 * Formats a number as currency (USD).
 * @param {number} amount - The amount to format.
 * @returns {string} The formatted currency string.
 */
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

/**
 * ManageSpendingsSection component.
 * Renders the UI for managing spending entries.
 *
 * @param {ManageSpendingsSectionProps} props - The component's props.
 * @returns {JSX.Element} The rendered manage spendings section.
 */
export default function ManageSpendingsSection({
  spendingsThisWeek,
  onAddSpending,
  onDeleteSpending,
  isProcessing,
  currentDashboardDate,
}: ManageSpendingsSectionProps) {
  // State for the form inputs: selected date, description, and amount.
  const [selectedEntryDate, setSelectedEntryDate] = useState<Date>(currentDashboardDate);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>(''); // Store amount as string to handle empty input and allow leading zeros if needed.

  // State for UI elements.
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); // Controls calendar popover visibility.
  const [spendingToDelete, setSpendingToDelete] = useState<SpendingEntry | null>(null); // Holds the spending entry to be confirmed for deletion.

  // Effect to update the `selectedEntryDate` in the form if the `currentDashboardDate` prop changes.
  // This ensures the calendar defaults to the correct date if the parent page's date context changes (e.g., on window focus).
  useEffect(() => {
    setSelectedEntryDate(currentDashboardDate);
  }, [currentDashboardDate]);

  // Memoized calculation to filter and sort spending entries for the currently selected date.
  // This avoids re-calculating on every render unless `spendingsThisWeek` or `selectedEntryDate` changes.
  const spendingsForSelectedDate = useMemo(() => {
    const dateStr = formatDateToYYYYMMDD(selectedEntryDate);
    return spendingsThisWeek
      .filter(s => s.date === dateStr) // Filter by selected date.
      .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()); // Sort by creation time, newest first.
  }, [spendingsThisWeek, selectedEntryDate]);

  /**
   * Handles the submission of the add spending form.
   * Performs basic validation and calls the `onAddSpending` callback.
   * @param {FormEvent} e - The form submission event.
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); // Prevent default form submission.
    // Basic client-side validation.
    if (!selectedEntryDate || !description.trim() || !amount) {
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
    // Reset form fields after successful submission.
    setDescription('');
    setAmount('');
    // The selectedEntryDate remains the same, allowing the user to add multiple entries for the same day.
  };

  /**
   * Handles the selection of a date from the calendar.
   * Updates the `selectedEntryDate` state and closes the calendar popover.
   * @param {Date | undefined} date - The selected date from the calendar.
   */
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedEntryDate(date);
    }
    setIsCalendarOpen(false); // Close calendar popover.
  };

  /**
   * Handles the confirmation of deleting a spending entry.
   * Calls the `onDeleteSpending` callback.
   */
  const handleConfirmRemove = async () => {
    if (spendingToDelete) {
      await onDeleteSpending(spendingToDelete.id);
      setSpendingToDelete(null); // Clear the spending entry marked for deletion.
    }
  };

  // Determine if the "Add Spending" button should be disabled.
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
        {/* Form for adding a new spending entry. */}
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
          <h3 className="text-lg font-semibold">Add New Spending Entry</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Date Picker for Spending Date */}
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
                    {selectedEntryDate ? format(selectedEntryDate, 'PPP') : <span>Pick a date</span>} {/* PPP format: Jan 1st, 2023 */}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedEntryDate}
                    onSelect={handleDateSelect}
                    initialFocus
                    defaultMonth={selectedEntryDate} // Ensure calendar opens to the currently selected month.
                  />
                </PopoverContent>
              </Popover>
            </div>
            {/* Description Input */}
            <div className="md:col-span-1">
              <Label htmlFor="spending-description" className="text-base font-medium mb-2 block">Description</Label>
              <Textarea
                id="spending-description"
                placeholder="e.g., Rent, Supplies, Utilities"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-base min-h-[48px] rounded-md" // Custom min-height to match other inputs.
                rows={1}
                disabled={isProcessing}
              />
            </div>
            {/* Amount Input */}
            <div className="md:col-span-1">
              <Label htmlFor="spending-amount" className="text-base font-medium mb-2 block">Amount ($)</Label>
              <Input
                id="spending-amount"
                type="number"
                placeholder="e.g., 50.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 text-base"
                step="0.01" // Allow decimal inputs for cents.
                min="0.01" // Minimum amount.
                disabled={isProcessing}
              />
            </div>
          </div>
          {/* Submit Button for Adding Spending */}
          <Button type="submit" className="h-12 rounded-full text-base" disabled={isAddButtonDisabled}>
            {isProcessing ? <LoadingSpinner className="mr-2 h-5 w-5" /> : <PlusCircle className="mr-2 h-5 w-5" />}
            {isProcessing ? 'Adding...' : 'Add Spending'}
          </Button>
        </form>

        {/* Section to display spending entries for the selected date. */}
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Spendings for: {selectedEntryDate ? formatDisplayDate(formatDateToYYYYMMDD(selectedEntryDate)) : 'Select a date'}
          </h3>
          {/* Message if no spendings are recorded for the selected date. */}
          {spendingsForSelectedDate.length === 0 ? (
            <div className="text-center py-8 px-4 border-2 border-dashed border-muted rounded-lg bg-card">
              <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-base text-gray-500 dark:text-gray-400">
                No spendings recorded for {selectedEntryDate ? format(selectedEntryDate, 'PPP') : 'this day'}.
              </p>
            </div>
          ) : (
            // List of spending entries for the selected date.
            <ul className="space-y-3">
              {spendingsForSelectedDate.map((spending) => (
                <li key={spending.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md shadow-sm hover:bg-muted/75 transition-colors duration-150">
                  <div className="flex-grow">
                    <p className="font-medium text-foreground">{spending.description}</p>
                    <p className="text-sm text-destructive font-semibold">{formatCurrency(spending.amount)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Added: {format(spending.createdAt.toDate(), 'Pp')} {/* Pp format: Jan 1, 2023, 12:00 PM */}
                    </p>
                  </div>
                  {/* Delete Button with Confirmation Dialog */}
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
