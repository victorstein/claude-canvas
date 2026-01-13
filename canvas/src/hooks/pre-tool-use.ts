#!/usr/bin/env bun
/**
 * PreToolUse Hook for Agent Monitor
 *
 * This hook is triggered when Claude Code invokes the Task tool.
 * It tracks sub-agents and spawns the monitor canvas when any agent starts running.
 */

// Auto-install dependencies if missing
const pluginRoot = import.meta.dir.replace("/src/hooks", "");
const nodeModulesPath = `${pluginRoot}/node_modules`;
if (!(await Bun.file(nodeModulesPath).exists())) {
  await Bun.$`bun install --cwd ${pluginRoot} --silent`.quiet();
}

import { spawnCanvas } from "../terminal/index";
import type {
  AgentTrackingFile,
  AgentState,
  PreToolUseInput,
  AgentMonitorConfig,
} from "../canvases/agent-monitor/types";

// Read JSON input from stdin
const inputText = await Bun.stdin.text();
let input: PreToolUseInput;

try {
  input = JSON.parse(inputText);
} catch {
  // Invalid JSON, exit silently
  process.exit(0);
}

// Only handle Task tool (sub-agents)
if (input.tool_name !== "Task" && input.tool_name !== "dispatch_agent") {
  process.exit(0);
}

// Get session ID from input or environment
const parentSession = input.session_id || process.env.CLAUDE_SESSION_ID || "default";
const trackingPath = `/tmp/claude-agents-${parentSession}.json`;
const socketPath = `/tmp/canvas-agent-monitor-${parentSession}.sock`;

/**
 * Load or create the tracking file
 */
async function loadOrCreateTracking(): Promise<AgentTrackingFile> {
  try {
    const file = Bun.file(trackingPath);
    if (await file.exists()) {
      const content = await file.text();
      if (content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch {
    // File doesn't exist or is invalid, create new
  }

  return {
    parentSessionId: parentSession,
    canvasPaneId: null,
    socketPath,
    agents: {},
  };
}

/**
 * Save tracking file
 */
async function saveTracking(tracking: AgentTrackingFile): Promise<void> {
  await Bun.write(trackingPath, JSON.stringify(tracking, null, 2));
}

/**
 * Send IPC update to existing canvas
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

// Main execution
const tracking = await loadOrCreateTracking();

// Create new agent entry
const newAgent: AgentState = {
  id: input.tool_use_id,
  sessionId: null,
  description: input.tool_input?.description || "Sub-agent task",
  instructions:
    input.tool_input?.prompt ||
    input.tool_input?.instructions ||
    "",
  status: "running",
  startTime: Date.now(),
  endTime: null,
  transcriptPath: input.transcript_path || null,
  toolCalls: [],
  gitDiffs: [],
  output: [],
};

// Add to tracking
tracking.agents[input.tool_use_id] = newAgent;
await saveTracking(tracking);

// Count active (running) agents
const activeAgents = Object.values(tracking.agents).filter(
  (a) => a.status === "running"
);
const activeCount = activeAgents.length;

// If any agent is running and canvas not spawned, spawn it
if (activeCount >= 1 && !tracking.canvasPaneId) {
  try {
    const config: AgentMonitorConfig = {
      parentSessionId: tracking.parentSessionId,
      agents: tracking.agents,
    };

    await spawnCanvas(
      "agent-monitor",
      `agent-monitor-${parentSession}`,
      JSON.stringify(config),
      { socketPath, scenario: "monitor" }
    );

    // Update tracking with spawned status
    tracking.canvasPaneId = "spawned";
    await saveTracking(tracking);
  } catch (e) {
    // Log error but don't block the hook
    console.error("Failed to spawn agent monitor:", e);
  }
} else if (tracking.canvasPaneId) {
  // Canvas already running, send update
  await sendIPCUpdate(tracking);
}

// Exit successfully
process.exit(0);
