/**
 * Transcript Parser Utilities for Agent Monitor
 *
 * Parses Claude Code transcript JSONL files, extracting tool calls,
 * results, and text output for real-time display.
 */

import type {
  TranscriptEntry,
  TranscriptAssistantMessage,
  TranscriptToolResult,
  TranscriptToolUse,
  TranscriptText,
} from "../types/transcript";
import type { ToolCallRecord, DiffRecord } from "../types";

// ============================================
// Line Parsing
// ============================================

/**
 * Parse a single JSONL line into a transcript entry.
 * Returns null for invalid lines (empty, malformed JSON).
 */
export function parseTranscriptLine(line: string): TranscriptEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as TranscriptEntry;
  } catch {
    // Skip malformed JSON lines
    return null;
  }
}

// ============================================
// Content Extraction
// ============================================

/**
 * Check if an entry is an assistant message
 */
export function isAssistantMessage(
  entry: TranscriptEntry
): entry is TranscriptAssistantMessage {
  return entry.type === "assistant" && "message" in entry;
}

/**
 * Check if an entry is a tool result
 */
export function isToolResult(
  entry: TranscriptEntry
): entry is TranscriptToolResult {
  return entry.type === "tool_result" && "tool_use_id" in entry;
}

/**
 * Extract tool use entries from an assistant message
 */
export function extractToolUses(
  entry: TranscriptAssistantMessage
): Array<{ id: string; toolName: string; input: unknown; timestamp: number }> {
  const results: Array<{
    id: string;
    toolName: string;
    input: unknown;
    timestamp: number;
  }> = [];

  if (!entry.message?.content) return results;

  for (const item of entry.message.content) {
    if (item.type === "tool_use") {
      const toolUse = item as TranscriptToolUse;
      results.push({
        id: toolUse.id,
        toolName: toolUse.name,
        input: toolUse.input,
        timestamp: Date.now(),
      });
    }
  }

  return results;
}

/**
 * Extract text output from an assistant message
 */
export function extractTextOutput(entry: TranscriptAssistantMessage): string[] {
  const output: string[] = [];

  if (!entry.message?.content) return output;

  for (const item of entry.message.content) {
    if (item.type === "text") {
      const textItem = item as TranscriptText;
      if (textItem.text) {
        // Split multi-line text into individual lines
        const lines = textItem.text.split("\n");
        output.push(...lines);
      }
    }
  }

  return output;
}

/**
 * Parse a tool result entry
 */
export function parseToolResult(entry: TranscriptToolResult): {
  toolUseId: string;
  result: unknown;
  isError: boolean;
} {
  return {
    toolUseId: entry.tool_use_id,
    result: entry.content,
    isError: entry.is_error ?? false,
  };
}

// ============================================
// Tool Call Merging
// ============================================

/**
 * Merge new tool calls with existing ones, updating pending → completed
 */
export function mergeToolCalls(
  existing: ToolCallRecord[],
  newCalls: Array<{
    id: string;
    toolName: string;
    input: unknown;
    timestamp: number;
  }>,
  completedResults: Map<string, { result: unknown; isError: boolean }>
): ToolCallRecord[] {
  // Create a map of existing calls by ID for fast lookup
  const callMap = new Map<string, ToolCallRecord>();
  for (const call of existing) {
    callMap.set(call.id, { ...call });
  }

  // Add new pending calls
  for (const newCall of newCalls) {
    if (!callMap.has(newCall.id)) {
      callMap.set(newCall.id, {
        id: newCall.id,
        timestamp: newCall.timestamp,
        toolName: newCall.toolName,
        input: newCall.input,
        result: null,
        status: "pending",
      });
    }
  }

  // Update completed calls
  for (const [id, completion] of completedResults) {
    const call = callMap.get(id);
    if (call && call.status === "pending") {
      call.result = completion.result;
      call.status = completion.isError ? "error" : "success";
    }
  }

  // Return sorted by timestamp
  return Array.from(callMap.values()).sort((a, b) => a.timestamp - b.timestamp);
}

// ============================================
// Diff Detection
// ============================================

/**
 * Check if a tool call represents a file modification
 */
export function isFileModification(toolName: string): boolean {
  return toolName === "Edit" || toolName === "Write" || toolName === "NotebookEdit";
}

/**
 * Extract diff information from a completed file modification tool call
 */
export function extractDiffFromToolCall(
  toolName: string,
  input: unknown,
  _result: unknown
): DiffRecord | null {
  if (!isFileModification(toolName)) return null;

  const inputObj = input as Record<string, unknown>;
  const filePath = String(
    inputObj.file_path || inputObj.path || inputObj.notebook_path || "unknown"
  );

  // Try to extract additions/deletions from input
  let additions = 0;
  let deletions = 0;

  if (inputObj.new_string && inputObj.old_string) {
    const newLines = String(inputObj.new_string).split("\n").length;
    const oldLines = String(inputObj.old_string).split("\n").length;
    additions = Math.max(0, newLines - oldLines);
    deletions = Math.max(0, oldLines - newLines);
  } else if (inputObj.content) {
    additions = String(inputObj.content).split("\n").length;
  }

  return {
    timestamp: Date.now(),
    filePath,
    additions,
    deletions,
    diff: `${toolName}: ${filePath}`,
  };
}

// ============================================
// Batch Processing
// ============================================

/**
 * Process multiple transcript lines and extract all updates
 */
export function processTranscriptLines(lines: string[]): {
  toolCalls: Array<{
    id: string;
    toolName: string;
    input: unknown;
    timestamp: number;
  }>;
  completedResults: Map<string, { result: unknown; isError: boolean }>;
  output: string[];
  diffs: DiffRecord[];
} {
  const toolCalls: Array<{
    id: string;
    toolName: string;
    input: unknown;
    timestamp: number;
  }> = [];
  const completedResults = new Map<
    string,
    { result: unknown; isError: boolean }
  >();
  const output: string[] = [];
  const diffs: DiffRecord[] = [];

  // Track tool names for diff extraction
  const toolNames = new Map<string, string>();

  for (const line of lines) {
    const entry = parseTranscriptLine(line);
    if (!entry) continue;

    if (isAssistantMessage(entry)) {
      // Extract tool uses
      const uses = extractToolUses(entry);
      for (const use of uses) {
        toolCalls.push(use);
        toolNames.set(use.id, use.toolName);
      }

      // Extract text output
      output.push(...extractTextOutput(entry));
    } else if (isToolResult(entry)) {
      const result = parseToolResult(entry);
      completedResults.set(result.toolUseId, {
        result: result.result,
        isError: result.isError,
      });

      // Extract diff if this was a file modification
      const toolName = toolNames.get(result.toolUseId);
      if (toolName && isFileModification(toolName)) {
        const toolCall = toolCalls.find((tc) => tc.id === result.toolUseId);
        if (toolCall) {
          const diff = extractDiffFromToolCall(
            toolName,
            toolCall.input,
            result.result
          );
          if (diff) diffs.push(diff);
        }
      }
    }
  }

  return { toolCalls, completedResults, output, diffs };
}
