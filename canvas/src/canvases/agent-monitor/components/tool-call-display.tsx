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
 * Format input for preview - extracts meaningful fields for common tools
 */
function formatInputPreview(toolName: string, input: unknown, maxLength: number): string {
  if (typeof input === "string") {
    return input.slice(0, maxLength);
  }

  if (typeof input !== "object" || input === null) {
    return "";
  }

  const obj = input as Record<string, unknown>;

  // Extract meaningful fields based on tool type
  switch (toolName) {
    case "Read":
      return obj.file_path ? String(obj.file_path).slice(-maxLength) : "";
    case "Edit":
    case "Write":
      return obj.file_path ? String(obj.file_path).slice(-maxLength) : "";
    case "Grep":
      const pattern = obj.pattern ? `"${obj.pattern}"` : "";
      const path = obj.path ? ` in ${String(obj.path).split("/").pop()}` : "";
      return (pattern + path).slice(0, maxLength);
    case "Glob":
      return obj.pattern ? String(obj.pattern).slice(0, maxLength) : "";
    case "Bash":
      return obj.command ? String(obj.command).slice(0, maxLength) : "";
    case "Task":
      return obj.description ? String(obj.description).slice(0, maxLength) : "";
    case "WebFetch":
      return obj.url ? String(obj.url).slice(0, maxLength) : "";
    case "WebSearch":
      return obj.query ? `"${obj.query}"`.slice(0, maxLength) : "";
    default:
      // For other tools, show first string value or JSON
      for (const [key, val] of Object.entries(obj)) {
        if (typeof val === "string" && val.length > 0) {
          return `${key}: ${val}`.slice(0, maxLength);
        }
      }
      try {
        return JSON.stringify(input).slice(0, maxLength);
      } catch {
        return "";
      }
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
  const inputPreview = formatInputPreview(call.toolName, call.input, Math.min(60, width - 30));

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
          <Text color={textColor}> {inputPreview}</Text>
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
