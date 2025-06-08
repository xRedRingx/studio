
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import OfflineIndicator from '@/components/layout/OfflineIndicator';
import { APP_NAME } from '@/lib/constants';
import Script from 'next/script';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Seamlessly connect barbers and customers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;700&display=swap" rel="stylesheet" />
        {/* reCAPTCHA script - using your provided key. Ensure this is the correct one for your Firebase Phone Auth setup. */}
        <Script src="https://www.google.com/recaptcha/api.js" strategy="beforeInteractive" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <AuthProvider>
          <OfflineIndicator />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
