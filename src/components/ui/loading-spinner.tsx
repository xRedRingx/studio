/**
 * @fileoverview LoadingSpinner component.
 * A simple SVG-based animated loading spinner.
 * It can be customized with a `className` prop.
 */
import { cn } from "@/lib/utils"; // Utility for conditional class names.
import type { SVGProps } from 'react'; // Type for SVG element props.

/**
 * LoadingSpinner component.
 * Renders an SVG spinner that animates to indicate a loading state.
 *
 * @param {SVGProps<SVGSVGElement>} props - SVG props, including `className` for custom styling.
 * @returns {JSX.Element} The rendered SVG loading spinner.
 */
export default function LoadingSpinner({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    // SVG element for the spinner.
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24" // Default width.
      height="24" // Default height.
      viewBox="0 0 24 24" // SVG coordinate system.
      fill="none" // No fill for the paths.
      stroke="currentColor" // Stroke color inherits from text color by default.
      strokeWidth="2" // Stroke width for the spinner path.
      strokeLinecap="round" // Rounded line caps.
      strokeLinejoin="round" // Rounded line joins.
      // Apply Tailwind's `animate-spin` class and any custom classes.
      className={cn("animate-spin", className)}
      {...props} // Spread other SVG props.
    >
      {/* The path that creates the spinning circle segment. */}
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
