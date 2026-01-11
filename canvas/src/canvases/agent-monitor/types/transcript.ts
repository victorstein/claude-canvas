/**
 * Type definitions for Claude Code transcript JSONL entries.
 *
 * Transcripts are stored as JSONL (one JSON object per line).
 * These types represent the structure of entries in the transcript.
 */

// ============================================
// Tool Use Types
// ============================================

/**
 * A tool_use entry within an assistant message content array.
 * Represents the invocation of a tool (before result).
 */
export interface TranscriptToolUse {
  type: "tool_use";
  /** Unique identifier for correlation with tool_result */
  id: string;
  /** Name of the tool being called */
  name: string;
  /** Input parameters passed to the tool */
  input: Record<string, unknown>;
}

/**
 * A tool_result entry in the transcript.
 * Represents the result of a tool call.
 */
export interface TranscriptToolResult {
  type: "tool_result";
  /** Matches the tool_use.id */
  tool_use_id: string;
  /** Result content (can be string or object) */
  content: unknown;
  /** Whether the tool call resulted in an error */
  is_error?: boolean;
}

// ============================================
// Text Output Types
// ============================================

/**
 * A text entry within an assistant message content array.
 */
export interface TranscriptText {
  type: "text";
  /** The text content */
  text: string;
}

// ============================================
// Message Wrapper Types
// ============================================

/**
 * An assistant message entry in the transcript.
 * Contains an array of content items (tool_use, text, etc.)
 */
export interface TranscriptAssistantMessage {
  type: "assistant";
  message: {
    content: Array<TranscriptToolUse | TranscriptText>;
  };
}

/**
 * A user message entry (for completeness)
 */
export interface TranscriptUserMessage {
  type: "user";
  message: {
    content: Array<{ type: "text"; text: string }>;
  };
}

// ============================================
// Union Types
// ============================================

/**
 * Content item within an assistant message
 */
export type TranscriptContentItem = TranscriptToolUse | TranscriptText;

/**
 * Any entry that can appear in a transcript JSONL file
 */
export type TranscriptEntry =
  | TranscriptAssistantMessage
  | TranscriptUserMessage
  | TranscriptToolResult
  | { type: string; [key: string]: unknown };

// ============================================
// Watcher State Types
// ============================================

/**
 * State tracked per agent for incremental transcript parsing
 */
export interface TranscriptWatcherState {
  /** Path to the transcript file */
  path: string;
  /** Last byte position read (for efficient tailing) */
  lastBytePosition: number;
  /** Tool calls awaiting their results */
  pendingToolIds: Set<string>;
}

/**
 * Update returned from transcript watcher for a single agent
 */
export interface TranscriptUpdate {
  /** Agent ID this update applies to */
  agentId: string;
  /** New tool calls (pending or completed) */
  newToolCalls: Array<{
    id: string;
    toolName: string;
    input: unknown;
    timestamp: number;
  }>;
  /** Tool results that completed */
  completedResults: Map<string, { result: unknown; isError: boolean }>;
  /** New text output lines */
  newOutput: string[];
}
