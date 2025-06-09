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
      <Card className="w-full max-w-md shadow-xl border-none"> {/* Removed border for flatter look if card bg matches page bg */}
        <CardHeader className="text-center p-6">
          <Link href="/" aria-label="Go to homepage" className="mx-auto mb-6 flex justify-center">
            <BarberFlowLogo className="h-10 w-auto" />
          </Link>
          <CardTitle className="font-headline text-2xl font-bold">{title} {roleText}</CardTitle>
          <CardDescription className="text-sm text-gray-500 pt-2">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          {children}
        </CardContent>
      </Card>
      {footerLink && (
         <p className="mt-8 text-center text-sm text-gray-500">
          {footerLink.label}{' '}
          <Link href={footerLink.href} className="font-medium text-primary hover:underline">
            {footerLink.text}
          </Link>
        </p>
      )}
    </div>
  );
}
