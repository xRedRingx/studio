/**
 * @fileoverview Utility functions.
 * This file contains general utility functions used across the application.
 * Currently, it includes `cn`, a helper for conditionally joining class names,
 * commonly used with Tailwind CSS and ShadCN UI.
 */
import { clsx, type ClassValue } from "clsx" // `clsx` is a utility for constructing className strings conditionally.
import { twMerge } from "tailwind-merge" // `tailwind-merge` merges Tailwind CSS classes without style conflicts.

/**
 * Combines multiple class names into a single string, resolving Tailwind CSS conflicts.
 *
 * This function uses `clsx` to conditionally join class names and then `tailwind-merge`
 * to intelligently merge Tailwind CSS utility classes, ensuring that conflicting utilities
 * are resolved correctly (e.g., `p-2 p-4` becomes `p-4`).
 *
 * @param {...ClassValue[]} inputs - A list of class values. These can be strings, objects, or arrays.
 *                                   Falsy values are ignored.
 * @returns {string} A single string of combined and merged class names.
 *
 * @example
 * cn("p-4", "font-bold", { "bg-red-500": isError }, isActive && "text-blue-500");
 * // If isError is true and isActive is true, might return: "p-4 font-bold bg-red-500 text-blue-500"
 *
 * cn("px-2 py-1", "p-4"); // Returns "p-4" (tailwind-merge resolves conflicts)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
