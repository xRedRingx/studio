/**
 * @fileoverview OfflineIndicator component.
 * This component displays a visual indicator (a banner) at the bottom of the screen
 * when the application detects that the user is offline.
 * It uses the `useOfflineStatus` hook to monitor the network connection status.
 */
'use client';

import { WifiOff } from 'lucide-react'; // Icon to indicate offline status.
import { useOfflineStatus } from '@/hooks/useOfflineStatus'; // Custom hook to detect offline status.

/**
 * OfflineIndicator component.
 * Renders a banner when the application is offline.
 *
 * @returns {JSX.Element | null} The offline indicator banner or null if online.
 */
export default function OfflineIndicator() {
  const isOffline = useOfflineStatus(); // Get current offline status from the hook.

  // If the application is online, render nothing.
  if (!isOffline) {
    return null;
  }

  // If offline, render the indicator banner.
  return (
    <div
      role="status" // ARIA role for status messages.
      aria-live="assertive" // ARIA live region to announce changes assertively.
      // Styling for the banner: fixed position, destructive background, text color, shadow.
      // Adapts for mobile (full width bottom) and desktop (centered bottom).
      className="fixed bottom-0 left-0 right-0 z-[200] flex items-center justify-center space-x-2 bg-destructive p-3 text-destructive-foreground shadow-lg md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:rounded-lg md:px-6 md:py-3 w-full md:w-auto"
    >
      <WifiOff className="h-5 w-5" /> {/* Offline icon. */}
      <p className="text-sm font-medium">You are currently offline. Some features may be unavailable.</p>
    </div>
  );
}
