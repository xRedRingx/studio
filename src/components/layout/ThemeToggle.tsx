/**
 * @fileoverview ThemeToggle component.
 * This component provides a UI element (a dropdown menu with a button)
 * for users to switch between light, dark, and system themes.
 * It utilizes the `useTheme` hook from `next-themes` to manage theme state.
 */
'use client';

import { Moon, Sun } from 'lucide-react'; // Icons for light and dark modes.
import { useTheme } from 'next-themes'; // Hook from next-themes to access and set theme.

import { Button } from '@/components/ui/button'; // Button UI component.
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'; // Dropdown menu UI components.

/**
 * ThemeToggle component.
 * Renders a button that opens a dropdown menu to select the application theme.
 *
 * @returns {JSX.Element} The rendered theme toggle button and dropdown.
 */
export function ThemeToggle() {
  const { setTheme } = useTheme(); // Get the setTheme function from next-themes.

  return (
    <DropdownMenu>
      {/* The button that triggers the dropdown menu. */}
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
          {/* Sun icon, visible in light mode. Rotates and scales out in dark mode. */}
          <Sun className="h-[1.4rem] w-[1.4rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          {/* Moon icon, visible in dark mode. Rotates and scales in from zero in dark mode. */}
          <Moon className="absolute h-[1.4rem] w-[1.4rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span> {/* Accessibility text. */}
        </Button>
      </DropdownMenuTrigger>
      {/* The content of the dropdown menu. */}
      <DropdownMenuContent align="end" className="rounded-lg shadow-xl mt-1">
        {/* Menu item to set the theme to light. */}
        <DropdownMenuItem onClick={() => setTheme('light')} className="text-base py-2.5 px-3 cursor-pointer">
          Light
        </DropdownMenuItem>
        {/* Menu item to set the theme to dark. */}
        <DropdownMenuItem onClick={() => setTheme('dark')} className="text-base py-2.5 px-3 cursor-pointer">
          Dark
        </DropdownMenuItem>
        {/* Menu item to set the theme based on system preference. */}
        <DropdownMenuItem onClick={() => setTheme('system')} className="text-base py-2.5 px-3 cursor-pointer">
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
