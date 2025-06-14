
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { AppUser } from '@/types';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserCircle } from 'lucide-react';

const profileEditSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  email: z.string().email("Invalid email address").optional(), 
  phoneNumber: z.string().regex(/^(\+[1-9]\d{1,14})?$/, "Phone number must be in E.164 format (e.g., +12223334444) or empty").optional().or(z.literal('')),
  address: z.string().max(100, "Address must be less than 100 characters").optional().or(z.literal('')),
});

type ProfileEditFormValues = z.infer<typeof profileEditSchema>;

interface ProfileEditFormProps {
  currentUser: AppUser;
  onSubmit: (
    data: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address'>>
  ) => Promise<void>;
  isSubmitting: boolean;
}

export default function ProfileEditForm({ currentUser, onSubmit, isSubmitting }: ProfileEditFormProps) {
  const form = useForm<ProfileEditFormValues>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      firstName: currentUser.firstName || '',
      lastName: currentUser.lastName || '',
      email: currentUser.email || '',
      phoneNumber: currentUser.phoneNumber || '',
      address: currentUser.address || '',
    },
  });

  useEffect(() => {
    form.reset({
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        email: currentUser.email || '',
        phoneNumber: currentUser.phoneNumber || '',
        address: currentUser.address || '',
    });
  }, [currentUser, form]);


  const handleFormSubmit = (values: ProfileEditFormValues) => {
    const dataToSubmit: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address'>> = {
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber || null,
        address: values.address || null,
    };
    onSubmit(dataToSubmit);
  };
  

  return (
    <Card className="border-none shadow-lg rounded-xl overflow-hidden">
        <CardHeader className="p-4 md:p-6 bg-muted/30">
            <div className="flex items-center space-x-4">
                <UserCircle className="h-16 w-16 text-muted-foreground" />
                <div>
                    <CardTitle className="text-xl font-bold">Your Information</CardTitle>
                    <CardDescription className="text-sm text-gray-500 mt-1">Update your personal details. Email address cannot be changed here.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
            <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-base">First Name</FormLabel>
                        <FormControl>
                        <Input placeholder="Enter first name" {...field} className="text-base h-12 rounded-md" autoComplete="given-name" disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-base">Last Name</FormLabel>
                        <FormControl>
                        <Input placeholder="Enter last name" {...field} className="text-base h-12 rounded-md" autoComplete="family-name" disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                </div>
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-base">Email Address</FormLabel>
                        <FormControl>
                            <Input type="email" {...field} className="text-base h-12 rounded-md bg-muted/50 cursor-not-allowed" disabled={true} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="text-base">Phone Number (Optional)</FormLabel>
                    <FormControl>
                        <Input type="tel" placeholder="e.g. +14155552671" {...field} className="text-base h-12 rounded-md" autoComplete="tel" inputMode="tel" disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="text-base">Address (Optional)</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g. 123 Main St, Anytown" {...field} className="text-base h-12 rounded-md" autoComplete="street-address" disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <div className="pt-2">
                  <Button type="submit" className="w-full sm:w-auto h-12 rounded-full text-base px-8" disabled={isSubmitting}>
                  {isSubmitting && <LoadingSpinner className="mr-2 h-5 w-5" />}
                  {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
                  </Button>
                </div>
            </form>
            </Form>
        </CardContent>
    </Card>
  );
}
