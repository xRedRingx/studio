
import type { ReactNode } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { BarberFlowLogo } from '@/components/icons/BarberFlowLogo';
import UserNav from '@/components/layout/UserNav';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedPage>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-50 w-full border-b border-foreground/10 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70">
          <div className="container flex h-16 items-center justify-between px-4 md:px-6">
            <BarberFlowLogo />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserNav />
            </div>
          </div>
        </header>
        <main className="flex-1 container py-6 md:py-8 px-4 md:px-6">
          {children}
        </main>
        <footer className="py-6 border-t bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70">
            <div className="container flex flex-col items-center justify-center gap-4 md:h-20 md:flex-row px-4 md:px-6">
                <p className="text-balance text-center text-sm text-gray-500 md:text-left">
                    Built for BarberFlow. &copy; {new Date().getFullYear()}
                </p>
            </div>
        </footer>
      </div>
    </ProtectedPage>
  );
}
