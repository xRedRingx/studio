/**
 * @fileoverview useIsMobile hook.
 * A custom React hook to determine if the current viewport width
 * is below a defined mobile breakpoint (768px).
 * It uses `window.matchMedia` for efficient listening to viewport size changes.
 */
import * as React from "react"

// Defines the breakpoint (in pixels) for considering the viewport as mobile.
const MOBILE_BREAKPOINT = 768

/**
 * Custom hook `useIsMobile`.
 * Detects if the current browser viewport width is considered "mobile".
 *
 * @returns {boolean} `true` if the viewport width is less than `MOBILE_BREAKPOINT`,
 *                    `false` otherwise. Returns `undefined` during initial server-side
 *                    rendering or before the effect runs.
 */
export function useIsMobile() {
  // State to store whether the viewport is mobile. `undefined` initially.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // `window.matchMedia` is used to check if the viewport matches the media query.
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

    // Callback function to update `isMobile` state when the media query match status changes.
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    // Add event listener for changes in the media query match status.
    mql.addEventListener("change", onChange)

    // Set the initial state based on the current viewport width.
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)

    // Cleanup function: remove the event listener when the component unmounts.
    return () => mql.removeEventListener("change", onChange)
  }, []) // Empty dependency array ensures this effect runs only once on mount and cleans up on unmount.

  // Return the boolean value of `isMobile`.
  // `!!isMobile` converts `undefined` to `false` if it hasn't been set yet,
  // ensuring a boolean return type as expected by consumers of this hook.
  return !!isMobile
}
