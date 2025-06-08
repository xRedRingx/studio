
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

interface ManageServicesSectionProps {
  services: BarberService[];
  onAddService: (service: Omit<BarberService, 'id'>) => void;
  onUpdateService: (serviceId: string, serviceData: Omit<BarberService, 'id'>) => void;
  onDeleteService: (serviceId: string) => void;
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

  const handleOpenDialog = (service?: BarberService) => {
    setServiceToEdit(service || null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setServiceToEdit(null);
  };

  const handleSubmitService = (serviceData: Omit<BarberService, 'id'>, id?: string) => {
    if (id) {
      onUpdateService(id, serviceData);
    } else {
      onAddService(serviceData);
    }
    handleCloseDialog();
  };

  const handleDeleteConfirm = () => {
    if (serviceToDelete) {
      onDeleteService(serviceToDelete.id);
      setServiceToDelete(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Manage Services</CardTitle>
          <CardDescription>Add, edit, or remove the services you offer.</CardDescription>
        </div>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Service
        </Button>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <p className="text-muted-foreground">You have not added any services yet.</p>
        ) : (
          <div className="space-y-4">
            {services.map((service) => (
              <Card key={service.id} className="shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{service.name}</h3>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center"><DollarSign className="mr-1 h-4 w-4" /> ${service.price.toFixed(2)}</span>
                      <span className="flex items-center"><Clock className="mr-1 h-4 w-4" /> {service.duration} min</span>
                    </div>
                  </div>
                  <div className="space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleOpenDialog(service)}>
                      <Edit3 className="h-4 w-4" />
                      <span className="sr-only">Edit {service.name}</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" onClick={() => setServiceToDelete(service)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {service.name}</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the service "{serviceToDelete?.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setServiceToDelete(null)}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
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
      <ServiceDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmitService}
        serviceToEdit={serviceToEdit}
      />
    </Card>
  );
}
