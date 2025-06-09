
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { BarberService } from '@/types';
import { useEffect } from 'react';
import LoadingSpinner from '@/components/ui/loading-spinner';

const serviceSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(100, 'Service name is too long'),
  price: z.coerce.number().min(0, 'Price must be a non-negative number').max(10000, 'Price seems too high'),
  duration: z.coerce.number().min(5, 'Duration must be at least 5 minutes').max(720, 'Duration is too long (max 12 hours)').int('Duration must be a whole number'),
});

type ServiceFormValues = Omit<BarberService, 'id' | 'barberId' | 'createdAt' | 'updatedAt'>;

interface ServiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (service: ServiceFormValues, id?: string) => Promise<void>;
  serviceToEdit?: BarberService | null;
  isSubmitting: boolean;
}

export default function ServiceDialog({ isOpen, onClose, onSubmit, serviceToEdit, isSubmitting }: ServiceDialogProps) {
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      price: 0,
      duration: 30,
    },
  });

  useEffect(() => {
    if (isOpen) { 
      if (serviceToEdit) {
        form.reset({
          name: serviceToEdit.name,
          price: serviceToEdit.price,
          duration: serviceToEdit.duration,
        });
      } else {
        form.reset({ name: '', price: 0, duration: 30 });
      }
    }
  }, [serviceToEdit, form, isOpen]);

  const handleSubmit = async (values: ServiceFormValues) => {
    await onSubmit(values, serviceToEdit?.id);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md rounded-lg">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-2xl font-bold">{serviceToEdit ? 'Edit Service' : 'Add New Service'}</DialogTitle>
          <DialogDescription className="text-sm text-gray-500 pt-1">
            {serviceToEdit ? 'Update the details of your service.' : 'Fill in the details for your new service.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 px-6 pb-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Service Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Men's Haircut" {...field} disabled={isSubmitting} className="h-11 text-base" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Price ($)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 30" {...field} step="0.01" disabled={isSubmitting} className="h-11 text-base"/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Duration (minutes)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 30" {...field} step="5" disabled={isSubmitting} className="h-11 text-base"/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="rounded-full h-11 px-6 text-base" disabled={isSubmitting} onClick={onClose}>Cancel</Button>
              </DialogClose>
              <Button type="submit" className="rounded-full h-11 px-6 text-base" disabled={isSubmitting}>
                {isSubmitting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
                {isSubmitting ? (serviceToEdit ? 'Saving...' : 'Adding...') : (serviceToEdit ? 'Save Changes' : 'Add Service')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
