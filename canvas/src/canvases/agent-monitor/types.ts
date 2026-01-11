/**
 * Type definitions for the Agent Monitor Canvas.
 * Shared between hooks, canvas components, and IPC communication.
 */

// ============================================
// Agent State Types
// ============================================

export type AgentStatus = "running" | "completed" | "error";

export interface AgentState {
  /** Unique identifier from tool_use_id */
  id: string;
  /** Session ID assigned by Claude Code (from SubagentStop) */
  sessionId: string | null;
  /** Task description from the Task tool input */
  description: string;
  /** Full task instructions/prompt */
  instructions: string;
  /** Current status of the agent */
  status: AgentStatus;
  /** Unix timestamp when agent started */
  startTime: number;
  /** Unix timestamp when agent completed (null if running) */
  endTime: number | null;
  /** Path to the agent's transcript file */
  transcriptPath: string | null;
  /** Tool calls made by the agent */
  toolCalls: ToolCallRecord[];
  /** Git diffs created by the agent */
  gitDiffs: DiffRecord[];
  /** Output lines from the agent (streaming) */
  output: string[];
}

// ============================================
// Tool Call Types
// ============================================

export type ToolCallStatus = "pending" | "success" | "error";

export interface ToolCallRecord {
  /** Unique tool_use_id for correlation between pending and completed */
  id: string;
  /** Unix timestamp of the tool call */
  timestamp: number;
  /** Name of the tool called */
  toolName: string;
  /** Input parameters passed to the tool */
  input: unknown;
  /** Result returned by the tool (null if pending) */
  result: unknown | null;
  /** Status of the tool call */
  status: ToolCallStatus;
}

// ============================================
// Git Diff Types
// ============================================

export interface DiffRecord {
  /** Unix timestamp when diff was created */
  timestamp: number;
  /** Path to the modified file */
  filePath: string;
  /** Number of lines added */
  additions: number;
  /** Number of lines deleted */
  deletions: number;
  /** Full diff content */
  diff: string;
}

// ============================================
// Tracking File Types
// ============================================

export interface AgentTrackingFile {
  /** Parent Claude Code session ID */
  parentSessionId: string;
  /** WezTerm/tmux pane ID where canvas is running (null if not spawned) */
  canvasPaneId: string | null;
  /** Unix socket path for IPC */
  socketPath: string;
  /** All tracked agents keyed by their ID */
  agents: Record<string, AgentState>;
}

// ============================================
// Canvas Config Types
// ============================================

export interface AgentMonitorConfig {
  /** Parent session ID */
  parentSessionId: string;
  /** All agents to display */
  agents: Record<string, AgentState>;
}

// ============================================
// Content Item Types (for rendering)
// ============================================

export type ContentItemType = "output" | "tool" | "diff";

export interface OutputContentItem {
  type: "output";
  content: string;
  key: string;
  timestamp?: number;
}

export interface ToolContentItem {
  type: "tool";
  content: ToolCallRecord;
  key: string;
  timestamp: number;
}

export interface DiffContentItem {
  type: "diff";
  content: DiffRecord;
  key: string;
  timestamp: number;
}

export type ContentItem = OutputContentItem | ToolContentItem | DiffContentItem;

// ============================================
// Hook Input Types
// ============================================

export interface PreToolUseInput {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_use_id: string;
  tool_input: {
    description?: string;
    prompt?: string;
    instructions?: string;
    subagent_type?: string;
    [key: string]: unknown;
  };
  session_id: string;
  transcript_path: string;
  cwd: string;
}

export interface SubagentStopInput {
  hook_event_name: "SubagentStop";
  session_id: string;
  transcript_path: string;
  cwd: string;
  stop_hook_active: boolean;
}

export interface PostToolUseInput {
  hook_event_name: "PostToolUse";
  tool_name: string;
  tool_use_id: string;
  tool_input: Record<string, unknown>;
  tool_result: unknown;
  tool_error?: string;
  session_id: string;
  transcript_path: string;
  cwd: string;
}
