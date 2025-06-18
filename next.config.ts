/** @type {import('next').NextConfig} */
import type {NextConfig} from 'next';

// Configuration options for the Next.js application.
const nextConfig: NextConfig = {
  /* config options here */

  // TypeScript-specific configurations.
  typescript: {
    // If true, Next.js will ignore TypeScript errors during the build process.
    // Useful for temporarily bypassing type errors, but not recommended for production.
    ignoreBuildErrors: true,
  },

  // ESLint-specific configurations.
  eslint: {
    // If true, Next.js will ignore ESLint errors during the build process.
    // Useful for temporarily bypassing linting errors, but not recommended for production.
    ignoreDuringBuilds: true,
  },

  // Configuration for the Next.js Image component (next/image).
  images: {
    // Defines a list of remote patterns (domains and paths) from which images can be optimized.
    // This is a security measure to prevent arbitrary image optimization from untrusted sources.
    remotePatterns: [
      {
        protocol: 'https', // Allowed protocol.
        hostname: 'placehold.co', // Allowed hostname for placeholder images.
        port: '', // Allowed port (empty means any standard port for the protocol).
        pathname: '/**', // Allowed path pattern (double asterisk means any path).
      },
    ],
  },
};

export default nextConfig;
