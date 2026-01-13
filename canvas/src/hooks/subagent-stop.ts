#!/usr/bin/env bun
/**
 * SubagentStop Hook for Agent Monitor
 *
 * This hook is triggered when a sub-agent completes.
 * It updates the tracking file and sends an IPC update to the canvas.
 */

// Auto-install dependencies if missing
const pluginRoot = import.meta.dir.replace("/src/hooks", "");
const nodeModulesPath = `${pluginRoot}/node_modules`;
if (!(await Bun.file(nodeModulesPath).exists())) {
  await Bun.$`bun install --cwd ${pluginRoot} --silent`.quiet();
}

import type {
  AgentTrackingFile,
  SubagentStopInput,
  AgentMonitorConfig,
} from "../canvases/agent-monitor/types";

// Read JSON input from stdin
const inputText = await Bun.stdin.text();
let input: SubagentStopInput;

try {
  input = JSON.parse(inputText);
} catch {
  // Invalid JSON, exit silently
  process.exit(0);
}

// Prevent infinite loops
if (input.stop_hook_active) {
  process.exit(0);
}

// Get parent session ID from environment
const parentSession = process.env.CLAUDE_SESSION_ID || "default";
const trackingPath = `/tmp/claude-agents-${parentSession}.json`;

/**
 * Load tracking file
 */
async function loadTracking(): Promise<AgentTrackingFile | null> {
  try {
    const file = Bun.file(trackingPath);
    if (await file.exists()) {
      const content = await file.text();
      if (content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch {
    // File doesn't exist or is invalid
  }
  return null;
}

/**
 * Save tracking file
 */
async function saveTracking(tracking: AgentTrackingFile): Promise<void> {
  await Bun.write(trackingPath, JSON.stringify(tracking, null, 2));
}

/**
 * Send IPC update to canvas
 */
async function sendIPCUpdate(tracking: AgentTrackingFile): Promise<void> {
  try {
    const config: AgentMonitorConfig = {
      parentSessionId: tracking.parentSessionId,
      agents: tracking.agents,
    };

    await new Promise<void>((resolve) => {
      Bun.connect({
        unix: tracking.socketPath,
        socket: {
          open(socket) {
            const msg = JSON.stringify({ type: "update", config });
            socket.write(msg + "\n");
            socket.end();
            resolve();
          },
          data() {},
          close() {
            resolve();
          },
          error() {
            resolve();
          },
        },
      }).catch(() => resolve());
    });
  } catch {
    // Ignore IPC errors
  }
}

/**
 * Parse transcript file to extract tool calls (simplified)
 */
async function parseTranscript(transcriptPath: string): Promise<{
  toolCalls: Array<{ id: string; toolName: string; input: unknown; result: unknown }>;
  output: string[];
}> {
  const toolCalls: Array<{ id: string; toolName: string; input: unknown; result: unknown }> = [];
  const output: string[] = [];

  try {
    const file = Bun.file(transcriptPath);
    if (await file.exists()) {
      const content = await file.text();
      const lines = content.split("\n").filter((l) => l.trim());

      let idCounter = 0;
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // Extract tool calls from transcript entries
          if (entry.type === "tool_use" || entry.tool_name) {
            toolCalls.push({
              id: entry.id || entry.tool_use_id || `tc-${idCounter++}`,
              toolName: entry.tool_name || entry.name || "unknown",
              input: entry.tool_input || entry.input || {},
              result: entry.tool_result || entry.result || null,
            });
          }

          // Extract text output
          if (entry.type === "text" && entry.text) {
            output.push(entry.text);
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  return { toolCalls, output };
}

// Main execution
const tracking = await loadTracking();

if (!tracking) {
  // No tracking file, nothing to update
  process.exit(0);
}

// Find the agent to update
// First, try to match by session ID (if we tracked it somehow)
// Otherwise, find the first running agent without a session assigned
let targetAgent = Object.values(tracking.agents).find(
  (a) => a.sessionId === input.session_id
);

if (!targetAgent) {
  // Find first running agent without a session ID
  targetAgent = Object.values(tracking.agents).find(
    (a) => a.status === "running" && !a.sessionId
  );
}

if (targetAgent) {
  // Update agent state
  targetAgent.sessionId = input.session_id;
  targetAgent.status = "completed";
  targetAgent.endTime = Date.now();
  targetAgent.transcriptPath = input.transcript_path;

  // Parse transcript for additional data
  if (input.transcript_path) {
    const { toolCalls, output } = await parseTranscript(input.transcript_path);

    // Add tool calls with timestamps
    targetAgent.toolCalls = toolCalls.map((tc, idx) => ({
      id: tc.id,
      timestamp: targetAgent!.startTime + idx * 1000,
      toolName: tc.toolName,
      input: tc.input,
      result: tc.result,
      status: "success" as const,
    }));

    // Add output lines
    targetAgent.output = output;
  }

  await saveTracking(tracking);

  // Send IPC update if canvas is running
  if (tracking.canvasPaneId) {
    await sendIPCUpdate(tracking);
  }
}

// Exit successfully
process.exit(0);
