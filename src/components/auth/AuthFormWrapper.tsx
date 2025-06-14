
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarberFlowLogo } from '@/components/icons/BarberFlowLogo';
import type { UserRole } from '@/types';

interface AuthFormWrapperProps {
  title: string;
  description: string;
  role?: UserRole;
  children: ReactNode;
  footerLink?: { href: string; text: string; label: string };
}

export default function AuthFormWrapper({ title, description, role, children, footerLink }: AuthFormWrapperProps) {
  const roleText = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-xl border-none rounded-xl">
        <CardHeader className="text-center p-6 md:p-8">
          <Link href="/" aria-label="Go to homepage" className="mx-auto mb-6 flex justify-center">
            <BarberFlowLogo className="h-10 w-auto" />
          </Link>
          <CardTitle className="font-headline text-xl sm:text-2xl font-bold">{title} {roleText}</CardTitle>
          <CardDescription className="text-sm sm:text-base text-gray-500 pt-2">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 md:px-8 md:pb-8">
          {children}
        </CardContent>
      </Card>
      {footerLink && (
         <p className="mt-6 text-center text-sm text-gray-500 px-4">
          {footerLink.label}{' '}
          <Link href={footerLink.href} className="font-medium text-primary hover:underline">
            {footerLink.text}
          </Link>
        </p>
      )}
    </div>
  );
}
