/**
 * @fileoverview Barber Availability Page.
 * This page allows barbers to manage their unavailable dates, such as holidays or personal days off.
 * Barbers can add new unavailable dates with an optional reason and remove existing ones.
 * Data is fetched from Firestore and also cached in local storage for faster initial loads
 * and offline access.
 */
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage'; // Component to ensure user is authenticated and has the correct role.
import { useAuth } from '@/hooks/useAuth'; // Custom hook for accessing authentication context.
import type { UnavailableDate } from '@/types'; // TypeScript type definition for an unavailable date.
import ManageUnavailableDatesSection from '@/components/barber/ManageUnavailableDatesSection'; // UI component for managing unavailable dates.
import { firestore } from '@/firebase/config'; // Firebase Firestore instance.
import {
  collection,
  query,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  orderBy,
  Timestamp,
} from 'firebase/firestore'; // Firestore methods for data manipulation.
import { useToast } from '@/hooks/use-toast'; // Custom hook for displaying toast notifications.
import LoadingSpinner from '@/components/ui/loading-spinner'; // UI component for loading indication.
// Utilities for handling local storage with Firestore Timestamp conversion.
import { getItemWithTimestampRevival, setItemWithTimestampConversion, LS_UNAVAILABLE_DATES_KEY } from '@/lib/localStorageUtils';


/**
 * BarberAvailabilityPage component.
 * Renders the page for managing a barber's unavailable dates.
 *
 * @returns {JSX.Element} The rendered page.
 */
