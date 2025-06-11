
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BarberService } from '@/types';
import { useEffect } from 'react';
import LoadingSpinner from '@/components/ui/loading-spinner';

const walkInSchema = z.object({
  serviceId: z.string().min(1, 'Please select a service.'),
  customerName: z.string().min(1, 'Customer name is required').max(100, 'Customer name is too long'),
});

type WalkInFormValues = z.infer<typeof walkInSchema>;

interface WalkInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (serviceId: string, customerName: string) => Promise<void>;
  services: BarberService[];
  isSubmitting: boolean;
}

export default function WalkInDialog({ isOpen, onClose, onSubmit, services, isSubmitting }: WalkInDialogProps) {
  const form = useForm<WalkInFormValues>({
    resolver: zodResolver(walkInSchema),
    defaultValues: {
      serviceId: '',
      customerName: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ serviceId: '', customerName: '' });
    }
  }, [form, isOpen]);

  const handleSubmit = async (values: WalkInFormValues) => {
    await onSubmit(values.serviceId, values.customerName);
    if (!isSubmitting) { // Only close if submission wasn't interrupted by an error state handled by parent
        onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md rounded-lg">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-2xl font-bold">Add Walk-In Appointment</DialogTitle>
          <DialogDescription className="text-sm text-gray-500 pt-1">
            Select a service and enter the customer's name. The system will find the next available time slot.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 px-6 pb-6">
            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Service</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                    <FormControl>
                      <SelectTrigger className="h-11 text-base">
                        <SelectValue placeholder="Select a service" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services.map(service => (
                        <SelectItem key={service.id} value={service.id} className="text-base">
                          {service.name} ({service.duration} min) - ${service.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Customer Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., John Doe" {...field} disabled={isSubmitting} className="h-11 text-base" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="rounded-full h-11 px-6 text-base" disabled={isSubmitting} onClick={onClose}>Cancel</Button>
              </DialogClose>
              <Button type="submit" className="rounded-full h-11 px-6 text-base" disabled={isSubmitting || services.length === 0}>
                {isSubmitting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
                {isSubmitting ? 'Adding...' : 'Add Walk-In'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
