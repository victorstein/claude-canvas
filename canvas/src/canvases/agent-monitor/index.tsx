/**
 * Agent Monitor Canvas
 *
 * A tabbed terminal UI for viewing Claude Code sub-agent activity in real-time.
 * Displays output streams, tool calls, and git diffs for each agent.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { TabBar } from "./components/tab-bar";
import { ContentPane } from "./components/content-pane";
import type { AgentMonitorConfig, AgentState } from "./types";
import { THEME } from "./theme";
import { useSpinner } from "./hooks/use-spinner";
import { useTranscriptWatcher } from "./hooks/use-transcript-watcher";
import { SearchBar, useSearch } from "./components/search-bar";

interface AgentMonitorCanvasProps {
  id: string;
  config?: AgentMonitorConfig;
  socketPath?: string;
  scenario?: string;
}

export function AgentMonitorCanvas({
  id,
  config: initialConfig,
  socketPath,
  scenario,
}: AgentMonitorCanvasProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Terminal dimensions
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 120,
    height: stdout?.rows || 40,
  });

  // Agent data
  const [agents, setAgents] = useState<Record<string, AgentState>>(
    initialConfig?.agents || {}
  );

  // Currently selected tab
  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    const agentIds = Object.keys(initialConfig?.agents || {});
    return agentIds[0] ?? null;
  });

  // Scroll offset per agent
  const [scrollOffsets, setScrollOffsets] = useState<Record<string, number>>({});

  // Auto-scroll mode (follow latest output)
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  // Search state
  const {
    isSearching,
    searchQuery,
    startSearch,
    cancelSearch,
    submitSearch,
    setSearchQuery,
  } = useSearch();

  // Real-time transcript watching
  const { updates: transcriptUpdates } = useTranscriptWatcher(agents);

  // Merge transcript updates into agents state
  useEffect(() => {
    if (Object.keys(transcriptUpdates).length === 0) return;

    setAgents((prevAgents) => {
      const updated = { ...prevAgents };
      let hasChanges = false;

      for (const [agentId, update] of Object.entries(transcriptUpdates)) {
        if (updated[agentId]) {
          // Check if there are actual changes
          const currentAgent = updated[agentId];
          const toolCallsChanged =
            update.toolCalls.length !== currentAgent.toolCalls.length ||
            update.toolCalls.some(
              (tc, i) =>
                tc.status !== currentAgent.toolCalls[i]?.status ||
                tc.id !== currentAgent.toolCalls[i]?.id
            );
          const outputChanged = update.output.length !== currentAgent.output.length;
          const diffsChanged = update.diffs.length !== currentAgent.gitDiffs.length;

          if (toolCallsChanged || outputChanged || diffsChanged) {
            updated[agentId] = {
              ...currentAgent,
              toolCalls: update.toolCalls,
              output: update.output,
              gitDiffs: update.diffs,
            };
            hasChanges = true;
          }
        }
      }

      return hasChanges ? updated : prevAgents;
    });
  }, [transcriptUpdates]);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: stdout?.columns || 120,
        height: stdout?.rows || 40,
      });
    };

    stdout?.on("resize", updateDimensions);
    updateDimensions();

    return () => {
      stdout?.off("resize", updateDimensions);
    };
  }, [stdout]);

  // Set up IPC server for receiving updates
  useEffect(() => {
    if (!socketPath) return;

    let server: ReturnType<typeof Bun.listen> | null = null;

    const startServer = async () => {
      try {
        // Remove existing socket file if it exists
        const file = Bun.file(socketPath);
        if (await file.exists()) {
          await Bun.$`rm -f ${socketPath}`;
        }

        server = Bun.listen({
          unix: socketPath,
          socket: {
            open(socket) {
              // Connection established
            },
            data(socket, data) {
              try {
                const lines = data.toString().split("\n").filter((l) => l.trim());
                for (const line of lines) {
                  const msg = JSON.parse(line);

                  if (msg.type === "update" && msg.config) {
                    const config = msg.config as AgentMonitorConfig;
                    setAgents(config.agents);

                    // Auto-select first tab if none selected
                    setActiveTabId((current) => {
                      if (!current) {
                        return Object.keys(config.agents)[0] ?? null;
                      }
                      return current;
                    });
                  } else if (msg.type === "close") {
                    exit();
                  }
                }
              } catch {
                // Ignore parse errors
              }
            },
            close() {},
            error() {},
          },
        });
      } catch (e) {
        console.error("Failed to start IPC server:", e);
      }
    };

    startServer();

    return () => {
      server?.stop();
    };
  }, [socketPath, exit]);

  // Poll tracking file for updates (backup for IPC)
  useEffect(() => {
    const parentSessionId = initialConfig?.parentSessionId;
    if (!parentSessionId) return;

    const trackingPath = `/tmp/claude-agents-${parentSessionId}.json`;
    let lastModified = 0;

    const pollTracking = async () => {
      try {
        const file = Bun.file(trackingPath);
        const stat = await file.stat();

        // Only update if file was modified
        if (stat && stat.mtime && stat.mtime.getTime() > lastModified) {
          lastModified = stat.mtime.getTime();
          const content = await file.text();
          if (content.trim()) {
            const tracking = JSON.parse(content);
            if (tracking.agents) {
              setAgents(tracking.agents);

              // Auto-select first tab if none selected
              setActiveTabId((current) => {
                if (!current) {
                  return Object.keys(tracking.agents)[0] ?? null;
                }
                return current;
              });
            }
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    // Poll every 500ms for responsive updates
    const interval = setInterval(pollTracking, 500);

    // Initial poll
    pollTracking();

    return () => clearInterval(interval);
  }, [initialConfig?.parentSessionId]);

  // Auto-scroll to bottom when content updates (if autoScroll enabled)
  useEffect(() => {
    if (!autoScroll || !activeTabId) return;

    const agent = agents[activeTabId];
    if (!agent) return;

    // Calculate total content items for this agent
    const totalItems =
      agent.output.length + agent.toolCalls.length + agent.gitDiffs.length;

    // Scroll to bottom (will be clamped by ContentPane)
    if (totalItems > 0) {
      setScrollOffsets((prev) => ({
        ...prev,
        [activeTabId]: 99999,
      }));
    }
  }, [autoScroll, activeTabId, agents]);

  // Get current scroll offset for active tab
  const getScrollOffset = useCallback(
    (tabId: string | null): number => {
      if (!tabId) return 0;
      return scrollOffsets[tabId] || 0;
    },
    [scrollOffsets]
  );

  // Set scroll offset for active tab
  const setScrollOffset = useCallback(
    (tabId: string | null, offset: number) => {
      if (!tabId) return;
      setScrollOffsets((prev) => ({
        ...prev,
        [tabId]: Math.max(0, offset),
      }));
    },
    []
  );

  // Keyboard navigation
  useInput((input, key) => {
    // If searching, let SearchBar handle input
    if (isSearching) {
      return;
    }

    // Quit
    if (key.escape || input === "q") {
      exit();
      return;
    }

    // Start search with '/'
    if (input === "/") {
      startSearch();
      return;
    }

    const agentIds = Object.keys(agents);
    const currentIdx = agentIds.indexOf(activeTabId || "");

    // Tab switching with Tab key
    if (key.tab) {
      if (agentIds.length > 0) {
        const nextIdx = (currentIdx + 1) % agentIds.length;
        const nextId = agentIds[nextIdx];
        if (nextId) setActiveTabId(nextId);
      }
      return;
    }

    // Tab switching with number keys
    if (input >= "1" && input <= "9") {
      const idx = parseInt(input) - 1;
      const targetId = agentIds[idx];
      if (targetId) setActiveTabId(targetId);
      return;
    }

    // Toggle auto-scroll with 'f' key
    if (input === "f") {
      setAutoScroll((prev) => !prev);
      return;
    }

    // Scrolling
    if (activeTabId) {
      const currentScroll = getScrollOffset(activeTabId);

      if (key.upArrow) {
        setScrollOffset(activeTabId, currentScroll - 1);
      } else if (key.downArrow) {
        setScrollOffset(activeTabId, currentScroll + 1);
      } else if (key.pageUp) {
        setScrollOffset(activeTabId, currentScroll - 10);
      } else if (key.pageDown) {
        setScrollOffset(activeTabId, currentScroll + 10);
      } else if (input === "g") {
        // Go to top
        setScrollOffset(activeTabId, 0);
      } else if (input === "G") {
        // Go to bottom (will be clamped by ContentPane)
        setScrollOffset(activeTabId, 99999);
      }
    }
  });

  // Get active agent
  const activeAgent = activeTabId ? agents[activeTabId] : null;

  // Compute summary stats
  const stats = useMemo(() => {
    const agentList = Object.values(agents);
    const running = agentList.filter((a) => a.status === "running").length;
    const completed = agentList.filter((a) => a.status === "completed").length;
    const errors = agentList.filter((a) => a.status === "error").length;
    const totalToolCalls = agentList.reduce((sum, a) => sum + a.toolCalls.length, 0);
    const totalDiffs = agentList.reduce((sum, a) => sum + a.gitDiffs.length, 0);
    return { total: agentList.length, running, completed, errors, totalToolCalls, totalDiffs };
  }, [agents]);

  // Spinner for header when agents are running
  const headerSpinner = useSpinner({ active: stats.running > 0 });

  // Calculate layout dimensions
  const { width, height } = dimensions;
  const headerHeight = 1;
  const tabBarHeight = 3;
  const footerHeight = 1;
  const contentHeight = height - headerHeight - tabBarHeight - footerHeight;

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Header with summary stats */}
      <Box paddingX={1}>
        <Text bold color={THEME.header}>
          {stats.running > 0 && <Text color={THEME.running}>{headerSpinner} </Text>}
          Sub-Agent Monitor
        </Text>
        <Box flexGrow={1} />
        {/* Stats */}
        <Text color={THEME.dim}>[</Text>
        <Text color={THEME.running}>{stats.running}</Text>
        <Text color={THEME.dim}>/</Text>
        <Text color={THEME.completed}>{stats.completed}</Text>
        {stats.errors > 0 && (
          <>
            <Text color={THEME.dim}>/</Text>
            <Text color={THEME.error}>{stats.errors}</Text>
          </>
        )}
        <Text color={THEME.dim}> agents</Text>
        <Text color={THEME.borderDim}> │ </Text>
        <Text color={THEME.neonCyan}>{stats.totalToolCalls}</Text>
        <Text color={THEME.dim}> tools</Text>
        {stats.totalDiffs > 0 && (
          <>
            <Text color={THEME.borderDim}> │ </Text>
            <Text color={THEME.neonGreen}>{stats.totalDiffs}</Text>
            <Text color={THEME.dim}> diffs</Text>
          </>
        )}
        <Text color={THEME.dim}>]</Text>
        {autoScroll && <Text color={THEME.neonCyan}> [FOLLOW]</Text>}
      </Box>

      {/* Tab Bar */}
      <TabBar agents={agents} activeTabId={activeTabId} width={width} />

      {/* Search Bar (when active) */}
      {isSearching && (
        <SearchBar
          active={isSearching}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onCancel={cancelSearch}
          onSubmit={submitSearch}
          width={Math.min(width - 4, 50)}
        />
      )}

      {/* Content Area */}
      {activeAgent ? (
        <ContentPane
          agent={activeAgent}
          scrollOffset={getScrollOffset(activeTabId)}
          width={width}
          height={isSearching ? contentHeight - 3 : contentHeight}
          autoScroll={autoScroll}
          searchQuery={searchQuery}
        />
      ) : (
        <Box
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          height={contentHeight}
          borderStyle="round"
          borderColor={THEME.borderDim}
        >
          <Text color={THEME.dim}>No agents to display</Text>
          <Text color={THEME.dimmer}>
            Waiting for sub-agents to start...
          </Text>
        </Box>
      )}

      {/* Footer with keyboard shortcuts */}
      <Box paddingX={1}>
        <Text color={THEME.dim}>
          <Text color={THEME.label}>Tab</Text>/1-9: switch
          <Text color={THEME.borderDim}> │ </Text>
          <Text color={THEME.label}>↑↓</Text>/PgUp/PgDn: scroll
          <Text color={THEME.borderDim}> │ </Text>
          <Text color={THEME.label}>f</Text>: follow
          <Text color={THEME.borderDim}> │ </Text>
          <Text color={THEME.label}>/</Text>: search
          <Text color={THEME.borderDim}> │ </Text>
          <Text color={THEME.label}>g</Text>/G: top/bottom
          <Text color={THEME.borderDim}> │ </Text>
          <Text color={THEME.label}>q</Text>: quit
        </Text>
      </Box>
    </Box>
  );
}

// Default export for dynamic import
export default AgentMonitorCanvas;