export default function BarberAvailabilityPage() {
  const { user } = useAuth(); // Get the current authenticated user.
  const { toast } = useToast(); // Hook for displaying notifications.

  // State for storing the list of unavailable dates.
  const [unavailableDates, setUnavailableDates] = useState<UnavailableDate[]>([]);
  // State to indicate if unavailable dates are currently being loaded from Firestore.
  const [isLoadingUnavailableDates, setIsLoadingUnavailableDates] = useState(true);
  // State to indicate if an add/remove operation for an unavailable date is in progress.
  const [isProcessingUnavailableDate, setIsProcessingUnavailableDate] = useState(false);
  // State to track if the initial component mount and setup has completed.
  // Used to gate local storage loading until after the first render.
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Effect to mark initial load as complete once the component mounts.
  useEffect(() => {
    setInitialLoadComplete(true);
  }, []);

  // Effect to load unavailable dates from local storage on initial load, if available.
  // This provides a faster perceived load time for returning users.
  useEffect(() => {
    if (initialLoadComplete) {
      const cachedUnavailableDates = getItemWithTimestampRevival<UnavailableDate[]>(LS_UNAVAILABLE_DATES_KEY);
      if (cachedUnavailableDates) {
        setUnavailableDates(cachedUnavailableDates);
        setIsLoadingUnavailableDates(false); // If cache hit, no need to show main loading state.
      }
    }
  }, [initialLoadComplete]);

  /**
   * Fetches unavailable dates from Firestore for the currently logged-in barber.
   * Updates the local state and caches the fetched data in local storage.
   */
  const fetchUnavailableDates = useCallback(async () => {
    if (!user?.uid) return; // Ensure user is logged in.
    setIsLoadingUnavailableDates(true);
    try {
      // Reference to the 'unavailableDates' subcollection for the barber.
      const unavailableDatesColRef = collection(firestore, `barberSchedules/${user.uid}/unavailableDates`);
      // Query to fetch dates ordered by date ascending.
      const q = query(unavailableDatesColRef, orderBy('date', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetchedDates: UnavailableDate[] = [];
      querySnapshot.forEach((doc) => {
        // Map Firestore document data to UnavailableDate type.
        fetchedDates.push({ id: doc.id, ...doc.data() } as UnavailableDate);
      });
      setUnavailableDates(fetchedDates); // Update state.
      setItemWithTimestampConversion(LS_UNAVAILABLE_DATES_KEY, fetchedDates); // Cache in local storage.
    } catch (error) {
      console.error("Error fetching unavailable dates:", error);
      toast({ title: "Error", description: "Could not fetch unavailable dates.", variant: "destructive" });
    } finally {
      setIsLoadingUnavailableDates(false);
    }
  }, [user?.uid, toast]);

  /**
   * Handles adding a new unavailable date.
   *
   * @param {string} date - The date to mark as unavailable (YYYY-MM-DD format).
   * @param {string} [reason] - An optional reason for the unavailability.
   */
  const handleAddUnavailableDate = async (date: string, reason?: string) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsProcessingUnavailableDate(true);
    try {
      // Check if the date is already marked as unavailable to prevent duplicates.
      const existingDate = unavailableDates.find(ud => ud.date === date);
      if (existingDate) {
        toast({ title: "Date Exists", description: "This date is already marked as unavailable.", variant: "destructive" });
        setIsProcessingUnavailableDate(false);
        return;
      }

      // Use the date string as the document ID for simplicity and uniqueness.
      const unavailableDateDocRef = doc(firestore, `barberSchedules/${user.uid}/unavailableDates`, date);
      // Prepare the new unavailable date object.
      const newUnavailableDate: Omit<UnavailableDate, 'id'> = {
        barberId: user.uid,
        date,
        reason: reason || '', // Default to empty string if no reason provided.
        createdAt: Timestamp.now(), // Record creation time.
      };
      await setDoc(unavailableDateDocRef, newUnavailableDate); // Save to Firestore.

      // Update local state optimistically and re-cache.
      const finalDateEntry = { ...newUnavailableDate, id: date } as UnavailableDate;
      setUnavailableDates((prev) => {
        const updated = [...prev, finalDateEntry].sort((a,b) => a.date.localeCompare(b.date));
        setItemWithTimestampConversion(LS_UNAVAILABLE_DATES_KEY, updated);
        return updated;
      });
      toast({ title: "Success", description: "Date marked as unavailable." });
    } catch (error) {
      console.error("Error adding unavailable date:", error);
      toast({ title: "Error", description: "Could not add unavailable date.", variant: "destructive" });
    } finally {
      setIsProcessingUnavailableDate(false);
    }
  };

  /**
   * Handles removing an unavailable date.
   *
   * @param {string} dateId - The ID of the unavailable date to remove (which is the date string itself).
   */
  const handleRemoveUnavailableDate = async (dateId: string) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsProcessingUnavailableDate(true);
    try {
      const unavailableDateDocRef = doc(firestore, `barberSchedules/${user.uid}/unavailableDates`, dateId);
      await deleteDoc(unavailableDateDocRef); // Delete from Firestore.

      // Update local state optimistically and re-cache.
      setUnavailableDates((prev) => {
        const updated = prev.filter(ud => ud.id !== dateId);
        setItemWithTimestampConversion(LS_UNAVAILABLE_DATES_KEY, updated);
        return updated;
      });
      toast({ title: "Success", description: "Unavailable date removed." });
    } catch (error) {
      console.error("Error removing unavailable date:", error);
      toast({ title: "Error", description: "Could not remove unavailable date.", variant: "destructive" });
    } finally {
      setIsProcessingUnavailableDate(false);
    }
  };

  // Effect to fetch unavailable dates from Firestore when the user ID is available and initial load is complete.
  // This ensures fresh data is fetched after the initial cache load attempt.
  useEffect(() => {
    if (user?.uid && initialLoadComplete) {
      fetchUnavailableDates();
    }
  }, [user?.uid, fetchUnavailableDates, initialLoadComplete]);

  return (
    // ProtectedPage ensures only authenticated barbers can access this page.
    <ProtectedPage expectedRole="barber">
      <div className="space-y-6">
        {/* Conditional rendering for loading state. */}
        {/* Shows a spinner if loading and no dates are yet available (e.g., from cache). */}
         {(isLoadingUnavailableDates && !unavailableDates.length) ? (
          <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-8 w-8 text-primary" />
            <p className="ml-2 text-base">Loading unavailable dates...</p>
          </div>
        ) : (
          // Renders the main section for managing unavailable dates.
           <ManageUnavailableDatesSection
            unavailableDates={unavailableDates}
            onAddUnavailableDate={handleAddUnavailableDate}
            onRemoveUnavailableDate={handleRemoveUnavailableDate}
            isProcessing={isProcessingUnavailableDate} // Pass processing state to disable inputs in child component.
          />
        )}
      </div>
    </ProtectedPage>
  );
}
