/**
 * useTranscriptWatcher Hook
 *
 * Watches transcript files for multiple agents and provides
 * real-time updates as tool calls start, complete, and output streams.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import * as fs from "node:fs";
import type { AgentState, ToolCallRecord, DiffRecord } from "../types";
import {
  processTranscriptLines,
  mergeToolCalls,
} from "../utils/transcript-parser";

// ============================================
// Types
// ============================================

interface WatcherState {
  /** Last byte position read from file */
  lastBytePosition: number;
  /** IDs of pending tool calls awaiting results */
  pendingToolIds: Set<string>;
}

interface TranscriptUpdateResult {
  toolCalls: ToolCallRecord[];
  output: string[];
  diffs: DiffRecord[];
}

interface UseTranscriptWatcherOptions {
  /** Debounce interval in ms (default: 200) */
  debounceMs?: number;
  /** Whether watching is enabled (default: true) */
  enabled?: boolean;
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook that watches transcript files for all running agents
 * and returns real-time updates.
 */
export function useTranscriptWatcher(
  agents: Record<string, AgentState>,
  options: UseTranscriptWatcherOptions = {}
): {
  updates: Record<string, TranscriptUpdateResult>;
  errors: Record<string, string>;
} {
  const { debounceMs = 200, enabled = true } = options;

  // Watcher state per agent (byte position, pending IDs)
  const watcherStates = useRef<Map<string, WatcherState>>(new Map());

  // Active fs.watch instances
  const watchers = useRef<Map<string, fs.FSWatcher>>(new Map());

  // Debounce timers
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  // Accumulated updates per agent
  const [updates, setUpdates] = useState<
    Record<string, TranscriptUpdateResult>
  >({});

  // Errors per agent
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Read new content from transcript file starting from last position
   */
  const readNewContent = useCallback(
    async (agentId: string, transcriptPath: string): Promise<string[]> => {
      const state = watcherStates.current.get(agentId) || {
        lastBytePosition: 0,
        pendingToolIds: new Set<string>(),
      };

      try {
        const file = Bun.file(transcriptPath);

        // Check if file exists
        if (!(await file.exists())) {
          return [];
        }

        const size = file.size;

        // Handle file truncation (size decreased)
        if (size < state.lastBytePosition) {
          state.lastBytePosition = 0;
        }

        // Read new bytes if any
        if (size > state.lastBytePosition) {
          const blob = file.slice(state.lastBytePosition, size);
          const newContent = await blob.text();
          state.lastBytePosition = size;
          watcherStates.current.set(agentId, state);

          // Split into lines
          return newContent.split("\n").filter((line) => line.trim());
        }
      } catch (e) {
        setErrors((prev) => ({
          ...prev,
          [agentId]: `Failed to read transcript: ${e}`,
        }));
      }

      return [];
    },
    []
  );

  /**
   * Process new lines and update state for an agent
   */
  const processAgentUpdate = useCallback(
    (
      agentId: string,
      lines: string[],
      currentAgent: AgentState
    ): TranscriptUpdateResult | null => {
      if (lines.length === 0) return null;

      const state = watcherStates.current.get(agentId) || {
        lastBytePosition: 0,
        pendingToolIds: new Set<string>(),
      };

      // Process the new lines
      const { toolCalls: newCalls, completedResults, output, diffs } =
        processTranscriptLines(lines);

      // Track new pending tool IDs
      for (const call of newCalls) {
        state.pendingToolIds.add(call.id);
      }

      // Remove completed tool IDs
      for (const id of completedResults.keys()) {
        state.pendingToolIds.delete(id);
      }

      watcherStates.current.set(agentId, state);

      // Merge tool calls with existing ones
      const mergedToolCalls = mergeToolCalls(
        currentAgent.toolCalls,
        newCalls,
        completedResults
      );

      return {
        toolCalls: mergedToolCalls,
        output: [...currentAgent.output, ...output],
        diffs: [...currentAgent.gitDiffs, ...diffs],
      };
    },
    []
  );

  /**
   * Handle file change event (debounced)
   */
  const handleFileChange = useCallback(
    (agentId: string, transcriptPath: string, currentAgent: AgentState) => {
      // Clear existing debounce timer
      const existingTimer = debounceTimers.current.get(agentId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new debounced timer
      const timer = setTimeout(async () => {
        try {
          const newLines = await readNewContent(agentId, transcriptPath);
          if (newLines.length > 0) {
            const update = processAgentUpdate(agentId, newLines, currentAgent);
            if (update) {
              setUpdates((prev) => ({
                ...prev,
                [agentId]: update,
              }));
            }
          }
        } catch (e) {
          setErrors((prev) => ({
            ...prev,
            [agentId]: `Error processing transcript: ${e}`,
          }));
        }
      }, debounceMs);

      debounceTimers.current.set(agentId, timer);
    },
    [debounceMs, readNewContent, processAgentUpdate]
  );

  /**
   * Set up file watchers for all agents with transcript paths
   */
  useEffect(() => {
    if (!enabled) return;

    const activeAgentIds = new Set<string>();

    for (const [agentId, agent] of Object.entries(agents)) {
      // Only watch running agents with transcript paths
      if (agent.status !== "running" || !agent.transcriptPath) continue;

      activeAgentIds.add(agentId);
      const transcriptPath = agent.transcriptPath;

      // Skip if already watching
      if (watchers.current.has(agentId)) continue;

      // Initialize watcher state if needed
      if (!watcherStates.current.has(agentId)) {
        watcherStates.current.set(agentId, {
          lastBytePosition: 0,
          pendingToolIds: new Set(),
        });
      }

      // Do initial read
      (async () => {
        try {
          const lines = await readNewContent(agentId, transcriptPath);
          if (lines.length > 0) {
            const update = processAgentUpdate(agentId, lines, agent);
            if (update) {
              setUpdates((prev) => ({
                ...prev,
                [agentId]: update,
              }));
            }
          }
        } catch (e) {
          setErrors((prev) => ({
            ...prev,
            [agentId]: `Initial read failed: ${e}`,
          }));
        }
      })();

      // Set up fs.watch
      try {
        const watcher = fs.watch(transcriptPath, (eventType) => {
          if (eventType === "change") {
            // Get current agent state for merging
            const currentAgent = agents[agentId];
            if (currentAgent) {
              handleFileChange(agentId, transcriptPath, currentAgent);
            }
          }
        });

        // Handle watcher errors
        watcher.on("error", (err) => {
          setErrors((prev) => ({
            ...prev,
            [agentId]: `Watcher error: ${err.message}`,
          }));
        });

        watchers.current.set(agentId, watcher);
      } catch (e) {
        setErrors((prev) => ({
          ...prev,
          [agentId]: `Failed to start watcher: ${e}`,
        }));

        // Fall back to polling for this agent
        const pollInterval = setInterval(async () => {
          const currentAgent = agents[agentId];
          if (!currentAgent || currentAgent.status !== "running") {
            clearInterval(pollInterval);
            return;
          }

          const lines = await readNewContent(agentId, transcriptPath);
          if (lines.length > 0) {
            const update = processAgentUpdate(agentId, lines, currentAgent);
            if (update) {
              setUpdates((prev) => ({
                ...prev,
                [agentId]: update,
              }));
            }
          }
        }, 500);
      }
    }

    // Clean up watchers for agents no longer being watched
    for (const [agentId, watcher] of watchers.current) {
      if (!activeAgentIds.has(agentId)) {
        watcher.close();
        watchers.current.delete(agentId);
        watcherStates.current.delete(agentId);

        // Clear debounce timer
        const timer = debounceTimers.current.get(agentId);
        if (timer) {
          clearTimeout(timer);
          debounceTimers.current.delete(agentId);
        }
      }
    }

    // Cleanup on unmount
    return () => {
      for (const watcher of watchers.current.values()) {
        watcher.close();
      }
      watchers.current.clear();

      for (const timer of debounceTimers.current.values()) {
        clearTimeout(timer);
      }
      debounceTimers.current.clear();
    };
  }, [
    agents,
    enabled,
    handleFileChange,
    readNewContent,
    processAgentUpdate,
  ]);

  return { updates, errors };
}
