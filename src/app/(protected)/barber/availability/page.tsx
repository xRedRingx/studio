
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

// Helper to convert Firestore Timestamps in an object to ISO strings
const convertTimestampsToISO = (data: any) => {
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(convertTimestampsToISO);
  }
  const newData: { [key: string]: any } = {};
  for (const key in data) {
    newData[key] = convertTimestampsToISO(data[key]);
  }
  return newData;
};

// Helper to convert ISO strings in an object back to Timestamps
const convertISOToTimestamps = (data: any): any => {
    if (data === null || typeof data !== 'object') {
      if (typeof data === 'string' && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(data)) {
         try {
            return Timestamp.fromDate(new Date(data));
        } catch (e) { /* ignore, not a valid date string for Timestamp */ }
      }
      return data;
    }
    if (Array.isArray(data)) {
      return data.map(convertISOToTimestamps);
    }
    const newData: { [key: string]: any } = {};
    for (const key in data) {
      newData[key] = convertISOToTimestamps(data[key]);
    }
    return newData;
  };

const LS_UNAVAILABLE_DATES_KEY = 'barber_availability_page_unavailable_dates';

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
    if (typeof window !== 'undefined' && initialLoadComplete) {
      const cachedUnavailableDates = localStorage.getItem(LS_UNAVAILABLE_DATES_KEY);
      if (cachedUnavailableDates) {
        setUnavailableDates(convertISOToTimestamps(JSON.parse(cachedUnavailableDates)));
        setIsLoadingUnavailableDates(false);
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
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_UNAVAILABLE_DATES_KEY, JSON.stringify(convertTimestampsToISO(fetchedDates)));
      }
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
        if (typeof window !== 'undefined') {
          localStorage.setItem(LS_UNAVAILABLE_DATES_KEY, JSON.stringify(convertTimestampsToISO(updated)));
        }
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
        if (typeof window !== 'undefined') {
          localStorage.setItem(LS_UNAVAILABLE_DATES_KEY, JSON.stringify(convertTimestampsToISO(updated)));
        }
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
