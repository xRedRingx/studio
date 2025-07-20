/**
 * @fileoverview ManageUnavailableDatesSection component.
 * This component provides UI for barbers to manage their specific unavailable dates (e.g., holidays, personal days).
 * It includes a form to add a new unavailable date with an optional reason, and a list to display
 * and remove existing unavailable dates. The calendar input prevents selecting past dates or dates
 * already marked as unavailable.
 */
'use client';

import type { FormEvent } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button'; // Button UI component.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Card UI components.
import type { UnavailableDate } from '@/types'; // Type definition for an unavailable date.
import { Calendar } from '@/components/ui/calendar'; // Calendar UI component.
import { Input } from '@/components/ui/input'; // Input UI component.
import { Label } from '@/components/ui/label'; // Label UI component.
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Popover for calendar.
import { cn } from '@/lib/utils'; // Utility for conditional class names.
import { CalendarDays, PlusCircle, Trash2, Ban, Info } from 'lucide-react'; // Icons.
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

/**
 * Props for the ManageUnavailableDatesSection component.
 * @interface ManageUnavailableDatesSectionProps
 * @property {UnavailableDate[]} unavailableDates - Array of current unavailable dates for the barber.
 * @property {(date: string, reason?: string) => Promise<void>} onAddUnavailableDate - Callback to add a new unavailable date.
 * @property {(dateId: string) => Promise<void>} onRemoveUnavailableDate - Callback to remove an existing unavailable date.
 * @property {boolean} isProcessing - True if an add/remove operation is currently in progress.
 */
interface ManageUnavailableDatesSectionProps {
  unavailableDates: UnavailableDate[];
  onAddUnavailableDate: (date: string, reason?: string) => Promise<void>;
  onRemoveUnavailableDate: (dateId: string) => Promise<void>;
  isProcessing: boolean;
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
const formatYYYYMMDDToDisplay = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00'); // Ensure parsing in local timezone.
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

/**
 * ManageUnavailableDatesSection component.
 * Renders the UI for managing unavailable dates.
 *
 * @param {ManageUnavailableDatesSectionProps} props - The component's props.
 * @returns {JSX.Element} The rendered manage unavailable dates section.
 */
export default function ManageUnavailableDatesSection({
  unavailableDates,
  onAddUnavailableDate,
  onRemoveUnavailableDate,
  isProcessing,
}: ManageUnavailableDatesSectionProps) {
  // State for the form inputs: selected date and reason.
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [reason, setReason] = useState('');

  // State for UI elements.
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); // Controls calendar popover visibility.
  const [dateToRemove, setDateToRemove] = useState<UnavailableDate | null>(null); // Holds the date to be confirmed for deletion.
  // State to track if the currently selected date in the calendar is already marked as unavailable.
  const [isSelectedDateAlreadyMarked, setIsSelectedDateAlreadyMarked] = useState(false);

  // Get today's date (start of day) for disabling past dates in the calendar.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Convert existing unavailable date strings (YYYY-MM-DD) to Date objects for the calendar modifiers.
  const alreadyMarkedUnavailableDateObjects = unavailableDates.map(ud => {
    const [year, month, day] = ud.date.split('-').map(Number);
    return new Date(year, month - 1, day, 0,0,0,0); // month is 0-indexed.
  });

  // Calendar modifiers:
  // - `alreadyUnavailable`: Dates that are currently in the `unavailableDates` list.
  // - `disabled`: Dates that cannot be selected (past dates and already unavailable dates).
  const modifiers = {
    alreadyUnavailable: alreadyMarkedUnavailableDateObjects,
    disabled: [{ before: today }, ...alreadyMarkedUnavailableDateObjects],
  };

  // Custom styles for dates in the calendar that are already marked as unavailable.
  const modifiersStyles = {
    alreadyUnavailable: {
      backgroundColor: 'hsl(var(--muted))',
      color: 'hsl(var(--muted-foreground)/0.6)',
      border: '1px dashed hsl(var(--border))',
      borderRadius: 'var(--radius-sm, 0.375rem)',
    },
  };

  // Effect to check if the `selectedDate` (from calendar) is already marked as unavailable.
  // Updates `isSelectedDateAlreadyMarked` state, which can disable the "Add" button.
  useEffect(() => {
    if (selectedDate) {
      const isMarked = alreadyMarkedUnavailableDateObjects.some(
        d => d.getTime() === selectedDate.getTime() // Compare Date objects by their time value.
      );
      setIsSelectedDateAlreadyMarked(isMarked);
    } else {
      setIsSelectedDateAlreadyMarked(false);
    }
  }, [selectedDate, alreadyMarkedUnavailableDateObjects]); // Rerun if selectedDate or the list of unavailable dates changes.

