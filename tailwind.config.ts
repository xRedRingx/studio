/**
 * @fileoverview Tailwind CSS Configuration for the BarberFlow application.
 * This file configures various aspects of Tailwind CSS, including:
 * - Dark mode strategy.
 * - Content paths for Tailwind to scan for class names.
 * - Theme extensions (custom fonts, colors, border radius).
 * - Keyframe animations for custom animations (e.g., accordion).
 * - Tailwind CSS plugins.
 */
import type {Config} from 'tailwindcss'; // Type definition for Tailwind CSS config.

export default {
  // Dark mode strategy: uses a 'class' on the HTML element (e.g., <html class="dark">).
  darkMode: ['class'],
  // Paths to files that Tailwind should scan to find utility classes being used.
  // This helps Tailwind purge unused styles in production builds.
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}', // Scans files in the 'pages' directory.
    './src/components/**/*.{js,ts,jsx,tsx,mdx}', // Scans files in the 'components' directory.
    './src/app/**/*.{js,ts,jsx,tsx,mdx}', // Scans files in the 'app' directory (Next.js App Router).
  ],
  // Theme configuration.
  theme: {
    extend: { // Allows extending the default Tailwind theme.
      // Custom font families defined using CSS variables (set in globals.css via next/font).
      fontFamily: {
        body: ['var(--font-pt-sans)', 'sans-serif'], // Default body font.
        headline: ['var(--font-pt-sans)', 'sans-serif'], // Font for headlines (same as body here).
        code: ['var(--font-source-code-pro)', 'monospace'], // Font for code blocks.
      },
      // Custom color palette defined using HSL CSS variables (from globals.css).
      // This enables easy theming (light/dark modes).
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))', // Focus ring color.
        // Chart colors (defined in globals.css, for potential future use).
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        // Sidebar specific colors (defined in globals.css, for potential future use with a distinct sidebar theme).
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      // Custom border radius values, based on a CSS variable `--radius` (defined in globals.css).
      borderRadius: {
        lg: 'var(--radius)', // Large border radius.
        md: 'calc(var(--radius) - 2px)', // Medium border radius.
        sm: 'calc(var(--radius) - 4px)', // Small border radius.
      },
      // Custom keyframe animations.
      keyframes: {
        'accordion-down': { // Animation for accordion opening.
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)', // Uses Radix UI CSS variable.
          },
        },
        'accordion-up': { // Animation for accordion closing.
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      // Custom animation utilities using the defined keyframes.
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  // Tailwind CSS plugins.
  plugins: [
    require('tailwindcss-animate'), // Plugin for adding enter/exit animations (used by ShadCN UI).
  ],
} satisfies Config; // `satisfies Config` provides TypeScript type checking for the config object.
