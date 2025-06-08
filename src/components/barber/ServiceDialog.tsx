
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
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { BarberService } from '@/types';
import { useEffect } from 'react';

const serviceSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  price: z.coerce.number().min(0, 'Price must be a positive number'),
  duration: z.coerce.number().min(5, 'Duration must be at least 5 minutes').int(),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

interface ServiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (service: Omit<BarberService, 'id'>, id?: string) => void;
  serviceToEdit?: BarberService | null;
}

export default function ServiceDialog({ isOpen, onClose, onSubmit, serviceToEdit }: ServiceDialogProps) {
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      price: 0,
      duration: 30,
    },
  });

  useEffect(() => {
    if (serviceToEdit) {
      form.reset({
        name: serviceToEdit.name,
        price: serviceToEdit.price,
        duration: serviceToEdit.duration,
      });
    } else {
      form.reset({ name: '', price: 0, duration: 30 });
    }
  }, [serviceToEdit, form, isOpen]);

  const handleSubmit = (values: ServiceFormValues) => {
    onSubmit(values, serviceToEdit?.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{serviceToEdit ? 'Edit Service' : 'Add New Service'}</DialogTitle>
          <DialogDescription>
            {serviceToEdit ? 'Update the details of your service.' : 'Fill in the details for your new service.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Men's Haircut" {...field} />
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
                  <FormLabel>Price ($)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 30" {...field} />
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
                  <FormLabel>Duration (minutes)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 30" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit">{serviceToEdit ? 'Save Changes' : 'Add Service'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
