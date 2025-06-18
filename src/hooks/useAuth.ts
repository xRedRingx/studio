/**
 * @fileoverview Re-exports the `useAuth` hook from the AuthContext.
 * This file serves as a conventional entry point for accessing the authentication hook,
 * aligning with the project's `hooks` directory structure.
 * All authentication logic and context are managed within `AuthContext.tsx`.
 */
// This file can be removed if useAuth is directly exported from AuthContext.tsx
// For consistency with existing hooks directory, it's kept here.
export { useAuth } from '@/contexts/AuthContext';
