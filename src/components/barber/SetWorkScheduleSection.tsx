
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DayAvailability, DayOfWeek } from '@/types';
import DayScheduleInput from './DayScheduleInput';
import { Button } from '../ui/button';
import LoadingSpinner from '../ui/loading-spinner';

interface SetWorkScheduleSectionProps {
  schedule: DayAvailability[];
  onUpdateSchedule: (day: DayOfWeek, updates: Partial<DayAvailability>) => void;
  onSaveChanges: () => Promise<void>;
  isSaving: boolean;
}

const daysOfWeekOrder: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SetWorkScheduleSection({ schedule, onUpdateSchedule, onSaveChanges, isSaving }: SetWorkScheduleSectionProps) {
  
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
        {daysOfWeekOrder.map((day) => (
          <DayScheduleInput
            key={day}
            dayAvailability={getDayAvailability(day)}
            onUpdate={onUpdateSchedule}
          />
        ))}
        <div className="pt-6 flex justify-end">
            <Button onClick={onSaveChanges} disabled={isSaving} className="h-12 rounded-full px-6 text-base">
              {isSaving && <LoadingSpinner className="mr-2 h-4 w-4" />}
              {isSaving ? 'Saving...' : 'Save Schedule Changes'}
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
