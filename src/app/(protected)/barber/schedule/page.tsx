/**
 * @fileoverview Barber Schedule Page.
 * This page allows barbers to set and manage their weekly work schedule.
 * For each day of the week, they can specify if they are open and their start/end times.
 * The schedule is fetched from and saved to Firestore, and also cached in local storage
 * for faster initial loads and potential offline access.
 */
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage'; // Ensures authenticated barber access.
import { useAuth } from '@/hooks/useAuth'; // Auth context hook.
import type { DayAvailability, DayOfWeek, BarberScheduleDoc } from '@/types'; // Type definitions.
import SetWorkScheduleSection from '@/components/barber/SetWorkScheduleSection'; // UI component for schedule input.
import { firestore } from '@/firebase/config'; // Firebase Firestore instance.
import {
  doc,
  setDoc,
  getDoc,
  Timestamp,
} from 'firebase/firestore'; // Firestore methods.
import { useToast } from '@/hooks/use-toast'; // Toast notification hook.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.
// Local storage utilities (simple get/set without Timestamp conversion for schedule as it's structured data).
import { getSimpleItem, setSimpleItem, LS_SCHEDULE_KEY } from '@/lib/localStorageUtils';

// Default initial schedule if none is found in Firestore or cache.
// Sets Monday-Friday as open from 9 AM to 5 PM, Saturday/Sunday as closed.
const INITIAL_SCHEDULE: DayAvailability[] = (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as DayOfWeek[]).map(day => ({
  day,
  isOpen: !['Saturday', 'Sunday'].includes(day),
  startTime: '09:00 AM',
  endTime: '05:00 PM',
}));

/**
 * BarberSchedulePage component.
 * Renders the page for managing a barber's weekly work schedule.
 *
 * @returns {JSX.Element} The rendered schedule page.
 */
export default function BarberSchedulePage() {
  const { user } = useAuth(); // Get current authenticated barber.
  const { toast } = useToast(); // Hook for displaying notifications.

  // State for the barber's schedule.
  const [schedule, setSchedule] = useState<DayAvailability[]>(INITIAL_SCHEDULE);
  // State to indicate if the schedule is currently being loaded from Firestore.
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  // State to indicate if the schedule is currently being saved to Firestore.
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  // State to track if the initial component mount and setup has completed.
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Effect to mark initial load as complete.
  useEffect(() => {
    setInitialLoadComplete(true);
  }, []);

  // Effect to load schedule from local storage on initial load, if available.
  useEffect(() => {
    if (initialLoadComplete) {
      const cachedSchedule = getSimpleItem<DayAvailability[]>(LS_SCHEDULE_KEY);
      if (cachedSchedule) {
        setSchedule(cachedSchedule);
        setIsLoadingSchedule(false); // If cache hit, no need to show main loading state.
      }
    }
  }, [initialLoadComplete]);

  /**
   * Fetches the barber's work schedule from Firestore.
   * If no schedule exists, it uses the `INITIAL_SCHEDULE`.
   * Updates local state and caches the fetched/defaulted schedule.
   */
  const fetchSchedule = useCallback(async () => {
    if (!user?.uid) return; // Ensure user is logged in.
    setIsLoadingSchedule(true);
    try {
      const scheduleDocRef = doc(firestore, 'barberSchedules', user.uid);
      const docSnap = await getDoc(scheduleDocRef);
      let newSchedule = INITIAL_SCHEDULE; // Default to initial if no Firestore doc.
      if (docSnap.exists()) {
        // If document exists, use its schedule data.
        const scheduleData = docSnap.data() as BarberScheduleDoc;
        newSchedule = scheduleData.schedule;
      }
      setSchedule(newSchedule); // Update state.
      setSimpleItem(LS_SCHEDULE_KEY, newSchedule); // Cache in local storage.
    } catch (error) {
      console.error("Error fetching schedule:", error);
      toast({ title: "Error", description: "Could not fetch work schedule.", variant: "destructive" });
      setSchedule(INITIAL_SCHEDULE); // Fallback to initial schedule on error.
    } finally {
      setIsLoadingSchedule(false);
    }
  }, [user?.uid, toast]);

  /**
   * Handles updating a specific day's availability in the local schedule state.
   *
   * @param {DayOfWeek} day - The day of the week to update.
   * @param {Partial<DayAvailability>} updates - The partial updates to apply to the day's schedule.
   */
  const handleUpdateScheduleDay = (day: DayOfWeek, updates: Partial<DayAvailability>) => {
    setSchedule((prev) =>
      // Map over the previous schedule, updating the matching day.
      prev.map((d) => (d.day === day ? { ...d, ...updates } : d))
    );
  };

  /**
   * Handles saving the current schedule to Firestore.
   * Updates the `updatedAt` timestamp and caches the saved schedule.
   */
  const handleSaveSchedule = async () => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSavingSchedule(true);
    try {
      const scheduleDocRef = doc(firestore, 'barberSchedules', user.uid);
      // Prepare the schedule document data to be saved.
      const scheduleDataToSave: BarberScheduleDoc = {
        barberId: user.uid,
        schedule: schedule, // The current schedule from state.
        updatedAt: Timestamp.now(), // Record update time.
      };
      // Save to Firestore, merging with existing document if it exists.
      await setDoc(scheduleDocRef, scheduleDataToSave, { merge: true });
      setSimpleItem(LS_SCHEDULE_KEY, schedule); // Update local storage cache.
      toast({ title: "Success", description: "Work schedule saved successfully." });
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast({ title: "Error", description: "Could not save work schedule.", variant: "destructive" });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // Effect to fetch the schedule from Firestore when user ID is available and initial load is complete.
  useEffect(() => {
    if (user?.uid && initialLoadComplete) {
      fetchSchedule();
    }
  }, [user?.uid, fetchSchedule, initialLoadComplete]);

  return (
    // ProtectedPage ensures only authenticated barbers can access this page.
    <ProtectedPage expectedRole="barber">
      <div className="space-y-6">
        {/* Conditional rendering for loading state. */}
        {/* Shows spinner if loading and schedule is still the default initial template (not from cache/Firestore). */}
        {(isLoadingSchedule && schedule.every(s => s.startTime === INITIAL_SCHEDULE[0].startTime)) ? (
           <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-8 w-8 text-primary" />
            <p className="ml-2 text-base">Loading schedule...</p>
          </div>
        ) : (
          // Renders the main section for setting the work schedule.
          <SetWorkScheduleSection
            schedule={schedule}
            onUpdateSchedule={handleUpdateScheduleDay}
            onSaveChanges={handleSaveSchedule}
            isSaving={isSavingSchedule} // Pass saving state to disable inputs in child component.
          />
        )}
      </div>
    </ProtectedPage>
  );
}
