/**
 * OutputStream Component for Agent Monitor
 *
 * Displays a single line of output text with markdown rendering and age-based dimming.
 */

import React from "react";
import { Text } from "ink";
import { THEME } from "../theme";

interface OutputStreamProps {
  line: string;
  width: number;
  dimmed?: boolean;
}

/**
 * Render a line with basic markdown formatting
 */
function renderMarkdownLine(line: string, dimmed: boolean): React.ReactNode {
  const baseColor = dimmed ? THEME.dimmer : THEME.text;
  const boldColor = dimmed ? THEME.dim : THEME.neonCyan;
  const headerColor = dimmed ? THEME.dim : THEME.header;
  const listColor = dimmed ? THEME.dim : THEME.neonGreen;
  const codeColor = dimmed ? THEME.dim : THEME.neonYellow;

  // Handle headers (## Header)
  const headerMatch = line.match(/^(#{1,3})\s+(.*)$/);
  if (headerMatch) {
    const level = headerMatch[1].length;
    const text = headerMatch[2];
    return (
      <Text bold color={headerColor}>
        {level === 1 ? "═ " : level === 2 ? "─ " : "• "}
        {renderInlineMarkdown(text, boldColor, codeColor, baseColor)}
      </Text>
    );
  }

  // Handle list items (- item or * item)
  const listMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
  if (listMatch) {
    const indent = listMatch[1];
    const text = listMatch[2];
    return (
      <Text color={baseColor}>
        {indent}
        <Text color={listColor}>• </Text>
        {renderInlineMarkdown(text, boldColor, codeColor, baseColor)}
      </Text>
    );
  }

  // Handle numbered lists (1. item)
  const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (numberedMatch) {
    const indent = numberedMatch[1];
    const num = numberedMatch[2];
    const text = numberedMatch[3];
    return (
      <Text color={baseColor}>
        {indent}
        <Text color={listColor}>{num}. </Text>
        {renderInlineMarkdown(text, boldColor, codeColor, baseColor)}
      </Text>
    );
  }

  // Regular line with inline formatting
  return <Text color={baseColor}>{renderInlineMarkdown(line, boldColor, codeColor, baseColor)}</Text>;
}

/**
 * Render inline markdown (bold, code)
 */
function renderInlineMarkdown(
  text: string,
  boldColor: string,
  codeColor: string,
  baseColor: string
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<Text key={key++} color={baseColor}>{boldMatch[1]}</Text>);
      parts.push(<Text key={key++} bold color={boldColor}>{boldMatch[2]}</Text>);
      remaining = boldMatch[3];
      continue;
    }

    // Inline code: `code`
    const codeMatch = remaining.match(/^(.*?)`(.+?)`(.*)/);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<Text key={key++} color={baseColor}>{codeMatch[1]}</Text>);
      parts.push(<Text key={key++} color={codeColor}>{codeMatch[2]}</Text>);
      remaining = codeMatch[3];
      continue;
    }

    // No more matches, add remaining text
    parts.push(<Text key={key++} color={baseColor}>{remaining}</Text>);
    break;
  }

  return <>{parts}</>;
}

export function OutputStream({ line, width, dimmed = false }: OutputStreamProps) {
  // Truncate line to fit width
  const displayLine = line.length > width - 2 ? line.slice(0, width - 5) + "..." : line;

  return <>{renderMarkdownLine(displayLine, dimmed)}</>;
}
