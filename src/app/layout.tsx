/**
 * @fileoverview Root layout for the entire application.
 * This component wraps all pages and provides global context providers,
 * global styles, font definitions, and metadata for the HTML document.
 */
import type { Metadata } from 'next'; // Type for Next.js metadata.
import './globals.css'; // Imports global CSS styles.
import { AuthProvider } from '@/contexts/AuthContext'; // Authentication context provider.
import { Toaster } from '@/components/ui/toaster'; // Component for displaying toast notifications.
import OfflineIndicator from '@/components/layout/OfflineIndicator'; // UI component to indicate offline status.
import { APP_NAME } from '@/lib/constants'; // Application constants, like the app name.
import { ThemeProvider } from '@/components/layout/ThemeProvider'; // Provider for theme (light/dark) management.
import { PT_Sans, Source_Code_Pro } from 'next/font/google'; // Google Fonts for the application.

// Configure PT Sans font for body and headlines.
const ptSans = PT_Sans({
  subsets: ['latin'], // Specifies character subsets.
  weight: ['400', '700'], // Specifies font weights to load.
  style: ['normal', 'italic'], // Specifies font styles.
  variable: '--font-pt-sans', // CSS variable name for this font.
  display: 'swap', // Font display strategy.
});

// Configure Source Code Pro font for code snippets.
const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal'],
  variable: '--font-source-code-pro',
  display: 'swap',
});

// Metadata for the application, used in the <head> tag.
export const metadata: Metadata = {
  title: APP_NAME, // Application title.
  description: 'Seamlessly connect barbers and customers.', // Application description.
};

/**
 * RootLayout component.
 *
 * @param {object} props - The component's props.
 * @param {React.ReactNode} props.children - The child components (pages) to be rendered within this layout.
 * @returns {JSX.Element} The root HTML structure for the application.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // HTML document structure.
    // `suppressHydrationWarning` is used because next-themes can cause a mismatch during server/client hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme color meta tags for mobile browsers. */}
        <meta name="theme-color" content="#5DADE2" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#27272A" media="(prefers-color-scheme: dark)" />
      </head>
      {/* Apply font variables to the body for global font styling. */}
      {/* `suppressHydrationWarning` for the body as well due to theme changes. */}
      <body className={`${ptSans.variable} ${sourceCodePro.variable} font-body antialiased`} suppressHydrationWarning>
        {/* ThemeProvider enables light/dark mode switching. */}
        <ThemeProvider
          attribute="class" // The HTML attribute to update (e.g., <html class="dark">).
          defaultTheme="system" // Default theme based on user's system preference.
          enableSystem // Allows theme to follow system preference.
          disableTransitionOnChange // Disables theme transition animations to prevent flicker.
        >
          {/* AuthProvider makes authentication state and functions available to the app. */}
          <AuthProvider>
            <OfflineIndicator /> {/* Displays a banner when the app is offline. */}
            {children} {/* Renders the current page content. */}
            <Toaster /> {/* Renders toast notifications globally. */}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
