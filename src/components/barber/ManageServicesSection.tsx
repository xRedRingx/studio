
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { BarberService } from '@/types';
import ServiceDialog from './ServiceDialog';
import { PlusCircle, Edit3, Trash2, DollarSign, Clock } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import LoadingSpinner from '@/components/ui/loading-spinner';

interface ManageServicesSectionProps {
  services: BarberService[];
  onAddService: (service: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateService: (serviceId: string, serviceData: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteService: (serviceId: string) => Promise<void>;
}

export default function ManageServicesSection({
  services,
  onAddService,
  onUpdateService,
  onDeleteService,
}: ManageServicesSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<BarberService | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<BarberService | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenDialog = (service?: BarberService) => {
    setServiceToEdit(service || null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (isSubmitting) return;
    setIsDialogOpen(false);
    setServiceToEdit(null);
  };

  const handleSubmitService = async (serviceData: Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>, id?: string) => {
    setIsSubmitting(true);
    if (id) {
      await onUpdateService(id, serviceData);
    } else {
      await onAddService(serviceData);
    }
    setIsSubmitting(false);
    handleCloseDialog();
  };

  const handleDeleteConfirm = async () => {
    if (serviceToDelete) {
      setIsSubmitting(true);
      await onDeleteService(serviceToDelete.id);
      setIsSubmitting(false);
      setServiceToDelete(null);
    }
  };

  return (
    <Card className="border-none shadow-lg rounded-xl overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <div>
          <CardTitle className="text-2xl font-bold">Manage Services</CardTitle>
          <CardDescription className="text-sm text-gray-500 mt-1">Add, edit, or remove the services you offer.</CardDescription>
        </div>
        <Button onClick={() => handleOpenDialog()} size="sm" className="rounded-full h-10 px-4" disabled={isSubmitting}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New
        </Button>
      </CardHeader>
      <CardContent className="p-6">
        {services.length === 0 ? (
          <p className="text-base text-gray-500">You have not added any services yet. Click "Add New" to begin.</p>
        ) : (
          <div className="space-y-4">
            {services.map((service) => (
              <Card key={service.id} className="shadow-sm rounded-lg border">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-base">{service.name}</h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center"><DollarSign className="mr-1 h-4 w-4" /> ${service.price.toFixed(2)}</span>
                      <span className="flex items-center"><Clock className="mr-1 h-4 w-4" /> <span className="text-[#0088E0]">{service.duration} min</span></span>
                    </div>
                  </div>
                  <div className="space-x-2">
                    <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => handleOpenDialog(service)} disabled={isSubmitting}>
                      <Edit3 className="h-4 w-4" />
                      <span className="sr-only">Edit {service.name}</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" className="rounded-full h-9 w-9" onClick={() => setServiceToDelete(service)} disabled={isSubmitting}>
                          <Trash2 className="h-4 w-4" />
                           <span className="sr-only">Delete {service.name}</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl font-bold">Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription className="text-base text-gray-500">
                            This action cannot be undone. This will permanently delete the service "{serviceToDelete?.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-4">
                          <AlertDialogCancel onClick={() => setServiceToDelete(null)} className="rounded-full h-10 px-4" disabled={isSubmitting}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteConfirm} className="rounded-full h-10 px-4" disabled={isSubmitting}>
                            {isSubmitting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
                            {isSubmitting ? 'Deleting...' : 'Delete'}
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
