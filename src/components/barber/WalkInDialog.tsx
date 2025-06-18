/**
 * @fileoverview WalkInDialog component.
 * This component provides a dialog (modal) for barbers to add a walk-in appointment.
 * It includes fields to select a service and enter the customer's name.
 * The system will attempt to find the next available time slot for the walk-in.
 * Uses `react-hook-form` for form handling and Zod for validation.
 */
'use client';

import { zodResolver } from '@hookform/resolvers/zod'; // Resolver for Zod schema validation.
import { useForm } from 'react-hook-form'; // Hook for form handling.
import * as z from 'zod'; // Zod library for schema declaration and validation.
import { Button } from '@/components/ui/button'; // Button UI component.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose, // Used for the "Cancel" button.
} from '@/components/ui/dialog'; // Dialog UI components.
import { Input } from '@/components/ui/input'; // Input UI component.
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Form UI components.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Select dropdown UI components.
import type { BarberService } from '@/types'; // Type definition for a barber service.
import { useEffect } from 'react'; // React hook for side effects.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.

// Zod schema for validating walk-in form inputs.
const walkInSchema = z.object({
  serviceId: z.string().min(1, 'Please select a service.'), // Service must be selected.
  customerName: z.string().min(1, 'Customer name is required').max(100, 'Customer name is too long'),
});

type WalkInFormValues = z.infer<typeof walkInSchema>; // Type inferred from the Zod schema.

/**
 * Props for the WalkInDialog component.
 * @interface WalkInDialogProps
 * @property {boolean} isOpen - Controls the visibility of the dialog.
 * @property {() => void} onClose - Callback function to close the dialog.
 * @property {(serviceId: string, customerName: string) => Promise<void>} onSubmit - Callback function to handle form submission.
 * @property {BarberService[]} services - List of available services for the barber.
 * @property {boolean} isSubmitting - True if the form submission is currently in progress.
 */
interface WalkInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (serviceId: string, customerName: string) => Promise<void>;
  services: BarberService[];
  isSubmitting: boolean;
}

/**
 * WalkInDialog component.
 * Renders a dialog for adding a walk-in appointment.
 *
 * @param {WalkInDialogProps} props - The component's props.
 * @returns {JSX.Element | null} The rendered dialog or null if not open.
 */
export default function WalkInDialog({ isOpen, onClose, onSubmit, services, isSubmitting }: WalkInDialogProps) {
  // Initialize react-hook-form with Zod resolver and default values.
  const form = useForm<WalkInFormValues>({
    resolver: zodResolver(walkInSchema),
    defaultValues: {
      serviceId: '',
      customerName: '',
    },
  });

  // Effect to reset form fields when the dialog opens.
  useEffect(() => {
    if (isOpen) {
      form.reset({ serviceId: '', customerName: '' });
    }
  }, [form, isOpen]); // Dependencies for the effect.

  /**
   * Handles the form submission. Calls the `onSubmit` prop with form values.
   * Closes the dialog if the submission process (handled by parent) doesn't set `isSubmitting`
   * to true due to an error before calling `onSubmit` or if `onSubmit` completes successfully.
   * @param {WalkInFormValues} values - The validated form values.
   */
  const handleSubmit = async (values: WalkInFormValues) => {
    await onSubmit(values.serviceId, values.customerName);
    // Only close the dialog if the `isSubmitting` prop (controlled by the parent)
    // is not true, indicating the parent hasn't encountered an error that keeps it submitting
    // or the submission completed and parent cleared `isSubmitting`.
    if (!isSubmitting) {
        onClose();
    }
  };

  // Do not render the dialog if it's not open.
  if (!isOpen) return null;

  return (
    // Dialog component from ShadCN UI.
    // `onOpenChange` is used to handle closing the dialog via escape key or overlay click.
    // Prevents closing if `isSubmitting` is true.
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md rounded-lg"> {/* Dialog content container. */}
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-2xl font-bold">Add Walk-In Appointment</DialogTitle>
          <DialogDescription className="text-sm text-gray-500 pt-1">
            Select a service and enter the customer's name. The system will find the next available time slot.
          </DialogDescription>
        </DialogHeader>
        {/* Form for walk-in details. */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 px-6 pb-6">
            {/* Service Selection Field */}
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
                      {/* Populate select items with available services. */}
                      {services.map(service => (
                        <SelectItem key={service.id} value={service.id} className="text-base">
                          {service.name} ({service.duration} min) - ${service.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage /> {/* Displays validation errors. */}
                </FormItem>
              )}
            />
            {/* Customer Name Field */}
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
            {/* Dialog Footer with action buttons. */}
            <DialogFooter className="pt-4">
              {/* Cancel Button */}
              <DialogClose asChild>
                <Button type="button" variant="outline" className="rounded-full h-11 px-6 text-base" disabled={isSubmitting} onClick={onClose}>Cancel</Button>
              </DialogClose>
              {/* Submit Button (Add Walk-In) */}
              <Button type="submit" className="rounded-full h-11 px-6 text-base" disabled={isSubmitting || services.length === 0}>
                {isSubmitting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null} {/* Show spinner if submitting. */}
                {isSubmitting ? 'Adding...' : 'Add Walk-In'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
