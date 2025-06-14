
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
import { getItemWithTimestampRevival, setItemWithTimestampConversion, LS_SERVICES_KEY_BARBER_SERVICES_PAGE } from '@/lib/localStorageUtils';


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
    if (initialLoadComplete) {
      const cachedServices = getItemWithTimestampRevival<BarberService[]>(LS_SERVICES_KEY_BARBER_SERVICES_PAGE);
      if (cachedServices) {
        setServices(cachedServices);
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
      setItemWithTimestampConversion(LS_SERVICES_KEY_BARBER_SERVICES_PAGE, fetchedServices);
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
        setItemWithTimestampConversion(LS_SERVICES_KEY_BARBER_SERVICES_PAGE, updated);
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
        setItemWithTimestampConversion(LS_SERVICES_KEY_BARBER_SERVICES_PAGE, updated);
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
        setItemWithTimestampConversion(LS_SERVICES_KEY_BARBER_SERVICES_PAGE, updated);
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
        {/* Title moved into ManageServicesSection for better encapsulation */}
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
