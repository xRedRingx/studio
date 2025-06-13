
'use client';

import type { FormEvent } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UnavailableDate } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarDays, PlusCircle, Trash2, X } from 'lucide-react';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ManageUnavailableDatesSectionProps {
  unavailableDates: UnavailableDate[];
  onAddUnavailableDate: (date: string, reason?: string) => Promise<void>;
  onRemoveUnavailableDate: (dateId: string) => Promise<void>;
  isProcessing: boolean;
}

const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const formatYYYYMMDDToDisplay = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00'); // Ensure parsing as local date
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

export default function ManageUnavailableDatesSection({
  unavailableDates,
  onAddUnavailableDate,
  onRemoveUnavailableDate,
  isProcessing,
}: ManageUnavailableDatesSectionProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [reason, setReason] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateToRemove, setDateToRemove] = useState<UnavailableDate | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const alreadyMarkedUnavailableDays = unavailableDates.map(ud => {
    // Ensure correct parsing of YYYY-MM-DD into a Date object for the local timezone
    const [year, month, day] = ud.date.split('-').map(Number);
    return new Date(year, month - 1, day);
  });

  const modifiers = {
    alreadyUnavailable: alreadyMarkedUnavailableDays,
  };

  const modifiersStyles = {
    alreadyUnavailable: {
      backgroundColor: 'hsl(var(--muted))',
      color: 'hsl(var(--muted-foreground)/0.6)',
      border: '1px dashed hsl(var(--border))',
      borderRadius: 'var(--radius-sm, 0.375rem)', // Use ShadCN's radius if available or a default
    },
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDate) {
      alert("Please select a date.");
      return;
    }
    const dateString = formatDateToYYYYMMDD(selectedDate);
    await onAddUnavailableDate(dateString, reason || undefined);
    // Don't reset selectedDate here, let user pick another or clear it
    setReason('');
    // Calendar might close automatically, or user closes it.
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // Check if the selected date is already unavailable. If so, don't set it for "add new"
      const isAlreadyMarked = alreadyMarkedUnavailableDays.some(
        d => d.getTime() === date.getTime()
      );
      if (!isAlreadyMarked) {
        setSelectedDate(date);
      } else {
        // Optionally, provide feedback that this date is already marked
        // For now, just don't update selectedDate for adding
      }
      setIsCalendarOpen(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (dateToRemove) {
      await onRemoveUnavailableDate(dateToRemove.id);
      setDateToRemove(null);
    }
  };

  return (
    <Card className="border-none shadow-lg rounded-xl overflow-hidden">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-2xl font-bold">Manage Unavailable Dates</CardTitle>
        <CardDescription className="text-sm text-gray-500 mt-1">Block out specific dates for holidays or personal time. Dates already marked are styled differently in the calendar.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
          <h3 className="text-lg font-semibold">Add New Unavailable Date</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <Label htmlFor="unavailable-date-picker" className="text-base font-medium mb-2 block">Select Date</Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="unavailable-date-picker"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-12 text-base",
                      !selectedDate && "text-muted-foreground"
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
                    disabled={[ // This controls actual clickability
                      { before: today },
                      ...alreadyMarkedUnavailableDays 
                    ]}
                    modifiers={modifiers}
                    modifiersStyles={modifiersStyles}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="unavailable-reason" className="text-base font-medium mb-2 block">Reason (Optional)</Label>
              <Input
                id="unavailable-reason"
                type="text"
                placeholder="e.g., Holiday, Personal Day"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-12 text-base"
                disabled={isProcessing || !selectedDate || (selectedDate && alreadyMarkedUnavailableDays.some(d => d.getTime() === selectedDate.getTime()))}
              />
            </div>
          </div>
          <Button 
            type="submit" 
            className="h-12 rounded-full text-base" 
            disabled={!selectedDate || isProcessing || (selectedDate && alreadyMarkedUnavailableDays.some(d => d.getTime() === selectedDate.getTime()))}
          >
            {isProcessing ? <LoadingSpinner className="mr-2 h-5 w-5" /> : <PlusCircle className="mr-2 h-5 w-5" />}
            {isProcessing ? 'Adding...' : 'Add Unavailable Date'}
          </Button>
        </form>

        <div>
          <h3 className="text-lg font-semibold mb-3">Current Unavailable Dates</h3>
          {unavailableDates.length === 0 ? (
            <p className="text-sm text-gray-500">You have no specific dates marked as unavailable.</p>
          ) : (
            <ul className="space-y-2">
              {unavailableDates.sort((a,b) => a.date.localeCompare(b.date)).map((ud) => (
                <li key={ud.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md shadow-sm">
                  <div>
                    <p className="font-medium">{formatYYYYMMDDToDisplay(ud.date)}</p>
                    {ud.reason && <p className="text-xs text-gray-500">{ud.reason}</p>}
                  </div>
                   <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full h-9 w-9" onClick={() => setDateToRemove(ud)} disabled={isProcessing}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove {ud.date}</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Removal</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {formatYYYYMMDDToDisplay(dateToRemove?.date || '')} from your unavailable dates?
                            Customers will be able to book on this day again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-4">
                          <AlertDialogCancel onClick={() => setDateToRemove(null)} disabled={isProcessing} className="rounded-full h-10 px-4">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleConfirmRemove} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full h-10 px-4">
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
