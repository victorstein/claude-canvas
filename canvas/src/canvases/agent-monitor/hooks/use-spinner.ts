/**
 * useSpinner Hook
 *
 * Returns an animated spinner frame that updates at a specified interval.
 */

import { useState, useEffect } from "react";
import { SPINNER_FRAMES } from "../theme";

interface UseSpinnerOptions {
  /** Interval between frames in ms (default: 80) */
  interval?: number;
  /** Whether the spinner is active (default: true) */
  active?: boolean;
}

/**
 * Hook that returns the current spinner frame
 */
export function useSpinner(options: UseSpinnerOptions = {}): string {
  const { interval = 80, active = true } = options;
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, interval);

    return () => clearInterval(timer);
  }, [interval, active]);

  if (!active) return "";

  return SPINNER_FRAMES[frameIndex] ?? SPINNER_FRAMES[0] ?? "⠋";
}

/**
 * Hook that returns spinner frames for multiple items
 * Offsets each spinner so they don't all sync up
 */
export function useMultiSpinner(count: number, options: UseSpinnerOptions = {}): string[] {
  const { interval = 80, active = true } = options;
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!active || count === 0) return;

    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, interval);

    return () => clearInterval(timer);
  }, [interval, active, count]);

  if (!active) return Array(count).fill("");

  // Offset each spinner by a different amount for visual variety
  return Array.from({ length: count }, (_, i) => {
    const offset = (frameIndex + i * 2) % SPINNER_FRAMES.length;
    return SPINNER_FRAMES[offset] ?? SPINNER_FRAMES[0] ?? "⠋";
  });
}
