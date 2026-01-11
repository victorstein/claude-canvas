/**
 * DiffDisplay Component for Agent Monitor
 *
 * Displays a git diff with syntax highlighting and cyberpunk theme.
 */

import React from "react";
import { Box, Text } from "ink";
import type { DiffRecord } from "../types";
import { THEME } from "../theme";
import { formatRelativeTime } from "../utils/format-time";

interface DiffDisplayProps {
  diff: DiffRecord;
  width: number;
  maxLines?: number;
  dimmed?: boolean;
}

/**
 * Get color for a diff line based on its content
 */
function getDiffLineColor(line: string, dimmed: boolean): string {
  if (dimmed) return THEME.dimmer;

  if (line.startsWith("+++") || line.startsWith("---")) {
    return THEME.neonYellow;
  }
  if (line.startsWith("+")) {
    return THEME.neonGreen;
  }
  if (line.startsWith("-")) {
    return THEME.neonRed;
  }
  if (line.startsWith("@@")) {
    return THEME.neonCyan;
  }
  if (line.startsWith("diff ") || line.startsWith("index ")) {
    return THEME.neonMagenta;
  }
  return THEME.dim;
}

export function DiffDisplay({ diff, width, maxLines = 10, dimmed = false }: DiffDisplayProps) {
  const lines = diff.diff.split("\n");
  const displayLines = lines.slice(0, maxLines);
  const remainingLines = lines.length - maxLines;

  const headerColor = dimmed ? THEME.dim : THEME.header;
  const textColor = dimmed ? THEME.dimmer : THEME.text;

  // Format timestamp
  const timestamp = formatRelativeTime(diff.timestamp);

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Header with file path and stats */}
      <Box>
        <Text color={headerColor} bold={!dimmed}>
          diff:{" "}
        </Text>
        <Text color={textColor}>{diff.filePath}</Text>
        <Text color={dimmed ? THEME.dim : THEME.neonGreen}> +{diff.additions}</Text>
        <Text color={dimmed ? THEME.dim : THEME.neonRed}> -{diff.deletions}</Text>
        <Box flexGrow={1} />
        <Text color={THEME.dimmer}>{timestamp}</Text>
      </Box>

      {/* Diff content */}
      <Box flexDirection="column" marginLeft={2}>
        {displayLines.map((line, idx) => {
          const color = getDiffLineColor(line, dimmed);
          const displayLine =
            line.length > width - 6 ? line.slice(0, width - 9) + "..." : line;

          return (
            <Text key={idx} color={color}>
              {displayLine}
            </Text>
          );
        })}

        {/* Show remaining lines indicator */}
        {remainingLines > 0 && (
          <Text color={THEME.dim}>
            ... ({remainingLines} more lines)
          </Text>
        )}
      </Box>
    </Box>
  );
}
