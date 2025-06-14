
'use client';

import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

// Define the props for the custom OTP input component
interface CustomOtpInputProps {
  value: string; // The OTP value managed by react-hook-form
  onChange: (value: string) => void; // The function to call when the value changes
  valueLength?: number; // The number of digits in the OTP
  disabled?: boolean; // The disabled state of the input
}

/**
 * A custom OTP input component designed to be a fully controlled component,
 * avoiding common autofill issues and providing robust keyboard navigation.
 */
export function CustomOtpInput({
  value = '',
  onChange,
  valueLength = 6,
  disabled = false,
}: CustomOtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Effect to focus the first empty input, which is useful on mount and after submission errors
  useEffect(() => {
    const firstEmptyIndex = value.length;
    if (firstEmptyIndex < valueLength) {
        inputRefs.current[firstEmptyIndex]?.focus();
    } else if (valueLength > 0) { // Ensure there's at least one input to focus
        inputRefs.current[0]?.focus();
    }
  }, []); // Run only on mount

  /**
   * Handles changes to each input field.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const targetValue = e.target.value;
    // Sanitize to only allow numeric characters
    const sanitizedValue = targetValue.replace(/[^0-9]/g, '');

    if (!sanitizedValue) {
      // Handle clearing the input
      const newValue = value.slice(0, index) + value.slice(index + 1);
      onChange(newValue);
      // On backspace/delete, it's handled by onKeyDown, so no focus change here
      return;
    }

    // Handle pasting multiple digits into one input
    if (sanitizedValue.length > 1) {
        handlePaste(sanitizedValue, index);
        return;
    }
    
    // Update the full OTP value
    const newOtpArray = value.split('');
    newOtpArray[index] = sanitizedValue;
    onChange(newOtpArray.join('').slice(0, valueLength));

    // Move focus to the next input field
    if (index < valueLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };
  
  /**
   * Handles keyboard events for backspace and arrow navigation.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      // If backspace is pressed on an empty input, move focus to the previous one
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < valueLength - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  /**
   * Handles pasting an OTP from the clipboard into any of the inputs.
   */
  const handlePaste = (pastedData: string, startIndex: number) => {
    const sanitizedPaste = pastedData.replace(/[^0-9]/g, '');
    if (!sanitizedPaste) return;

    // Create the new value by inserting the pasted content at the start index
    const newValue = (value.slice(0, startIndex) + sanitizedPaste).slice(0, valueLength);
    onChange(newValue);
    
    // Set focus to the input after the pasted content
    const nextFocusIndex = Math.min(newValue.length, valueLength - 1);
    setTimeout(() => { // Use timeout to ensure state update has rendered
      if (inputRefs.current[nextFocusIndex]) {
        inputRefs.current[nextFocusIndex]?.focus();
      }
    }, 0);
  };
  
  /**
   * Selects all text in an input on focus for easy replacement.
   */
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <div
      className="flex items-center justify-center gap-2"
      role="group"
      aria-label="One-time password input"
      // Attach the paste handler to the container
      onPaste={(e) => {
        // Find the currently focused input index, or default to 0
        let pasteStartIndex = 0;
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement) {
            const foundIndex = inputRefs.current.indexOf(activeElement);
            if (foundIndex !== -1) {
                pasteStartIndex = foundIndex;
            }
        }
        handlePaste(e.clipboardData.getData('text'), pasteStartIndex);
      }}
    >
      {Array(valueLength)
        .fill('')
        .map((_, index) => (
          <input
            key={index}
            ref={(el) => {
              if (el) inputRefs.current[index] = el;
            }}
            type="tel"
            inputMode="numeric"
            // CRITICAL: This autocomplete strategy helps prevent incorrect autofill.
            // The first input signals "one-time-code" and the rest are "off".
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={1} // Only allow one character per input
            value={value[index] || ''}
            onChange={(e) => handleChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onFocus={handleFocus}
            disabled={disabled}
            aria-label={`Enter digit ${index + 1} of ${valueLength}`}
            className={cn(
              "relative flex h-14 w-14 items-center justify-center rounded-md border border-input text-lg transition-all text-center",
              "focus:z-10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          />
        ))}
    </div>
  );
}

