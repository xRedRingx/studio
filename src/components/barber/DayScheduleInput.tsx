/**
 * @fileoverview DayScheduleInput component.
 * This component provides UI elements for a barber to configure their availability
 * for a single day of the week. It includes:
 * - A title for the day (e.g., "Monday").
 * - A switch to toggle whether the barber is open or closed on that day.
 * - Select dropdowns for start and end times if the barber is open.
 */
'use client';

import { Switch } from "@/components/ui/switch"; // Switch UI component.
import { Label } from "@/components/ui/label"; // Label UI component.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Select dropdown UI components.
import type { DayAvailability, DayOfWeek } from '@/types'; // Type definitions.
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"; // Card UI components.

/**
 * Props for the DayScheduleInput component.
 * @interface DayScheduleInputProps
 * @property {DayAvailability} dayAvailability - The current availability settings for the specific day.
 * @property {(day: DayOfWeek, updates: Partial<DayAvailability>) => void} onUpdate - Callback function to update the schedule state in the parent component when changes are made.
 */
interface DayScheduleInputProps {
  dayAvailability: DayAvailability;
  onUpdate: (day: DayOfWeek, updates: Partial<DayAvailability>) => void;
}

// Generates time options for the select dropdowns (e.g., "07:00 AM", "07:30 AM", ...).
// Covers a range from 7:00 AM to 10:30 PM in 30-minute intervals.
const timeOptions = Array.from({ length: 32 }, (_, i) => { // 32 options for 16 hours (7AM-11PM) at 30-min intervals
  const hour = Math.floor(i / 2) + 7; // Starts at 7 AM.
  const minute = (i % 2) * 30; // 0 or 30 minutes.
  const period = hour < 12 || hour === 24 ? 'AM' : 'PM'; // Determine AM/PM.
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour; // Convert 24-hour to 12-hour format.
  return `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
});

/**
 * DayScheduleInput component.
 * Renders input controls for a single day's schedule.
 *
 * @param {DayScheduleInputProps} props - The component's props.
 * @returns {JSX.Element} The rendered day schedule input card.
 */
export default function DayScheduleInput({ dayAvailability, onUpdate }: DayScheduleInputProps) {
  const { day, isOpen, startTime, endTime } = dayAvailability; // Destructure props.

  return (
    <Card className="shadow-sm rounded-lg border">
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4">
        <CardTitle className="text-base font-semibold">{day}</CardTitle> {/* Display the day of the week. */}
        {/* Switch to toggle open/closed status for the day. */}
        <div className="flex items-center space-x-3">
          <Label htmlFor={`isOpen-${day}`} className="text-sm text-gray-500">
            {isOpen ? 'Open' : 'Closed'}
          </Label>
          <Switch
            id={`isOpen-${day}`}
            checked={isOpen}
            onCheckedChange={(checked) => onUpdate(day, { isOpen: checked })} // Call onUpdate when switch state changes.
            aria-label={`Toggle ${day} schedule`}
          />
        </div>
      </CardHeader>
      {/* Conditional rendering: Show time selectors only if the day is marked as open. */}
      {isOpen && (
        <CardContent className="pt-2 pb-4 px-4 space-y-3 md:flex md:space-x-4 md:space-y-0 items-end">
          {/* Start Time Selector */}
          <div className="flex-1">
            <Label htmlFor={`startTime-${day}`} className="text-sm text-gray-500 mb-1 block">Start Time</Label>
            <Select
              value={startTime}
              onValueChange={(value) => onUpdate(day, { startTime: value })} // Call onUpdate when start time changes.
            >
              <SelectTrigger id={`startTime-${day}`} className="w-full h-11 text-base">
                <SelectValue placeholder="Select start time" />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((time) => (
                  <SelectItem key={`start-${time}`} value={time} className="text-base">{time}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* End Time Selector */}
          <div className="flex-1">
            <Label htmlFor={`endTime-${day}`} className="text-sm text-gray-500 mb-1 block">End Time</Label>
            <Select
              value={endTime}
              onValueChange={(value) => onUpdate(day, { endTime: value })} // Call onUpdate when end time changes.
            >
              <SelectTrigger id={`endTime-${day}`} className="w-full h-11 text-base">
                <SelectValue placeholder="Select end time" />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((time) => (
                  <SelectItem key={`end-${time}`} value={time} className="text-base">{time}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
