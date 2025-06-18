/**
 * @fileoverview ManageServicesSection component.
 * This component provides the UI for barbers to manage their offered services.
 * It displays a list of existing services and allows adding, editing, and deleting services
 * via a dialog (`ServiceDialog`).
 */
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic'; // For dynamically importing components.
import { Button } from '@/components/ui/button'; // Button UI component.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Card UI components.
import type { BarberService } from '@/types'; // Type definition for a barber service.
import { PlusCircle, Edit3, Trash2, DollarSign, Clock, Info } from 'lucide-react'; // Icons.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Alert dialog for delete confirmation.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.

// Dynamically import ServiceDialog to improve initial page load time.
// Shows a loading spinner while the dialog component is being loaded.
const ServiceDialog = dynamic(() => import('./ServiceDialog'), {
  loading: () => <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[100]"><LoadingSpinner className="h-8 w-8 text-primary" /></div>,
  ssr: false // This component is client-side only.
});

/**
 * Props for the ManageServicesSection component.
 * @interface ManageServicesSectionProps
 * @property {BarberService[]} services - The list of current services offered by the barber.
 * @property {(service: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => Promise<void>} onAddService - Callback to add a new service.
 * @property {(serviceId: string, serviceData: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => Promise<void>} onUpdateService - Callback to update an existing service.
 * @property {(serviceId: string) => Promise<void>} onDeleteService - Callback to delete a service.
 */
interface ManageServicesSectionProps {
  services: BarberService[];
  onAddService: (service: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateService: (serviceId: string, serviceData: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteService: (serviceId: string) => Promise<void>;
}

/**
 * ManageServicesSection component.
 * Renders the UI for managing barber services.
 *
 * @param {ManageServicesSectionProps} props - The component's props.
 * @returns {JSX.Element} The rendered manage services section.
 */
export default function ManageServicesSection({
  services,
  onAddService,
  onUpdateService,
  onDeleteService,
}: ManageServicesSectionProps) {
  // State to control the visibility of the add/edit service dialog.
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // State to hold the service data when editing an existing service.
  const [serviceToEdit, setServiceToEdit] = useState<BarberService | null>(null);
  // State to hold the service data when confirming deletion.
  const [serviceToDelete, setServiceToDelete] = useState<BarberService | null>(null);
  // State to indicate if a service add/update/delete operation is in progress.
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Opens the service dialog. If a service is provided, it's for editing; otherwise, it's for adding.
   * @param {BarberService} [service] - The service to edit (optional).
   */
  const handleOpenDialog = (service?: BarberService) => {
    setServiceToEdit(service || null); // Set service to edit or null for new service.
    setIsDialogOpen(true);
  };

  /**
   * Closes the service dialog and resets the serviceToEdit state.
   * Prevents closing if a submission is in progress.
   */
  const handleCloseDialog = () => {
    if (isSubmitting) return; // Don't close if submitting.
    setIsDialogOpen(false);
    setServiceToEdit(null);
  };

  /**
   * Handles the submission of the service form (add or edit).
   * Calls the appropriate callback (onAddService or onUpdateService).
   *
   * @param {Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>} serviceData - The service data from the form.
   * @param {string} [id] - The ID of the service if editing, undefined if adding.
   */
  const handleSubmitService = async (serviceData: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>, id?: string) => {
    setIsSubmitting(true); // Set loading state.
    if (id) { // If ID exists, it's an update.
      await onUpdateService(id, serviceData);
    } else { // Otherwise, it's an add.
      await onAddService(serviceData);
    }
    setIsSubmitting(false); // Clear loading state.
    handleCloseDialog(); // Close dialog on successful submission.
  };

  /**
   * Handles the confirmation of deleting a service.
   * Calls the onDeleteService callback.
   */
  const handleDeleteConfirm = async () => {
    if (serviceToDelete) {
      setIsSubmitting(true); // Set loading state.
      await onDeleteService(serviceToDelete.id);
      setIsSubmitting(false); // Clear loading state.
      setServiceToDelete(null); // Clear the service marked for deletion.
    }
  };

  return (
    <Card className="border-none shadow-lg rounded-xl overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-6 gap-3 bg-gradient-to-tr from-card via-muted/10 to-card">
        <div>
          <CardTitle className="text-2xl font-bold font-headline">Manage Your Services</CardTitle>
          <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add, edit, or remove the services you offer.</CardDescription>
        </div>
        {/* Button to open the dialog for adding a new service. */}
        <Button onClick={() => handleOpenDialog()} className="rounded-full h-11 px-6 text-base w-full sm:w-auto" disabled={isSubmitting}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Service
        </Button>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        {/* Display message if no services are available. */}
        {services.length === 0 ? (
          <div className="text-center py-8 px-4 border-2 border-dashed border-muted rounded-lg bg-card">
            <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No Services Yet</h3>
            <p className="text-base text-gray-500 dark:text-gray-400">
              You haven't added any services. Click the "Add New Service" button above to get started and let customers know what you offer!
            </p>
          </div>
        ) : (
          // List existing services.
          <div className="space-y-4">
            {services.map((service) => (
              <Card key={service.id} className="shadow-md rounded-lg border hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Service details. */}
                  <div className="flex-grow">
                    <h3 className="font-semibold text-base">{service.name}</h3>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <span className="flex items-center"><DollarSign className="mr-1 h-4 w-4" /> Price: ${service.price.toFixed(2)}</span>
                      <span className="flex items-center mt-1 sm:mt-0"><Clock className="mr-1 h-4 w-4" /> Duration: <span className="text-primary ml-1">{service.duration} min</span></span>
                    </div>
                  </div>
                  {/* Action buttons (Edit, Delete). */}
                  <div className="space-x-2 flex-shrink-0 self-start sm:self-center mt-2 sm:mt-0">
                    {/* Edit Button */}
                    <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => handleOpenDialog(service)} disabled={isSubmitting}>
                      <Edit3 className="h-4 w-4" />
                      <span className="sr-only">Edit {service.name}</span>
                    </Button>
                    {/* Delete Button with Confirmation Dialog */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" className="rounded-full h-9 w-9" onClick={() => setServiceToDelete(service)} disabled={isSubmitting}>
                          <Trash2 className="h-4 w-4" />
                           <span className="sr-only">Delete {service.name}</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl font-bold">Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription className="text-base text-gray-500 dark:text-gray-400 pt-1">
                            This action cannot be undone. This will permanently delete the service "{serviceToDelete?.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-4">
                          <AlertDialogCancel onClick={() => setServiceToDelete(null)} className="rounded-full h-10 px-4" disabled={isSubmitting}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteConfirm} className="rounded-full h-10 px-4" variant="destructive" disabled={isSubmitting}>
                            {isSubmitting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
                            {isSubmitting ? 'Deleting...' : 'Delete Service'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      {/* Service Dialog (Add/Edit), rendered conditionally based on isDialogOpen. */}
      {isDialogOpen && (
        <ServiceDialog
          isOpen={isDialogOpen}
          onClose={handleCloseDialog}
          onSubmit={handleSubmitService}
          serviceToEdit={serviceToEdit}
          isSubmitting={isSubmitting}
        />
      )}
    </Card>
  );
}
