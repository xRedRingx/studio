/**
 * @fileoverview Barber Services Page.
 * This page allows barbers to manage the services they offer.
 * They can add new services, edit existing ones (name, price, duration), and delete services.
 * Service data is fetched from and saved to Firestore, and also cached in local storage
 * for faster initial loads and potential offline access.
 */
'use client';
import { useState, useEffect, useCallback } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage'; // Ensures authenticated barber access.
import { useAuth } from '@/hooks/useAuth'; // Auth context hook.
import type { BarberService } from '@/types'; // Type definition for a barber service.
import ManageServicesSection from '@/components/barber/ManageServicesSection'; // UI component for managing services.
import { firestore } from '@/firebase/config'; // Firebase Firestore instance.
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
} from 'firebase/firestore'; // Firestore methods.
import { useToast } from '@/hooks/use-toast'; // Toast notification hook.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.
// Local storage utilities with Timestamp conversion.
import { getItemWithTimestampRevival, setItemWithTimestampConversion, LS_SERVICES_KEY_BARBER_SERVICES_PAGE } from '@/lib/localStorageUtils';

/**
 * BarberServicesPage component.
 * Renders the page for managing a barber's offered services.
 *
 * @returns {JSX.Element} The rendered services page.
 */
export default function BarberServicesPage() {
  const { user } = useAuth(); // Get current authenticated barber.
  const { toast } = useToast(); // Hook for displaying notifications.

  // State for the list of barber services.
  const [services, setServices] = useState<BarberService[]>([]);
  // State to indicate if services are currently being loaded from Firestore.
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  // State to track if the initial component mount and setup has completed.
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Effect to mark initial load as complete.
  useEffect(() => {
    setInitialLoadComplete(true);
  }, []);

  // Effect to load services from local storage on initial load, if available.
  useEffect(() => {
    if (initialLoadComplete) {
      const cachedServices = getItemWithTimestampRevival<BarberService[]>(LS_SERVICES_KEY_BARBER_SERVICES_PAGE);
      if (cachedServices) {
        setServices(cachedServices);
        setIsLoadingServices(false); // If cache hit, no need to show main loading state.
      }
    }
  }, [initialLoadComplete]);

  /**
   * Fetches the barber's services from Firestore.
   * Updates local state and caches the fetched services.
   */
  const fetchServices = useCallback(async () => {
    if (!user?.uid) return; // Ensure user is logged in.
    setIsLoadingServices(true);
    try {
      const servicesCollection = collection(firestore, 'services');
      // Query services for the current barber, ordered by creation time (descending).
      const q = query(servicesCollection, where('barberId', '==', user.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedServices: BarberService[] = [];
      querySnapshot.forEach((doc) => {
        fetchedServices.push({ id: doc.id, ...doc.data() } as BarberService);
      });
      setServices(fetchedServices); // Update state.
      setItemWithTimestampConversion(LS_SERVICES_KEY_BARBER_SERVICES_PAGE, fetchedServices); // Cache in local storage.
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({ title: "Error", description: "Could not fetch services.", variant: "destructive" });
    } finally {
      setIsLoadingServices(false);
    }
  }, [user?.uid, toast]);

  /**
   * Handles adding a new service.
   *
   * @param {Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>} serviceData - The data for the new service.
   */
  const handleAddService = async (serviceData: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in to add services.", variant: "destructive" });
      return;
    }
    try {
      const now = Timestamp.now(); // Current time for timestamps.
      // Prepare new service data, including barberId and timestamps.
      const newServiceData = { ...serviceData, barberId: user.uid, createdAt: now, updatedAt: now };
      const docRef = await addDoc(collection(firestore, 'services'), newServiceData); // Add to Firestore.
      const newServiceEntry = { ...newServiceData, id: docRef.id }; // New service object with generated ID.

      // Update local state optimistically and re-cache.
      setServices((prev) => {
        const updated = [newServiceEntry, ...prev]; // Add to the beginning of the list.
        setItemWithTimestampConversion(LS_SERVICES_KEY_BARBER_SERVICES_PAGE, updated);
        return updated;
      });
      toast({ title: "Success", description: "Service added successfully." });
    } catch (error) {
      console.error("Error adding service:", error);
      toast({ title: "Error", description: "Could not add service.", variant: "destructive" });
    }
  };

  /**
   * Handles updating an existing service.
   *
   * @param {string} serviceId - The ID of the service to update.
   * @param {Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>} serviceData - The updated service data.
   */
  const handleUpdateService = async (serviceId: string, serviceData: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in to update services.", variant: "destructive" });
      return;
    }
    try {
      const serviceRef = doc(firestore, 'services', serviceId);
      // Prepare updated service data, including the updatedAt timestamp.
      const updatedServiceData = { ...serviceData, updatedAt: Timestamp.now() };
      await updateDoc(serviceRef, updatedServiceData); // Update in Firestore.

      // Update local state optimistically and re-cache.
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

  /**
   * Handles deleting a service.
   *
   * @param {string} serviceId - The ID of the service to delete.
   */
  const handleDeleteService = async (serviceId: string) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in to delete services.", variant: "destructive" });
      return;
    }
    try {
      const serviceRef = doc(firestore, 'services', serviceId);
      await deleteDoc(serviceRef); // Delete from Firestore.

      // Update local state optimistically and re-cache.
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

  // Effect to fetch services from Firestore when user ID is available and initial load is complete.
  useEffect(() => {
    if (user?.uid && initialLoadComplete) {
      fetchServices();
    }
  }, [user?.uid, fetchServices, initialLoadComplete]);

  return (
    // ProtectedPage ensures only authenticated barbers can access this page.
    <ProtectedPage expectedRole="barber">
      <div className="space-y-6">
        {/* Conditional rendering for loading state. */}
        {/* Shows spinner if loading and no services are yet available (e.g., from cache). */}
        {(isLoadingServices && !services.length) ? (
          <div className="flex justify-center items-center py-10">
            <LoadingSpinner className="h-8 w-8 text-primary" />
            <p className="ml-2 text-base">Loading services...</p>
          </div>
        ) : (
          // Renders the main section for managing services.
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
