/**
 * @fileoverview ThemeProvider component.
 * This component wraps the application and provides theme (light/dark mode)
 * context and functionality using the `next-themes` library.
 */
'use client';

import type { ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes'; // The actual provider from next-themes.
import type { ThemeProviderProps } from 'next-themes/dist/types'; // Type definition for props.

/**
 * ThemeProvider component.
 * A wrapper around `NextThemesProvider` from the `next-themes` library.
 * It enables theme switching (e.g., light, dark, system) for the application.
 *
 * @param {ThemeProviderProps} props - Props to be passed to `NextThemesProvider`.
 *                                     Typically includes `children`, `attribute`, `defaultTheme`, etc.
 * @returns {JSX.Element} The `NextThemesProvider` wrapping its children.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Delegates all functionality to the NextThemesProvider.
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
