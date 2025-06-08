import type { SVGProps } from 'react';
import { APP_NAME } from '@/lib/constants';

export function BarberFlowLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <div className="flex items-center gap-2" aria-label={`${APP_NAME} Logo`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-8 w-8 text-primary"
        {...props}
      >
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M12 18v-1a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v1" />
        <path d="M16 14h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3H10" />
      </svg>
      <span className="font-headline text-2xl font-bold text-foreground">{APP_NAME}</span>
    </div>
  );
}
