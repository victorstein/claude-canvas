/**
 * DiffDisplay Component for Agent Monitor
 *
 * Displays a GitHub-style diff with line numbers, background colors,
 * and change summary.
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
 * Parse diff lines into structured format with line numbers
 */
interface DiffLine {
  type: "header" | "range" | "context" | "addition" | "deletion" | "info";
  content: string;
  lineNumber?: number;
}

function parseDiffLines(diffText: string): DiffLine[] {
  const lines = diffText.split("\n");
  const result: DiffLine[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const line of lines) {
    if (line.startsWith("---") || line.startsWith("+++")) {
      result.push({ type: "header", content: line });
    } else if (line.startsWith("@@")) {
      // Parse line numbers from @@ -1,5 +1,8 @@
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[2], 10);
      }
      result.push({ type: "range", content: line });
    } else if (line.startsWith("-")) {
      result.push({ type: "deletion", content: line.slice(1), lineNumber: oldLineNum++ });
    } else if (line.startsWith("+")) {
      result.push({ type: "addition", content: line.slice(1), lineNumber: newLineNum++ });
    } else if (line.startsWith("...")) {
      result.push({ type: "info", content: line });
    } else if (line.trim()) {
      // Context line
      result.push({ type: "context", content: line, lineNumber: newLineNum++ });
      oldLineNum++;
    }
  }

  return result;
}

/**
 * Get short filename from path
 */
function getShortPath(filePath: string, maxLen: number): string {
  const parts = filePath.split("/");
  if (parts.length <= 2) return filePath;

  // Try to show last 2-3 parts
  const shortPath = parts.slice(-3).join("/");
  if (shortPath.length <= maxLen) return shortPath;

  return parts.slice(-2).join("/");
}

export function DiffDisplay({ diff, width, maxLines = 12, dimmed = false }: DiffDisplayProps) {
  const parsedLines = parseDiffLines(diff.diff);
  const displayLines = parsedLines.slice(0, maxLines);
  const remainingLines = parsedLines.length - maxLines;

  // Colors
  const headerColor = dimmed ? THEME.dim : THEME.neonYellow;
  const addBg = dimmed ? undefined : "#1a4d1a"; // Dark green background
  const delBg = dimmed ? undefined : "#4d1a1a"; // Dark red background
  const addColor = dimmed ? THEME.dim : THEME.neonGreen;
  const delColor = dimmed ? THEME.dim : THEME.neonRed;
  const lineNumColor = THEME.dim;
  const contextColor = dimmed ? THEME.dimmer : THEME.text;

  // Format timestamp
  const timestamp = formatRelativeTime(diff.timestamp);

  // Get short filename
  const shortPath = getShortPath(diff.filePath, width - 30);

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Header: Update(filename) */}
      <Box>
        <Text color={headerColor} bold={!dimmed}>
          Edit
        </Text>
        <Text color={dimmed ? THEME.dim : THEME.text}>(</Text>
        <Text color={dimmed ? THEME.dim : THEME.neonCyan}>{shortPath}</Text>
        <Text color={dimmed ? THEME.dim : THEME.text}>)</Text>
        <Box flexGrow={1} />
        <Text color={THEME.dimmer}>{timestamp}</Text>
      </Box>

      {/* Summary: Added X lines, removed Y lines */}
      <Box marginLeft={2}>
        <Text color={lineNumColor}>L </Text>
        {diff.additions > 0 && (
          <Text color={addColor}>Added {diff.additions} line{diff.additions !== 1 ? "s" : ""}</Text>
        )}
        {diff.additions > 0 && diff.deletions > 0 && (
          <Text color={lineNumColor}>, </Text>
        )}
        {diff.deletions > 0 && (
          <Text color={delColor}>removed {diff.deletions} line{diff.deletions !== 1 ? "s" : ""}</Text>
        )}
      </Box>

      {/* Diff content with line numbers and colors */}
      <Box flexDirection="column" marginLeft={2} marginTop={0}>
        {displayLines.map((line, idx) => {
          const maxContentWidth = width - 12; // Account for line number and prefix
          const truncatedContent = line.content.length > maxContentWidth
            ? line.content.slice(0, maxContentWidth - 3) + "..."
            : line.content;

          switch (line.type) {
            case "header":
              // Skip --- and +++ headers, we show our own
              return null;

            case "range":
              return (
                <Box key={idx}>
                  <Text color={THEME.neonCyan} dimColor={dimmed}>
                    {line.content}
                  </Text>
                </Box>
              );

            case "deletion":
              return (
                <Box key={idx}>
                  <Text color={lineNumColor}>
                    {String(line.lineNumber || "").padStart(3)}
                  </Text>
                  <Text color={delColor} backgroundColor={delBg}> - </Text>
                  <Text color={delColor} backgroundColor={delBg}>
                    {truncatedContent}
                  </Text>
                </Box>
              );

            case "addition":
              return (
                <Box key={idx}>
                  <Text color={lineNumColor}>
                    {String(line.lineNumber || "").padStart(3)}
                  </Text>
                  <Text color={addColor} backgroundColor={addBg}> + </Text>
                  <Text color={addColor} backgroundColor={addBg}>
                    {truncatedContent}
                  </Text>
                </Box>
              );

            case "context":
              return (
                <Box key={idx}>
                  <Text color={lineNumColor}>
                    {String(line.lineNumber || "").padStart(3)}
                  </Text>
                  <Text color={contextColor}>   {truncatedContent}</Text>
                </Box>
              );

            case "info":
              return (
                <Box key={idx}>
                  <Text color={THEME.dim}>
                    {line.content}
                  </Text>
                </Box>
              );

            default:
              return null;
          }
        })}

        {/* Show remaining lines indicator */}
        {remainingLines > 0 && (
          <Box>
            <Text color={THEME.dim}>
              ... ({remainingLines} more lines)
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
