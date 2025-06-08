
'use client';

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DayAvailability, DayOfWeek } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface DayScheduleInputProps {
  dayAvailability: DayAvailability;
  onUpdate: (day: DayOfWeek, updates: Partial<DayAvailability>) => void;
}

const timeOptions = Array.from({ length: 32 }, (_, i) => { // 7 AM to 10:30 PM in 30-min intervals
  const hour = Math.floor(i / 2) + 7;
  const minute = (i % 2) * 30;
  const period = hour < 12 || hour === 24 ? 'AM' : 'PM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
});

export default function DayScheduleInput({ dayAvailability, onUpdate }: DayScheduleInputProps) {
  const { day, isOpen, startTime, endTime } = dayAvailability;

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">{day}</CardTitle>
        <div className="flex items-center space-x-2">
          <Switch
            id={`isOpen-${day}`}
            checked={isOpen}
            onCheckedChange={(checked) => onUpdate(day, { isOpen: checked })}
            aria-label={`Toggle ${day} schedule`}
          />
          <Label htmlFor={`isOpen-${day}`} className="text-sm">
            {isOpen ? 'Open' : 'Closed'}
          </Label>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="pt-2 space-y-3 md:space-y-0 md:flex md:space-x-4 items-end">
          <div className="flex-1">
            <Label htmlFor={`startTime-${day}`} className="text-xs">Start Time</Label>
            <Select
              value={startTime}
              onValueChange={(value) => onUpdate(day, { startTime: value })}
            >
              <SelectTrigger id={`startTime-${day}`} className="w-full">
                <SelectValue placeholder="Select start time" />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((time) => (
                  <SelectItem key={`start-${time}`} value={time}>{time}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label htmlFor={`endTime-${day}`} className="text-xs">End Time</Label>
            <Select
              value={endTime}
              onValueChange={(value) => onUpdate(day, { endTime: value })}
            >
              <SelectTrigger id={`endTime-${day}`} className="w-full">
                <SelectValue placeholder="Select end time" />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((time) => (
                  <SelectItem key={`end-${time}`} value={time}>{time}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
