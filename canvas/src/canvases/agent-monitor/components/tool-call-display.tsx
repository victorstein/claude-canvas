/**
 * ToolCallDisplay Component for Agent Monitor
 *
 * Displays a tool call with its name, input preview, status, and result.
 * Uses cyberpunk theme colors with progress bar and timestamps.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ToolCallRecord } from "../types";
import { THEME } from "../theme";
import { ElapsedProgress } from "./progress-bar";
import { formatRelativeTime } from "../utils/format-time";

interface ToolCallDisplayProps {
  call: ToolCallRecord;
  width: number;
  dimmed?: boolean;
}

/**
 * Get status icon and color
 */
function getStatusIndicator(status: ToolCallRecord["status"]): {
  icon: string;
  color: string;
} {
  switch (status) {
    case "success":
      return { icon: "✓", color: THEME.completed };
    case "error":
      return { icon: "✗", color: THEME.error };
    case "pending":
    default:
      return { icon: "⋯", color: THEME.running };
  }
}

/**
 * Format input for preview
 */
function formatInputPreview(input: unknown, maxLength: number): string {
  if (typeof input === "string") {
    return input.slice(0, maxLength);
  }

  try {
    const str = JSON.stringify(input);
    return str.slice(0, maxLength);
  } catch {
    return "[object]";
  }
}

/**
 * Format result for display
 */
function formatResult(result: unknown, maxLength: number): string {
  if (result === null || result === undefined) {
    return "";
  }

  if (typeof result === "string") {
    return result.slice(0, maxLength);
  }

  try {
    const str = JSON.stringify(result);
    return str.slice(0, maxLength);
  } catch {
    return "[object]";
  }
}

export function ToolCallDisplay({ call, width, dimmed = false }: ToolCallDisplayProps) {
  const { icon, color } = getStatusIndicator(call.status);

  // Format input preview (shorter to make room for timestamp)
  const inputPreview = formatInputPreview(call.input, Math.min(40, width - 35));

  // Format result if available
  const resultPreview = formatResult(call.result, width - 10);

  // Apply dimming for old content
  const textColor = dimmed ? THEME.dimmer : THEME.dim;
  const labelColor = dimmed ? THEME.dim : THEME.label;

  // Format timestamp
  const timestamp = formatRelativeTime(call.timestamp);

  return (
    <Box flexDirection="column" marginY={0}>
      {/* Main tool call line */}
      <Box>
        <Text color={dimmed ? THEME.dim : color}>{icon} </Text>
        <Text color={labelColor} bold={!dimmed}>
          {call.toolName}
        </Text>
        {inputPreview !== "" && (
          <Text color={textColor}> - {inputPreview}...</Text>
        )}
        <Box flexGrow={1} />
        <Text color={THEME.dimmer}>{timestamp}</Text>
      </Box>

      {/* Progress bar for pending operations */}
      {call.status === "pending" && (
        <Box marginLeft={2}>
          <ElapsedProgress startTime={call.timestamp} running={true} barWidth={16} />
        </Box>
      )}

      {/* Result line (if available and successful) */}
      {resultPreview !== "" && call.status === "success" && (
        <Box marginLeft={2}>
          <Text color={textColor}>
            → {resultPreview}
          </Text>
        </Box>
      )}

      {/* Error message (if error status) */}
      {call.status === "error" && call.result != null && (
        <Box marginLeft={2}>
          <Text color={THEME.error}>
            Error: {formatResult(call.result, width - 12)}
          </Text>
        </Box>
      )}
    </Box>
  );
}
