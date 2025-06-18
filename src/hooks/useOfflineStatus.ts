/**
 * @fileoverview useOfflineStatus hook.
 * A custom React hook to detect and monitor the application's online/offline status.
 * It uses browser events (`online`, `offline`) and `navigator.onLine` for this purpose.
 */
'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook `useOfflineStatus`.
 * Tracks the browser's online/offline status.
 *
 * @returns {boolean} `true` if the application is currently offline, `false` otherwise.
 */
export function useOfflineStatus() {
  // State to store the offline status. Initialized to false (assuming online).
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check initial status when the component mounts (client-side only).
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine); // `navigator.onLine` is true if online, false if offline.
    }

    // Event handler for when the browser goes online.
    const handleOnline = () => setIsOffline(false);
    // Event handler for when the browser goes offline.
    const handleOffline = () => setIsOffline(true);

    // Add event listeners for 'online' and 'offline' events.
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup function: remove event listeners when the component unmounts.
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount and cleans up on unmount.

  return isOffline; // Return the current offline status.
}
