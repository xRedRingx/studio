
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { DayAvailability, DayOfWeek, BarberScheduleDoc } from '@/types';
import SetWorkScheduleSection from '@/components/barber/SetWorkScheduleSection';
import { firestore } from '@/firebase/config';
import {
  doc,
  setDoc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';

const INITIAL_SCHEDULE: DayAvailability[] = (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as DayOfWeek[]).map(day => ({
  day,
  isOpen: !['Saturday', 'Sunday'].includes(day),
  startTime: '09:00 AM',
  endTime: '05:00 PM',
}));

const LS_SCHEDULE_KEY = 'barber_schedule_page_schedule';

export default function BarberSchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<DayAvailability[]>(INITIAL_SCHEDULE);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    setInitialLoadComplete(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && initialLoadComplete) {
      const cachedSchedule = localStorage.getItem(LS_SCHEDULE_KEY);
      if (cachedSchedule) {
        setSchedule(JSON.parse(cachedSchedule)); // Schedule itself doesn't have Timestamps
        setIsLoadingSchedule(false);
      }
    }
  }, [initialLoadComplete]);

  const fetchSchedule = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingSchedule(true);
    try {
      const scheduleDocRef = doc(firestore, 'barberSchedules', user.uid);
      const docSnap = await getDoc(scheduleDocRef);
      let newSchedule = INITIAL_SCHEDULE;
      if (docSnap.exists()) {
        const scheduleData = docSnap.data() as BarberScheduleDoc;
        newSchedule = scheduleData.schedule;
      }
      setSchedule(newSchedule);
       if (typeof window !== 'undefined') {
        localStorage.setItem(LS_SCHEDULE_KEY, JSON.stringify(newSchedule));
      }
    } catch (error) {
      console.error("Error fetching schedule:", error);
      toast({ title: "Error", description: "Could not fetch work schedule.", variant: "destructive" });
      setSchedule(INITIAL_SCHEDULE); // Fallback
    } finally {
      setIsLoadingSchedule(false);
    }
  }, [user?.uid, toast]);

  const handleUpdateScheduleDay = (day: DayOfWeek, updates: Partial<DayAvailability>) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day === day ? { ...d, ...updates } : d))
    );
  };

  const handleSaveSchedule = async () => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSavingSchedule(true);
    try {
      const scheduleDocRef = doc(firestore, 'barberSchedules', user.uid);
      const scheduleDataToSave: BarberScheduleDoc = {
        barberId: user.uid,
        schedule: schedule,
        updatedAt: Timestamp.now(),
      };
      await setDoc(scheduleDocRef, scheduleDataToSave, { merge: true });
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_SCHEDULE_KEY, JSON.stringify(schedule));
      }
      toast({ title: "Success", description: "Work schedule saved successfully." });
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast({ title: "Error", description: "Could not save work schedule.", variant: "destructive" });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  useEffect(() => {
    if (user?.uid && initialLoadComplete) {
      fetchSchedule();
    }
  }, [user?.uid, fetchSchedule, initialLoadComplete]);

  return (
    <ProtectedPage expectedRole="barber">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-headline">Set Your Work Schedule</h1>
        {(isLoadingSchedule && schedule.every(s => s.startTime === INITIAL_SCHEDULE[0].startTime)) ? ( 
           <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-8 w-8 text-primary" />
            <p className="ml-2 text-base">Loading schedule...</p>
          </div>
        ) : (
          <SetWorkScheduleSection
            schedule={schedule}
            onUpdateSchedule={handleUpdateScheduleDay}
            onSaveChanges={handleSaveSchedule}
            isSaving={isSavingSchedule}
          />
        )}
      </div>
    </ProtectedPage>
  );
}
