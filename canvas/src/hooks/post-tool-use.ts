#!/usr/bin/env bun
/**
 * PostToolUse Hook for Agent Monitor
 *
 * This hook fires after any tool call completes.
 * It updates the agent monitor with real-time tool call information.
 */

import type {
  AgentTrackingFile,
  ToolCallRecord,
  PostToolUseInput,
  AgentMonitorConfig,
} from "../canvases/agent-monitor/types";

// Read JSON input from stdin
const inputText = await Bun.stdin.text();
let input: PostToolUseInput;

try {
  input = JSON.parse(inputText);
} catch {
  // Invalid JSON, exit silently
  process.exit(0);
}

// Get session info
const sessionId = input.session_id || process.env.CLAUDE_SESSION_ID || "";

// Check if this session is a sub-agent by looking for parent tracking files
// Sub-agents will have their tool_use_id tracked in a parent's tracking file
async function findParentTracking(): Promise<{
  tracking: AgentTrackingFile;
  path: string;
  agentId: string;
} | null> {
  // Look for tracking files in /tmp
  const glob = new Bun.Glob("claude-agents-*.json");

  for await (const file of glob.scan({ cwd: "/tmp", absolute: true })) {
    try {
      const content = await Bun.file(file).text();
      if (!content.trim()) continue;

      const tracking: AgentTrackingFile = JSON.parse(content);

      // Check if this session is a tracked agent
      for (const [agentId, agent] of Object.entries(tracking.agents)) {
        // Match by session ID if we have it, or by agent still running
        if (agent.sessionId === sessionId ||
            (agent.status === "running" && !agent.sessionId)) {
          return { tracking, path: file, agentId };
        }
      }
    } catch {
      // Skip invalid files
    }
  }

  return null;
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

// Check if this is a Task tool completion (sub-agent finished)
if (input.tool_name === "Task" || input.tool_name === "dispatch_agent") {
  // This is the parent session - a sub-agent just completed
  const parentSession = input.session_id || process.env.CLAUDE_SESSION_ID || "default";
  const trackingPath = `/tmp/claude-agents-${parentSession}.json`;

  try {
    const file = Bun.file(trackingPath);
    if (await file.exists()) {
      const content = await file.text();
      if (content.trim()) {
        const tracking: AgentTrackingFile = JSON.parse(content);

        // Find the agent by tool_use_id
        const agent = tracking.agents[input.tool_use_id];

        if (agent) {
          // Mark agent as completed
          agent.status = input.tool_error ? "error" : "completed";
          agent.endTime = Date.now();

          // Add the result as output
          // Task tool returns result in tool_response.content
          const toolResponse = (input as any).tool_response;
          if (toolResponse?.content) {
            const textContent = toolResponse.content
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join("\n");
            if (textContent) {
              agent.output = textContent.split("\n").slice(0, 100); // First 100 lines
            }
          } else if (input.tool_result) {
            // Fallback to tool_result for other formats
            const result = typeof input.tool_result === "string"
              ? input.tool_result
              : JSON.stringify(input.tool_result, null, 2);
            agent.output = result.split("\n").slice(0, 100);
          }

          // Save and send update
          await Bun.write(trackingPath, JSON.stringify(tracking, null, 2));
          await sendIPCUpdate(tracking);
        }
      }
    }
  } catch {
    // Ignore errors
  }

  process.exit(0);
}

// Main execution - for sub-agent tool calls
const parentInfo = await findParentTracking();

if (!parentInfo) {
  // Not a sub-agent, exit
  process.exit(0);
}

const { tracking, path: trackingPath, agentId } = parentInfo;
const agent = tracking.agents[agentId];

if (!agent) {
  process.exit(0);
}

// Update session ID if not set
if (!agent.sessionId && sessionId) {
  agent.sessionId = sessionId;
}

// Create tool call record
const toolCall: ToolCallRecord = {
  id: input.tool_use_id,
  timestamp: Date.now(),
  toolName: input.tool_name,
  input: input.tool_input,
  result: input.tool_result,
  status: input.tool_error ? "error" : "success",
};

// Add to agent's tool calls
agent.toolCalls.push(toolCall);

// Check for file modification tools and extract diff info
if (input.tool_name === "Edit") {
  const filePath = input.tool_input?.file_path || "unknown";
  const oldString = input.tool_input?.old_string || "";
  const newString = input.tool_input?.new_string || "";

  // Create a simple diff display
  const oldLines = String(oldString).split("\n");
  const newLines = String(newString).split("\n");

  const diffLines: string[] = [];
  diffLines.push(`--- ${filePath}`);
  diffLines.push(`+++ ${filePath}`);
  diffLines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);
  oldLines.slice(0, 5).forEach(line => diffLines.push(`-${line}`));
  if (oldLines.length > 5) diffLines.push(`... (${oldLines.length - 5} more removed)`);
  newLines.slice(0, 5).forEach(line => diffLines.push(`+${line}`));
  if (newLines.length > 5) diffLines.push(`... (${newLines.length - 5} more added)`);

  agent.gitDiffs.push({
    timestamp: Date.now(),
    filePath: String(filePath),
    additions: newLines.length,
    deletions: oldLines.length,
    diff: diffLines.join("\n"),
  });
} else if (input.tool_name === "Write") {
  const filePath = input.tool_input?.file_path || "unknown";
  const content = input.tool_input?.content || "";
  const lines = String(content).split("\n");

  const diffLines: string[] = [];
  diffLines.push(`+++ ${filePath} (new file)`);
  lines.slice(0, 8).forEach(line => diffLines.push(`+${line}`));
  if (lines.length > 8) diffLines.push(`... (${lines.length - 8} more lines)`);

  agent.gitDiffs.push({
    timestamp: Date.now(),
    filePath: String(filePath),
    additions: lines.length,
    deletions: 0,
    diff: diffLines.join("\n"),
  });
}

// Add output for certain tool types
if (input.tool_name === "Bash" && input.tool_result) {
  const result = typeof input.tool_result === "string"
    ? input.tool_result
    : JSON.stringify(input.tool_result);

  // Add first few lines of output
  const lines = result.split("\n").slice(0, 5);
  agent.output.push(...lines);
}

// Save tracking
await Bun.write(trackingPath, JSON.stringify(tracking, null, 2));

// Send IPC update
await sendIPCUpdate(tracking);

process.exit(0);
