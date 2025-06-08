import type { ReactNode } from 'react';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { Button } from '@/components/ui/button';
import { BarberFlowLogo } from '@/components/icons/BarberFlowLogo';
import UserNav from '@/components/layout/UserNav'; // Placeholder for user navigation/logout

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedPage>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between">
            <BarberFlowLogo />
            <UserNav />
          </div>
        </header>
        <main className="flex-1 container py-8">
          {children}
        </main>
        <footer className="py-6 md:px-8 md:py-0 border-t bg-background">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-20 md:flex-row">
                <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
                    Built for BarberFlow.
                </p>
            </div>
        </footer>
      </div>
    </ProtectedPage>
  );
}
