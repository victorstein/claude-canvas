/**
 * OutputStream Component for Agent Monitor
 *
 * Displays a single line of output text with age-based dimming.
 */

import React from "react";
import { Text } from "ink";
import { THEME } from "../theme";

interface OutputStreamProps {
  line: string;
  width: number;
  dimmed?: boolean;
}

export function OutputStream({ line, width, dimmed = false }: OutputStreamProps) {
  // Truncate line to fit width
  const displayLine = line.length > width - 2 ? line.slice(0, width - 5) + "..." : line;

  // Apply dimming based on age
  const color = dimmed ? THEME.dimmer : THEME.text;

  return <Text color={color}>{displayLine}</Text>;
}
