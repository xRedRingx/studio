/**
 * @fileoverview Layout for protected (authenticated) pages.
 * This component wraps all pages that require a user to be logged in.
 * It provides a consistent header with the application logo, theme toggle,
 * and user navigation menu, as well as a footer.
 * It utilizes the `ProtectedPage` component to enforce authentication.
 */
import type { ReactNode } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage'; // Component to guard routes.
import { BarberFlowLogo } from '@/components/icons/BarberFlowLogo'; // Application logo component.
import UserNav from '@/components/layout/UserNav'; // User navigation dropdown menu.
import { ThemeToggle } from '@/components/layout/ThemeToggle'; // Theme (light/dark) toggle button.

/**
 * ProtectedLayout component.
 *
 * @param {object} props - The component's props.
 * @param {ReactNode} props.children - The child components to be rendered within this layout.
 * @returns {JSX.Element} The rendered layout for protected pages.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    // ProtectedPage ensures that only authenticated users can access the children routes.
    // If a specific role is required for all protected routes, it could be passed here,
    // but typically it's handled by individual page components or sub-layouts.
    <ProtectedPage>
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-muted/5 to-background">
        {/* Header section: sticky, with background blur for a modern look. */}
        <header className="sticky top-0 z-50 w-full border-b border-foreground/10 bg-gradient-to-b from-background/90 via-background/80 to-background/70 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70">
          <div className="container flex h-16 items-center justify-between px-4 md:px-6">
            {/* Application Logo */}
            <BarberFlowLogo />
            {/* Right-aligned header items: Theme Toggle and User Navigation */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserNav />
            </div>
          </div>
        </header>
        {/* Main content area where page-specific content will be rendered. */}
        <main className="flex-1 container py-6 md:py-8 px-4 md:px-6">
          {children}
        </main>
        {/* Footer section. */}
        <footer className="py-6 border-t bg-gradient-to-t from-background/90 via-background/80 to-background/70 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70">
            <div className="container flex flex-col items-center justify-center gap-4 md:h-20 md:flex-row px-4 md:px-6">
                <p className="text-balance text-center text-sm text-gray-500 dark:text-gray-400 md:text-left">
                    Built for BarberFlow. &copy; {new Date().getFullYear()}
                </p>
            </div>
        </footer>
      </div>
    </ProtectedPage>
  );
}
