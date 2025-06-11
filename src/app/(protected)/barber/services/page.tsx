
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { useAuth } from '@/hooks/useAuth';
import type { BarberService } from '@/types';
import ManageServicesSection from '@/components/barber/ManageServicesSection';
import { firestore } from '@/firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
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

const LS_SERVICES_KEY = 'barber_services_page_services';

export default function BarberServicesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState<BarberService[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    setInitialLoadComplete(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && initialLoadComplete) {
      const cachedServices = localStorage.getItem(LS_SERVICES_KEY);
      if (cachedServices) {
        setServices(convertISOToTimestamps(JSON.parse(cachedServices)));
        setIsLoadingServices(false);
      }
    }
  }, [initialLoadComplete]);

  const fetchServices = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingServices(true);
    try {
      const servicesCollection = collection(firestore, 'services');
      const q = query(servicesCollection, where('barberId', '==', user.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedServices: BarberService[] = [];
      querySnapshot.forEach((doc) => {
        fetchedServices.push({ id: doc.id, ...doc.data() } as BarberService);
      });
      setServices(fetchedServices);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_SERVICES_KEY, JSON.stringify(convertTimestampsToISO(fetchedServices)));
      }
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({ title: "Error", description: "Could not fetch services.", variant: "destructive" });
    } finally {
      setIsLoadingServices(false);
    }
  }, [user?.uid, toast]);

  const handleAddService = async (serviceData: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in to add services.", variant: "destructive" });
      return;
    }
    try {
      const now = Timestamp.now();
      const newServiceData = { ...serviceData, barberId: user.uid, createdAt: now, updatedAt: now };
      const docRef = await addDoc(collection(firestore, 'services'), newServiceData);
      const newServiceEntry = { ...newServiceData, id: docRef.id };
      setServices((prev) => {
        const updated = [newServiceEntry, ...prev];
        if (typeof window !== 'undefined') {
            localStorage.setItem(LS_SERVICES_KEY, JSON.stringify(convertTimestampsToISO(updated)));
        }
        return updated;
      });
      toast({ title: "Success", description: "Service added successfully." });
    } catch (error) {
      console.error("Error adding service:", error);
      toast({ title: "Error", description: "Could not add service.", variant: "destructive" });
    }
  };

  const handleUpdateService = async (serviceId: string, serviceData: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in to update services.", variant: "destructive" });
      return;
    }
    try {
      const serviceRef = doc(firestore, 'services', serviceId);
      const updatedServiceData = { ...serviceData, updatedAt: Timestamp.now() };
      await updateDoc(serviceRef, updatedServiceData);
      setServices((prev) => {
        const updated = prev.map(s => s.id === serviceId ? { ...s, ...updatedServiceData } : s);
        if (typeof window !== 'undefined') {
            localStorage.setItem(LS_SERVICES_KEY, JSON.stringify(convertTimestampsToISO(updated)));
        }
        return updated;
      });
      toast({ title: "Success", description: "Service updated successfully." });
    } catch (error) {
      console.error("Error updating service:", error);
      toast({ title: "Error", description: "Could not update service.", variant: "destructive" });
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in to delete services.", variant: "destructive" });
      return;
    }
    try {
      const serviceRef = doc(firestore, 'services', serviceId);
      await deleteDoc(serviceRef);
      setServices((prev) => {
        const updated = prev.filter(s => s.id !== serviceId);
        if (typeof window !== 'undefined') {
            localStorage.setItem(LS_SERVICES_KEY, JSON.stringify(convertTimestampsToISO(updated)));
        }
        return updated;
      });
      toast({ title: "Success", description: "Service deleted successfully." });
    } catch (error) {
      console.error("Error deleting service:", error);
      toast({ title: "Error", description: "Could not delete service.", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (user?.uid && initialLoadComplete) {
      fetchServices();
    }
  }, [user?.uid, fetchServices, initialLoadComplete]);

  return (
    <ProtectedPage expectedRole="barber">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-headline">Manage Your Services</h1>
        {(isLoadingServices && !services.length) ? (
          <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-8 w-8 text-primary" />
            <p className="ml-2 text-base">Loading services...</p>
          </div>
        ) : (
          <ManageServicesSection
            services={services}
            onAddService={handleAddService}
            onUpdateService={handleUpdateService}
            onDeleteService={handleDeleteService}
          />
        )}
      </div>
    </ProtectedPage>
  );
}
