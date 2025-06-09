
import type { SVGProps } from 'react';
import { Scissors } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function BarberFlowLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <div className="flex items-center gap-2" aria-label={`${APP_NAME} Logo`}>
      <Scissors
        className={cn("h-8 w-8 text-primary", props.className)}
        strokeWidth={props.strokeWidth}
        aria-hidden="true" // Added for accessibility as the div has aria-label
      />
      <span className="font-headline text-2xl font-bold text-foreground">{APP_NAME}</span>
    </div>
  );
}
