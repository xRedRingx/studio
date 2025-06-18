/**
 * @fileoverview useToast hook and toast function.
 * This module provides a custom hook (`useToast`) and a utility function (`toast`)
 * for managing and displaying toast notifications in the application.
 * It's inspired by libraries like `react-hot-toast` and integrates with
 * the ShadCN UI `Toast` components. It supports adding, updating, dismissing,
 * and removing toasts, with a limit on the number of visible toasts.
 */
"use client"

import * as React from "react"

import type {
  ToastActionElement, // Type for the optional action button in a toast.
  ToastProps, // Props for the base Toast component from ShadCN UI.
} from "@/components/ui/toast"

// --- Configuration Constants ---
const TOAST_LIMIT = 1 // Maximum number of toasts visible at any time.
const TOAST_REMOVE_DELAY = 1000000 // Delay (in ms) before a dismissed toast is removed from the state. (Effectively infinite for now)

// --- Type Definitions ---
/**
 * Extended toast type used internally by the toaster state.
 * Includes all props from ShadCN's ToastProps plus `id`, `title`, `description`, and `action`.
 */
type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

// Action types for the reducer.
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const // `as const` makes the values of the object literal types.

// Counter for generating unique toast IDs.
let count = 0

/**
 * Generates a unique ID for each toast.
 * @returns {string} A unique string ID.
 */
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER // Increment and wrap around if max safe integer is reached.
  return count.toString()
}

type ActionType = typeof actionTypes // Union of all action type strings.

// Type definition for actions that can be dispatched to the reducer.
type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast // Payload for adding a new toast.
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast> // Payload for updating an existing toast (can be partial).
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"] // Optional toastId to dismiss a specific toast, or all if undefined.
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"] // Optional toastId to remove a specific toast, or all if undefined.
    }

/**
 * State shape for the toast system.
 * @interface State
 * @property {ToasterToast[]} toasts - Array of currently managed toasts.
 */
interface State {
  toasts: ToasterToast[]
}

// Map to store timeouts for removing dismissed toasts.
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Adds a toast ID to a queue for removal after a delay.
 * This prevents the toast from being immediately removed from the DOM, allowing for exit animations.
 * @param {string} toastId - The ID of the toast to queue for removal.
 */
const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) { // If already queued, do nothing.
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId) // Remove from timeouts map.
    // Dispatch action to actually remove the toast from the state.
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout) // Store the timeout ID.
}

/**
 * Reducer function for managing toast state.
 * Handles adding, updating, dismissing, and removing toasts.
 *
 * @param {State} state - The current state.
 * @param {Action} action - The action to process.
 * @returns {State} The new state.
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        // Add the new toast to the beginning of the array and limit the total number of toasts.
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        // Update the specified toast by merging new props.
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // Side effect: Add the toast(s) to the removal queue.
      if (toastId) { // Dismiss a specific toast.
        addToRemoveQueue(toastId)
      } else { // Dismiss all toasts.
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        // Mark the toast(s) as not open (which triggers exit animation).
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false, // Set 'open' to false to hide it.
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) { // Remove all toasts.
        return {
          ...state,
          toasts: [],
        }
      }
      // Remove a specific toast by filtering it out.
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

// Array of listener functions to be called when the state changes.
const listeners: Array<(state: State) => void> = []

// In-memory state for the toasts. This allows the `toast` function to be called outside React components.
let memoryState: State = { toasts: [] }

/**
 * Dispatches an action to update the toast state and notifies all listeners.
 * @param {Action} action - The action to dispatch.
 */
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action) // Update the in-memory state.
  // Notify all registered listeners of the state change.
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

/**
 * Props for creating a new toast (excluding the `id`).
 */
type Toast = Omit<ToasterToast, "id">

/**
 * Function to programmatically create and display a toast notification.
 *
 * @param {Toast} props - Properties of the toast to display (title, description, variant, etc.).
 * @returns {{ id: string; dismiss: () => void; update: (props: ToasterToast) => void }}
 *          An object containing the toast's ID and functions to dismiss or update it.
 */
function toast({ ...props }: Toast) {
  const id = genId() // Generate a unique ID for the toast.

  // Function to update this specific toast's properties.
  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  // Function to dismiss this specific toast.
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  // Dispatch action to add the new toast.
  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true, // Initially open.
      // Callback for when the toast's open state changes (e.g., due to swipe or close button).
      onOpenChange: (open) => {
        if (!open) dismiss() // If it's closed by user interaction, dismiss it.
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

/**
 * Custom hook `useToast`.
 * Provides access to the current list of toasts and functions to create or dismiss toasts.
 * This hook is intended for use within React components (e.g., the `Toaster` component).
 *
 * @returns {{ toasts: ToasterToast[]; toast: (props: Toast) => void; dismiss: (toastId?: string) => void; }}
 *          An object containing the current toasts, and functions to add or dismiss toasts.
 */
function useToast() {
  // State to hold the current list of toasts, synchronized with `memoryState`.
  const [state, setState] = React.useState<State>(memoryState)

  // Effect to subscribe to state changes from `dispatch`.
  React.useEffect(() => {
    listeners.push(setState) // Add setState to listeners on mount.
    return () => { // Cleanup on unmount.
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1) // Remove setState from listeners.
      }
    }
  }, [state]) // Dependency array includes `state` to re-subscribe if necessary (though typically stable).

  return {
    ...state, // Current toasts: `state.toasts`.
    toast, // Function to create a new toast.
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }), // Function to dismiss toast(s).
  }
}

export { useToast, toast }
