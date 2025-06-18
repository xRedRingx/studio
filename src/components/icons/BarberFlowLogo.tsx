/**
 * @fileoverview BarberFlowLogo component.
 * This component renders the application's logo, which consists of a
 * scissors icon (from lucide-react) and the application name.
 * It accepts SVGProps to allow customization of the icon's appearance.
 */
import type { SVGProps } from 'react';
import { Scissors } from 'lucide-react'; // Scissors icon component.
import { APP_NAME } from '@/lib/constants'; // Application name constant.
import { cn } from '@/lib/utils'; // Utility for conditional class names.

/**
 * BarberFlowLogo component.
 * Displays the application logo.
 *
 * @param {SVGProps<SVGSVGElement>} props - SVG props to be passed to the Scissors icon,
 *                                         allowing customization like className, strokeWidth, etc.
 * @returns {JSX.Element} The rendered logo.
 */
export function BarberFlowLogo(props: SVGProps<SVGSVGElement>) {
  return (
    // Flex container for the icon and text.
    <div className="flex items-center gap-2" aria-label={`${APP_NAME} Logo`}>
      {/* Scissors Icon */}
      <Scissors
        // Apply default classes and any passed className prop.
        className={cn("h-8 w-8 text-primary", props.className)}
        // Pass through other SVG props like strokeWidth.
        strokeWidth={props.strokeWidth}
        aria-hidden="true" // Icon is decorative as the parent div has an aria-label.
      />
      {/* Application Name Text */}
      <span className="font-headline text-2xl font-bold text-foreground">{APP_NAME}</span>
    </div>
  );
}
