'use client';

import { WifiOff } from 'lucide-react';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';

export default function OfflineIndicator() {
  const isOffline = useOfflineStatus();

  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed bottom-0 left-0 right-0 z-[200] flex items-center justify-center space-x-2 bg-destructive p-3 text-destructive-foreground shadow-lg md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:rounded-lg md:px-6 md:py-3 w-full md:w-auto"
    >
      <WifiOff className="h-5 w-5" />
      <p className="text-sm font-medium">You are currently offline. Some features may be unavailable.</p>
    </div>
  );
}
