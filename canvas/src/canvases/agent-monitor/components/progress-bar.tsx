/**
 * ProgressBar Component for Agent Monitor
 *
 * An animated indeterminate progress bar for pending operations.
 * Uses cyberpunk theme colors with a pulsing animation.
 */

import React, { useState, useEffect } from "react";
import { Text } from "ink";
import { THEME } from "../theme";

interface ProgressBarProps {
  /** Width of the progress bar in characters */
  width?: number;
  /** Whether the progress bar is active */
  active?: boolean;
  /** Animation speed in ms (default: 100) */
  speed?: number;
  /** Color of the progress indicator */
  color?: string;
}

// Progress bar characters
const FILLED = "█";
const EMPTY = "░";
const PULSE_WIDTH = 4;

/**
 * Indeterminate progress bar with bouncing animation
 */
export function ProgressBar({
  width = 20,
  active = true,
  speed = 100,
  color = THEME.neonCyan,
}: ProgressBarProps) {
  const [position, setPosition] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => {
      setPosition((prev) => {
        const next = prev + direction;
        // Bounce at edges
        if (next >= width - PULSE_WIDTH) {
          setDirection(-1);
          return width - PULSE_WIDTH;
        }
        if (next <= 0) {
          setDirection(1);
          return 0;
        }
        return next;
      });
    }, speed);

    return () => clearInterval(timer);
  }, [active, direction, speed, width]);

  if (!active) {
    return (
      <Text color={THEME.dim}>
        {EMPTY.repeat(width)}
      </Text>
    );
  }

  // Build the progress bar string
  const before = EMPTY.repeat(position);
  const pulse = FILLED.repeat(PULSE_WIDTH);
  const after = EMPTY.repeat(Math.max(0, width - position - PULSE_WIDTH));

  return (
    <Text>
      <Text color={THEME.dim}>{before}</Text>
      <Text color={color}>{pulse}</Text>
      <Text color={THEME.dim}>{after}</Text>
    </Text>
  );
}

/**
 * Elapsed time progress indicator
 * Shows time elapsed since start with a mini progress animation
 */
interface ElapsedProgressProps {
  /** Start timestamp */
  startTime: number;
  /** Whether the operation is still running */
  running?: boolean;
  /** Width of progress portion */
  barWidth?: number;
}

export function ElapsedProgress({
  startTime,
  running = true,
  barWidth = 12,
}: ElapsedProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;

    const timer = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);

    // Initial update
    setElapsed(Date.now() - startTime);

    return () => clearInterval(timer);
  }, [startTime, running]);

  // Format elapsed time
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const timeStr = minutes > 0
    ? `${minutes}m ${seconds % 60}s`
    : `${seconds}s`;

  return (
    <Text>
      <ProgressBar width={barWidth} active={running} />
      <Text color={THEME.dim}> {timeStr}</Text>
    </Text>
  );
}
