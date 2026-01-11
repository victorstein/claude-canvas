/**
 * TabBar Component for Agent Monitor
 *
 * Displays horizontal tabs for each agent with animated status indicators.
 */

import React from "react";
import { Box, Text } from "ink";
import type { AgentState } from "../types";
import { THEME, getStatusColor } from "../theme";
import { useSpinner } from "../hooks/use-spinner";

interface TabBarProps {
  agents: Record<string, AgentState>;
  activeTabId: string | null;
  width: number;
}

/**
 * Truncate text to max length with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

export function TabBar({ agents, activeTabId, width }: TabBarProps) {
  const agentList = Object.values(agents);

  // Check if any agents are running for spinner
  const hasRunning = agentList.some((a) => a.status === "running");
  const spinner = useSpinner({ active: hasRunning });

  if (agentList.length === 0) {
    return (
      <Box
        borderStyle="round"
        borderColor={THEME.borderDim}
        width={width}
        paddingX={1}
      >
        <Text color={THEME.dim}>No agents running</Text>
      </Box>
    );
  }

  // Calculate max tab width based on number of agents
  const maxTabWidth = Math.max(15, Math.floor((width - 4) / agentList.length) - 2);

  return (
    <Box
      flexDirection="row"
      borderStyle="round"
      borderColor={THEME.border}
      width={width}
      paddingX={1}
    >
      {agentList.map((agent, idx) => {
        const isActive = agent.id === activeTabId;
        const statusColor = getStatusColor(agent.status);

        // Create tab label from description
        const label = truncate(
          agent.description || `Agent ${idx + 1}`,
          maxTabWidth - 5
        );

        // Status indicator: spinner for running, dot for others
        const statusIndicator =
          agent.status === "running" ? spinner : "●";

        return (
          <Box key={agent.id} marginRight={1}>
            {/* Tab number */}
            <Text
              bold={isActive}
              color={isActive ? THEME.neonCyan : THEME.dim}
            >
              {`${idx + 1} `}
            </Text>

            {/* Tab label */}
            <Text
              bold={isActive}
              color={isActive ? THEME.text : THEME.dim}
            >
              {label}
            </Text>

            {/* Status indicator */}
            <Text color={statusColor}> {statusIndicator}</Text>

            {/* Separator */}
            {idx < agentList.length - 1 && (
              <Text color={THEME.borderDim}> │</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
