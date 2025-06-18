/**
 * @fileoverview SetWorkScheduleSection component.
 * This component provides the UI for barbers to set their weekly work schedule.
 * It displays a `DayScheduleInput` for each day of the week, allowing barbers
 * to specify their open/closed status and working hours.
 * It also includes a button to save the changes to the schedule.
 */
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Card UI components.
import type { DayAvailability, DayOfWeek } from '@/types'; // Type definitions.
import DayScheduleInput from './DayScheduleInput'; // Component for configuring a single day's schedule.
import { Button } from '../ui/button'; // Button UI component.
import LoadingSpinner from '../ui/loading-spinner'; // Loading spinner UI.

/**
 * Props for the SetWorkScheduleSection component.
 * @interface SetWorkScheduleSectionProps
 * @property {DayAvailability[]} schedule - The current weekly schedule data.
 * @property {(day: DayOfWeek, updates: Partial<DayAvailability>) => void} onUpdateSchedule - Callback to update the schedule state for a specific day.
 * @property {() => Promise<void>} onSaveChanges - Callback to persist the schedule changes.
 * @property {boolean} isSaving - True if the schedule changes are currently being saved.
 */
interface SetWorkScheduleSectionProps {
  schedule: DayAvailability[];
  onUpdateSchedule: (day: DayOfWeek, updates: Partial<DayAvailability>) => void;
  onSaveChanges: () => Promise<void>;
  isSaving: boolean;
}

// Defines the order of days for display.
const daysOfWeekOrder: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * SetWorkScheduleSection component.
 * Renders the UI for setting and saving the barber's weekly work schedule.
 *
 * @param {SetWorkScheduleSectionProps} props - The component's props.
 * @returns {JSX.Element} The rendered set work schedule section.
 */
export default function SetWorkScheduleSection({ schedule, onUpdateSchedule, onSaveChanges, isSaving }: SetWorkScheduleSectionProps) {

  /**
   * Gets the availability data for a specific day from the schedule array.
   * If not found (should not happen if `schedule` is correctly populated),
   * it defaults to a closed state for that day.
   *
   * @param {DayOfWeek} day - The day of the week to get availability for.
   * @returns {DayAvailability} The availability data for the specified day.
   */
  const getDayAvailability = (day: DayOfWeek): DayAvailability => {
    return schedule.find(d => d.day === day) || { day, isOpen: false, startTime: '09:00 AM', endTime: '05:00 PM' };
  };

  return (
    <Card className="border-none shadow-lg rounded-xl overflow-hidden">
      <CardHeader className="p-4 md:p-6 bg-gradient-to-tr from-card via-muted/10 to-card">
        <CardTitle className="text-2xl font-bold font-headline">Set Your Work Schedule</CardTitle>
        <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your weekly availability and operating hours.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:p-6">
        {/* Iterate over `daysOfWeekOrder` to render a `DayScheduleInput` for each day. */}
        {daysOfWeekOrder.map((day) => (
          <DayScheduleInput
            key={day}
            dayAvailability={getDayAvailability(day)} // Pass the specific day's availability data.
            onUpdate={onUpdateSchedule} // Pass the callback to update the schedule state.
          />
        ))}
        {/* Button to save all schedule changes. */}
        <div className="pt-6 flex justify-end">
            <Button onClick={onSaveChanges} disabled={isSaving} className="h-12 rounded-full px-6 text-base">
              {isSaving && <LoadingSpinner className="mr-2 h-4 w-4" />} {/* Show spinner if saving. */}
              {isSaving ? 'Saving...' : 'Save Schedule Changes'}
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
