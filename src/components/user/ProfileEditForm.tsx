
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Schema without profileImage field
const profileEditSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  email: z.string().email("Invalid email address").optional(), // Email is display-only
  phoneNumber: z.string().regex(/^(\+[1-9]\d{1,14})?$/, "Phone number must be in E.164 format (e.g., +12223334444) or empty").optional().or(z.literal('')),
  address: z.string().max(100, "Address must be less than 100 characters").optional().or(z.literal('')),
});

type ProfileEditFormValues = z.infer<typeof profileEditSchema>;

interface ProfileEditFormProps {
  currentUser: AppUser;
  onSubmit: (
    data: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address'>>
    // photoFile parameter removed
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
    // Reset form if currentUser changes
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
    onSubmit(dataToSubmit); // photoFile argument removed
  };
  
  const getInitials = (firstName?: string | null, lastName?: string | null, email?: string | null) => {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
    if (firstName) return firstName.substring(0, 2).toUpperCase();
    if (email) return email.substring(0, 2).toUpperCase();
    return "U";
  };

  return (
    <Card className="border-none shadow-lg rounded-xl overflow-hidden">
        <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-xl font-bold">Your Information</CardTitle>
            <CardDescription className="text-sm text-gray-500">Update your personal details. Email address and profile picture are managed via your authentication provider (e.g., Google) or Firebase Console.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
            <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                
                <div className="flex flex-col items-center sm:items-start mb-6">
                    <FormLabel className="text-base mb-2 self-start">Profile Picture</FormLabel>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-2 border-primary/30">
                            <AvatarImage 
                                src={currentUser.photoURL || `https://placehold.co/128x128.png`} 
                                alt="Profile Preview" 
                                data-ai-hint={!currentUser.photoURL ? "avatar person" : undefined}
                                className="object-cover"
                            />
                            <AvatarFallback className="text-3xl">
                                {getInitials(currentUser.firstName, currentUser.lastName, currentUser.email)}
                            </AvatarFallback>
                        </Avatar>
                         <p className="text-xs text-gray-500 mt-1 sm:mt-0 sm:ml-2">
                            To change your profile picture, please update it with your authentication provider (e.g., Google account settings) or contact support.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-base">First Name</FormLabel>
                        <FormControl>
                        <Input placeholder="Enter first name" {...field} className="text-base h-12" autoComplete="given-name" disabled={isSubmitting} />
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
                        <Input placeholder="Enter last name" {...field} className="text-base h-12" autoComplete="family-name" disabled={isSubmitting} />
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
                        <FormLabel className="text-base">Email Address (Cannot Change)</FormLabel>
                        <FormControl>
                            <Input type="email" {...field} className="text-base h-12 bg-muted/50" disabled={true} />
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
                    <FormLabel className="text-base">Phone Number</FormLabel>
                    <FormControl>
                        <Input type="tel" placeholder="e.g. +14155552671 (Optional)" {...field} className="text-base h-12" autoComplete="tel" inputMode="tel" disabled={isSubmitting} />
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
                    <FormLabel className="text-base">Address (Optional for Customers)</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g. 123 Main St, Anytown" {...field} className="text-base h-12" autoComplete="street-address" disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit" className="w-full sm:w-auto h-12 rounded-full text-base px-8 mt-4" disabled={isSubmitting}>
                {isSubmitting && <LoadingSpinner className="mr-2 h-5 w-5" />}
                {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
                </Button>
            </form>
            </Form>
        </CardContent>
    </Card>
  );
}

    