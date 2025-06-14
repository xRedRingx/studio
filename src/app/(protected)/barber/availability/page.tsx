
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { UnavailableDate } from '@/types';
import ManageUnavailableDatesSection from '@/components/barber/ManageUnavailableDatesSection';
import { firestore } from '@/firebase/config';
import {
  collection,
  query,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { getItemWithTimestampRevival, setItemWithTimestampConversion, LS_UNAVAILABLE_DATES_KEY } from '@/lib/localStorageUtils';


export default function BarberAvailabilityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [unavailableDates, setUnavailableDates] = useState<UnavailableDate[]>([]);
  const [isLoadingUnavailableDates, setIsLoadingUnavailableDates] = useState(true);
  const [isProcessingUnavailableDate, setIsProcessingUnavailableDate] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    setInitialLoadComplete(true);
  }, []);

  useEffect(() => {
    if (initialLoadComplete) {
      const cachedUnavailableDates = getItemWithTimestampRevival<UnavailableDate[]>(LS_UNAVAILABLE_DATES_KEY);
      if (cachedUnavailableDates) {
        setUnavailableDates(cachedUnavailableDates);
        setIsLoadingUnavailableDates(false); // Loaded from cache, reduce initial loading perception
      }
    }
  }, [initialLoadComplete]);

  const fetchUnavailableDates = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingUnavailableDates(true);
    try {
      const unavailableDatesColRef = collection(firestore, `barberSchedules/${user.uid}/unavailableDates`);
      const q = query(unavailableDatesColRef, orderBy('date', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetchedDates: UnavailableDate[] = [];
      querySnapshot.forEach((doc) => {
        fetchedDates.push({ id: doc.id, ...doc.data() } as UnavailableDate);
      });
      setUnavailableDates(fetchedDates);
      setItemWithTimestampConversion(LS_UNAVAILABLE_DATES_KEY, fetchedDates);
    } catch (error) {
      console.error("Error fetching unavailable dates:", error);
      toast({ title: "Error", description: "Could not fetch unavailable dates.", variant: "destructive" });
    } finally {
      setIsLoadingUnavailableDates(false);
    }
  }, [user?.uid, toast]);

  const handleAddUnavailableDate = async (date: string, reason?: string) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsProcessingUnavailableDate(true);
    try {
      const existingDate = unavailableDates.find(ud => ud.date === date);
      if (existingDate) {
        toast({ title: "Date Exists", description: "This date is already marked as unavailable.", variant: "destructive" });
        setIsProcessingUnavailableDate(false);
        return;
      }

      const unavailableDateDocRef = doc(firestore, `barberSchedules/${user.uid}/unavailableDates`, date);
      const newUnavailableDate: Omit<UnavailableDate, 'id'> = {
        barberId: user.uid,
        date,
        reason: reason || '',
        createdAt: Timestamp.now(),
      };
      await setDoc(unavailableDateDocRef, newUnavailableDate);
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

  const handleRemoveUnavailableDate = async (dateId: string) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsProcessingUnavailableDate(true);
    try {
      const unavailableDateDocRef = doc(firestore, `barberSchedules/${user.uid}/unavailableDates`, dateId);
      await deleteDoc(unavailableDateDocRef);
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
  
  useEffect(() => {
    if (user?.uid && initialLoadComplete) {
      fetchUnavailableDates();
    }
  }, [user?.uid, fetchUnavailableDates, initialLoadComplete]);

  return (
    <ProtectedPage expectedRole="barber">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-headline">Manage Your Availability</h1>
         {(isLoadingUnavailableDates && !unavailableDates.length) ? (
          <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-8 w-8 text-primary" />
            <p className="ml-2 text-base">Loading unavailable dates...</p>
          </div>
        ) : (
           <ManageUnavailableDatesSection
            unavailableDates={unavailableDates}
            onAddUnavailableDate={handleAddUnavailableDate}
            onRemoveUnavailableDate={handleRemoveUnavailableDate}
            isProcessing={isProcessingUnavailableDate}
          />
        )}
      </div>
    </ProtectedPage>
  );
}

