
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

const timeOptions = Array.from({ length: 32 }, (_, i) => { 
  const hour = Math.floor(i / 2) + 7;
  const minute = (i % 2) * 30;
  const period = hour < 12 || hour === 24 ? 'AM' : 'PM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
});

export default function DayScheduleInput({ dayAvailability, onUpdate }: DayScheduleInputProps) {
  const { day, isOpen, startTime, endTime } = dayAvailability;

  return (
    <Card className="shadow-sm rounded-lg border">
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4">
        <CardTitle className="text-base font-semibold">{day}</CardTitle>
        <div className="flex items-center space-x-3">
          <Label htmlFor={`isOpen-${day}`} className="text-sm text-gray-500">
            {isOpen ? 'Open' : 'Closed'}
          </Label>
          <Switch
            id={`isOpen-${day}`}
            checked={isOpen}
            onCheckedChange={(checked) => onUpdate(day, { isOpen: checked })}
            aria-label={`Toggle ${day} schedule`}
          />
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="pt-2 pb-4 px-4 space-y-3 md:flex md:space-x-4 md:space-y-0 items-end">
          <div className="flex-1">
            <Label htmlFor={`startTime-${day}`} className="text-sm text-gray-500 mb-1 block">Start Time</Label>
            <Select
              value={startTime}
              onValueChange={(value) => onUpdate(day, { startTime: value })}
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
          <div className="flex-1">
            <Label htmlFor={`endTime-${day}`} className="text-sm text-gray-500 mb-1 block">End Time</Label>
            <Select
              value={endTime}
              onValueChange={(value) => onUpdate(day, { endTime: value })}
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
