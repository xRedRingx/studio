
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DayAvailability, DayOfWeek } from '@/types';
import DayScheduleInput from './DayScheduleInput';
import { Button } from '../ui/button';

interface SetWorkScheduleSectionProps {
  schedule: DayAvailability[];
  onUpdateSchedule: (day: DayOfWeek, updates: Partial<DayAvailability>) => void;
  onSaveChanges: () => void; // Placeholder for future save functionality
}

const daysOfWeek: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SetWorkScheduleSection({ schedule, onUpdateSchedule, onSaveChanges }: SetWorkScheduleSectionProps) {
  
  const getDayAvailability = (day: DayOfWeek): DayAvailability => {
    return schedule.find(d => d.day === day) || { day, isOpen: false, startTime: '09:00 AM', endTime: '05:00 PM' };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Work Schedule</CardTitle>
        <CardDescription>Manage your weekly availability and operating hours.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {daysOfWeek.map((day) => (
          <DayScheduleInput
            key={day}
            dayAvailability={getDayAvailability(day)}
            onUpdate={onUpdateSchedule}
          />
        ))}
        <div className="pt-4 flex justify-end">
            {/* <Button onClick={onSaveChanges}>Save Schedule Changes</Button> */}
            {/* Save button can be implemented later if connecting to backend */}
        </div>
      </CardContent>
    </Card>
  );
}
