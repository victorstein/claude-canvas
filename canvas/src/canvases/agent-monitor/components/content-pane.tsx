/**
 * ContentPane Component for Agent Monitor
 *
 * Scrollable content area that displays output, tool calls, and diffs
 * with age-based fading and cyberpunk theme.
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { OutputStream } from "./output-stream";
import { ToolCallDisplay } from "./tool-call-display";
import { DiffDisplay } from "./diff-display";
import type { AgentState, ContentItem } from "../types";
import { THEME } from "../theme";
import { useSpinner } from "../hooks/use-spinner";
import { matchesSearch } from "./search-bar";

interface ContentPaneProps {
  agent: AgentState;
  scrollOffset: number;
  width: number;
  height: number;
  autoScroll?: boolean;
  searchQuery?: string;
}

// Age threshold for dimming (30 seconds)
const DIM_AGE_MS = 30000;

/**
 * Build content items sorted by timestamp
 */
function buildContentItems(agent: AgentState): ContentItem[] {
  const items: ContentItem[] = [];
  const now = Date.now();

  // Add output lines (assume they're in chronological order)
  agent.output.forEach((line, idx) => {
    const timestamp = agent.startTime + idx * 100; // Approximate timing
    items.push({
      type: "output",
      content: line,
      key: `out-${idx}`,
      timestamp,
    });
  });

  // Add tool calls
  agent.toolCalls.forEach((tc, idx) => {
    items.push({
      type: "tool",
      content: tc,
      key: `tool-${idx}`,
      timestamp: tc.timestamp,
    });
  });

  // Add git diffs
  agent.gitDiffs.forEach((diff, idx) => {
    items.push({
      type: "diff",
      content: diff,
      key: `diff-${idx}`,
      timestamp: diff.timestamp,
    });
  });

  // Sort by timestamp
  return items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

/**
 * Format duration in human-readable format
 */
function formatDuration(startTime: number, endTime: number | null): string {
  const end = endTime || Date.now();
  const durationMs = end - startTime;
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function ContentPane({
  agent,
  scrollOffset,
  width,
  height,
  autoScroll = false,
  searchQuery = "",
}: ContentPaneProps) {
  const spinner = useSpinner({ active: agent.status === "running" });
  const now = Date.now();

  // Build and memoize content items
  const allItems = useMemo(() => buildContentItems(agent), [agent]);

  // Debug: log what we're rendering
  Bun.write("/tmp/content-pane-debug.log", `[${new Date().toISOString()}] Agent output: ${agent.output.length}, allItems: ${allItems.length}, status: ${agent.status}\n`, { append: true });

  // Filter items based on search query
  const items = useMemo(() => {
    if (!searchQuery) return allItems;

    return allItems.filter((item) => {
      switch (item.type) {
        case "output":
          return matchesSearch(item.content, searchQuery);
        case "tool":
          return (
            matchesSearch(item.content.toolName, searchQuery) ||
            matchesSearch(JSON.stringify(item.content.input), searchQuery) ||
            matchesSearch(JSON.stringify(item.content.result || ""), searchQuery)
          );
        case "diff":
          return (
            matchesSearch(item.content.filePath, searchQuery) ||
            matchesSearch(item.content.diff, searchQuery)
          );
        default:
          return true;
      }
    });
  }, [allItems, searchQuery]);

  // Calculate visible window
  const contentHeight = height - 4; // Account for header and padding
  // Clamp scrollOffset to valid range
  const maxScroll = Math.max(0, items.length - contentHeight);
  const clampedOffset = Math.min(scrollOffset, maxScroll);
  const visibleItems = items.slice(clampedOffset, clampedOffset + contentHeight);

  // Calculate scroll percentage
  const scrollPercent =
    maxScroll > 0 ? Math.round((clampedOffset / maxScroll) * 100) : 100;

  const contentWidth = width - 4;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={agent.status === "running" ? THEME.border : THEME.borderDim}
      height={height}
      width={width}
    >
      {/* Agent info header */}
      <Box marginBottom={1} paddingX={1}>
        <Text bold color={THEME.header}>
          {agent.status === "running" && <Text color={THEME.running}>{spinner} </Text>}
          {agent.description}
        </Text>
        <Box flexGrow={1} />
        <Text color={THEME.dim}>
          {formatDuration(agent.startTime, agent.endTime)}
        </Text>
        {autoScroll && (
          <Text color={THEME.neonCyan}> [FOLLOW]</Text>
        )}
      </Box>

      {/* Instructions (if available, truncated) */}
      {agent.instructions && (
        <Box paddingX={1} marginBottom={1}>
          <Text color={THEME.dim}>
            {agent.instructions.slice(0, contentWidth - 4)}
            {agent.instructions.length > contentWidth - 4 ? "..." : ""}
          </Text>
        </Box>
      )}

      {/* Content area */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {visibleItems.length === 0 ? (
          <Box flexDirection="column" alignItems="center" justifyContent="center">
            <Text color={THEME.dim}>
              {agent.status === "running" ? (
                <>
                  <Text color={THEME.running}>{spinner}</Text>
                  {" Waiting for output..."}
                </>
              ) : (
                "No output recorded"
              )}
            </Text>
          </Box>
        ) : (
          visibleItems.map((item) => {
            // Determine if this item should be dimmed based on age
            const age = now - (item.timestamp || 0);
            const dimmed = age > DIM_AGE_MS;

            switch (item.type) {
              case "output":
                return (
                  <OutputStream
                    key={item.key}
                    line={item.content}
                    width={contentWidth}
                    dimmed={dimmed}
                  />
                );
              case "tool":
                return (
                  <ToolCallDisplay
                    key={item.key}
                    call={item.content}
                    width={contentWidth}
                    dimmed={dimmed}
                  />
                );
              case "diff":
                return (
                  <DiffDisplay
                    key={item.key}
                    diff={item.content}
                    width={contentWidth}
                    maxLines={5}
                    dimmed={dimmed}
                  />
                );
              default:
                return null;
            }
          })
        )}
      </Box>

      {/* Scroll indicator */}
      {items.length > contentHeight && (
        <Box justifyContent="flex-end" paddingX={1}>
          <Text color={THEME.dim}>
            {scrollOffset > 0 ? "↑ " : "  "}
            <Text color={THEME.label}>{scrollPercent}%</Text>
            {scrollOffset < maxScroll ? " ↓" : "  "}
          </Text>
        </Box>
      )}
    </Box>
  );
}
