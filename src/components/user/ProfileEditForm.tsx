/**
 * @fileoverview ProfileEditForm component.
 * This component provides a form for users to edit their profile information.
 * It includes fields for first name, last name, phone number, and address.
 * For users with the 'barber' role, it also includes fields for bio and specialties.
 * The email address is displayed but is not editable.
 * Form handling and validation are done using `react-hook-form` and Zod.
 */
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form'; // Hook for form handling and validation.
import { zodResolver } from '@hookform/resolvers/zod'; // Resolver for Zod schema validation.
import * as z from 'zod'; // Zod library for schema declaration.
import { Button } from '@/components/ui/button'; // Button UI component.
import { Input } from '@/components/ui/input'; // Input UI component.
import { Textarea } from '@/components/ui/textarea'; // Textarea UI component for bio.
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Form UI components.
import type { AppUser } from '@/types'; // Type definition for user data.
import LoadingSpinner from '@/components/ui/loading-spinner'; // Loading spinner UI.
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; // Card UI components for layout.
import { UserCircle, Briefcase, Info } from 'lucide-react'; // Icons for visual cues.

// Zod schema for profile edit form validation.
const profileEditSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  email: z.string().email("Invalid email address").optional(), // Email is displayed but not submitted for update.
  // Phone number is optional but must match E.164 format if provided, or be an empty string.
  phoneNumber: z.string().regex(/^(\+[1-9]\d{1,14})?$/, "Phone number must be in E.164 format (e.g., +12223334444) or empty").optional().or(z.literal('')),
  address: z.string().max(100, "Address must be less than 100 characters").optional().or(z.literal('')),
  // Barber-specific fields: bio and specialties.
  bio: z.string().max(500, "Bio must be less than 500 characters").optional().or(z.literal('')),
  // Specialties are entered as a comma-separated string in the form, then converted to an array.
  specialties: z.string().max(200, "Specialties list is too long").optional().or(z.literal('')),
});

type ProfileEditFormValues = z.infer<typeof profileEditSchema>; // Type inferred from the Zod schema.

/**
 * Props for the ProfileEditForm component.
 * @interface ProfileEditFormProps
 * @property {AppUser} currentUser - The current user's data to prefill the form.
 * @property {(data: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address' | 'bio' | 'specialties'>>) => Promise<void>} onSubmit - Callback function to handle form submission with updated profile data.
 * @property {boolean} isSubmitting - True if the form submission is currently in progress.
 */
interface ProfileEditFormProps {
  currentUser: AppUser;
  onSubmit: (
    data: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address' | 'bio' | 'specialties'>>
  ) => Promise<void>;
  isSubmitting: boolean;
}

/**
 * ProfileEditForm component.
 * Renders a form for editing user profile information.
 *
 * @param {ProfileEditFormProps} props - The component's props.
 * @returns {JSX.Element} The rendered profile edit form.
 */
export default function ProfileEditForm({ currentUser, onSubmit, isSubmitting }: ProfileEditFormProps) {
  // Initialize react-hook-form with Zod resolver and default values from `currentUser`.
  const form = useForm<ProfileEditFormValues>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      firstName: currentUser.firstName || '',
      lastName: currentUser.lastName || '',
      email: currentUser.email || '', // Email is for display only.
      phoneNumber: currentUser.phoneNumber || '',
      address: currentUser.address || '',
      bio: currentUser.bio || '',
      // Join specialties array into a comma-separated string for the input field.
      specialties: currentUser.specialties?.join(', ') || '',
    },
  });

  // Effect to reset the form with `currentUser` data if it changes.
  // This ensures the form stays in sync if `currentUser` prop updates from parent.
  useEffect(() => {
    form.reset({
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        email: currentUser.email || '',
        phoneNumber: currentUser.phoneNumber || '',
        address: currentUser.address || '',
        bio: currentUser.bio || '',
        specialties: currentUser.specialties?.join(', ') || '',
    });
  }, [currentUser, form]); // Dependencies for the effect.


  /**
   * Handles the submission of the form.
   * Converts comma-separated specialties string to an array before calling the `onSubmit` prop.
   * @param {ProfileEditFormValues} values - The validated form values.
   */
  const handleFormSubmit = (values: ProfileEditFormValues) => {
    // Convert comma-separated specialties string from form into an array of strings.
    // Trim whitespace and filter out empty strings.
    const specialtiesArray = values.specialties
        ? values.specialties.split(',').map(s => s.trim()).filter(s => s.length > 0)
        : null; // Set to null if specialties string is empty.

    // Prepare data to be submitted, excluding the email field (as it's not editable).
    // Ensure empty strings for optional fields are converted to null for Firestore.
    const dataToSubmit: Partial<Pick<AppUser, 'firstName' | 'lastName' | 'phoneNumber' | 'address' | 'bio' | 'specialties'>> = {
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber || null,
        address: values.address || null,
        bio: values.bio || null,
        specialties: specialtiesArray,
    };
    onSubmit(dataToSubmit); // Call the parent's submit handler.
  };


  return (
    // Card layout for the form.
    <Card className="border-none shadow-lg rounded-xl overflow-hidden">
        <CardHeader className="p-4 md:p-6 bg-muted/30">
            <div className="flex items-center space-x-4">
                <UserCircle className="h-16 w-16 text-muted-foreground" /> {/* User icon. */}
                <div>
                    <CardTitle className="text-xl font-bold">Your Information</CardTitle>
                    <CardDescription className="text-sm text-gray-500 mt-1">Update your personal details. Email address cannot be changed here.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
            {/* Form component integrated with react-hook-form. */}
            <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">

                {/* Grid for First Name and Last Name fields. */}
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
                        <FormMessage /> {/* Displays validation errors. */}
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
                {/* Email Field (Display Only) */}
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-base">Email Address</FormLabel>
                        <FormControl>
                            {/* Email input is disabled and styled to indicate it's not editable. */}
                            <Input type="email" {...field} className="text-base h-12 rounded-md bg-muted/50 cursor-not-allowed" disabled={true} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                {/* Phone Number Field (Optional) */}
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
                {/* Address Field (Optional) */}
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

                {/* Barber-specific fields: Bio and Specialties. */}
                {currentUser.role === 'barber' && (
                    <>
                        {/* Bio Field (Optional, Barber Only) */}
                        <FormField
                            control={form.control}
                            name="bio"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-base flex items-center"><Info className="mr-2 h-4 w-4 text-muted-foreground" /> Bio (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Tell customers a little about yourself and your experience (max 500 characters)."
                                            className="text-base min-h-[100px] rounded-md"
                                            {...field}
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {/* Specialties Field (Optional, Barber Only) */}
                        <FormField
                            control={form.control}
                            name="specialties"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-base flex items-center"><Briefcase className="mr-2 h-4 w-4 text-muted-foreground" /> Specialties (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., Fades, Beard Trims, Hot Towel Shaves"
                                            {...field}
                                            className="text-base h-12 rounded-md"
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <p className="text-xs text-muted-foreground mt-1">Enter as a comma-separated list.</p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </>
                )}

                {/* Submit Button */}
                <div className="pt-2">
                  <Button type="submit" className="w-full sm:w-auto h-12 rounded-full text-base px-8" disabled={isSubmitting}>
                  {isSubmitting && <LoadingSpinner className="mr-2 h-5 w-5" />} {/* Show spinner if submitting. */}
                  {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
                  </Button>
                </div>
            </form>
            </Form>
        </CardContent>
    </Card>
  );
}