  /**
   * Handles the submission of the add unavailable date form.
   * Calls the `onAddUnavailableDate` callback.
   * @param {FormEvent} e - The form submission event.
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); // Prevent default form submission.
    // Do not submit if no date is selected or if the selected date is already marked.
    if (!selectedDate || isSelectedDateAlreadyMarked) {
      return;
    }
    const dateString = formatDateToYYYYMMDD(selectedDate);
    await onAddUnavailableDate(dateString, reason || undefined); // Pass reason as undefined if empty.
    // Reset form fields after successful submission.
    setSelectedDate(undefined);
    setReason('');
  };

  /**
   * Handles the selection of a date from the calendar.
   * Updates `selectedDate` and checks if it's already marked. Closes the calendar.
   * @param {Date | undefined} date - The selected date from the calendar.
   */
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      const isMarked = alreadyMarkedUnavailableDateObjects.some(d => d.getTime() === date.getTime());
      setIsSelectedDateAlreadyMarked(isMarked);
    } else {
      setSelectedDate(undefined);
      setIsSelectedDateAlreadyMarked(false);
    }
    setIsCalendarOpen(false); // Close calendar popover.
  };

  /**
   * Handles the confirmation of removing an unavailable date.
   * Calls the `onRemoveUnavailableDate` callback.
   */
  const handleConfirmRemove = async () => {
    if (dateToRemove) {
      await onRemoveUnavailableDate(dateToRemove.id);
      // If the removed date was the one currently selected in the form, clear the selection.
      if (selectedDate && formatDateToYYYYMMDD(selectedDate) === dateToRemove.date) {
        setSelectedDate(undefined);
        setIsSelectedDateAlreadyMarked(false);
      }
      setDateToRemove(null); // Clear the date marked for deletion.
    }
  };

  // Determine if the "Add Unavailable Date" button should be disabled.
  const isAddButtonDisabled = !selectedDate || isProcessing || isSelectedDateAlreadyMarked;

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-2xl font-bold font-headline">Manage Unavailable Dates</CardTitle>
        <CardDescription className="text-sm text-muted-foreground mt-1">Block out specific dates. Dates already marked are styled in the calendar. To re-enable a date, remove it from the list below.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-6">
        {/* Form for adding a new unavailable date. */}
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
          <h3 className="text-lg font-semibold">Add New Unavailable Date</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Date Picker for Unavailable Date */}
            <div>
              <Label htmlFor="unavailable-date-picker" className="text-base font-medium mb-2 block">Select Date</Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="unavailable-date-picker"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-12 text-base",
                      !selectedDate && "text-muted-foreground" // Style if no date is selected.
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {selectedDate ? selectedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={modifiers.disabled} // Pass disabled dates.
                    modifiers={modifiers} // Pass modifiers for styling already unavailable dates.
                    modifiersStyles={modifiersStyles} // Pass custom styles.
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {/* Display message if the selected date is already marked. */}
              {isSelectedDateAlreadyMarked && selectedDate && (
                <p className="text-sm text-destructive flex items-center mt-2">
                    <Ban className="h-4 w-4 mr-1.5" /> This date is already marked as unavailable.
                </p>
              )}
            </div>
            {/* Reason Input (Optional) */}
            <div>
              <Label htmlFor="unavailable-reason" className="text-base font-medium mb-2 block">Reason (Optional)</Label>
              <Input
                id="unavailable-reason"
                type="text"
                placeholder="e.g., Holiday, Personal Day"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-12 text-base"
                disabled={isAddButtonDisabled || !selectedDate} // Disable if add button is disabled or no date selected.
              />
            </div>
          </div>
          {/* Submit Button for Adding Unavailable Date */}
          <Button
            type="submit"
            className="h-12 text-base"
            disabled={isAddButtonDisabled}
          >
            {isProcessing ? <LoadingSpinner className="mr-2 h-5 w-5" /> : <PlusCircle className="mr-2 h-5 w-5" />}
            {isProcessing ? 'Adding...' : 'Add Unavailable Date'}
          </Button>
        </form>

        {/* Section to display currently marked unavailable dates. */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Current Unavailable Dates</h3>
          {/* Message if no unavailable dates are marked. */}
          {unavailableDates.length === 0 ? (
            <div className="text-center py-8 px-4 border-2 border-dashed border-muted rounded-lg bg-background">
              <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No Unavailable Dates Marked</h3>
              <p className="text-base text-muted-foreground">
                You haven't blocked out any specific dates. If you need to take a day off, add it using the form above.
              </p>
            </div>
          ) : (
            // List of unavailable dates, sorted by date.
            <ul className="space-y-2">
              {unavailableDates.sort((a,b) => a.date.localeCompare(b.date)).map((ud) => (
                <li key={ud.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md shadow-sm hover:bg-muted/75 transition-colors duration-150">
                  <div>
                    <p className="font-medium">{formatYYYYMMDDToDisplay(ud.date)}</p>
                    {ud.reason && <p className="text-xs text-muted-foreground">{ud.reason}</p>}
                  </div>
                  {/* Delete Button with Confirmation Dialog */}
                   <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full h-9 w-9" onClick={() => setDateToRemove(ud)} disabled={isProcessing}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove {ud.date}</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl font-bold">Confirm Removal</AlertDialogTitle>
                          <AlertDialogDescription className="text-base text-muted-foreground pt-1">
                            Are you sure you want to remove {formatYYYYMMDDToDisplay(dateToRemove?.date || '')} from your unavailable dates?
                            Customers will be able to book on this day again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-4">
                          <AlertDialogCancel onClick={() => setDateToRemove(null)} disabled={isProcessing}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleConfirmRemove} disabled={isProcessing} variant="destructive">
                            {isProcessing ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
                            Remove
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
