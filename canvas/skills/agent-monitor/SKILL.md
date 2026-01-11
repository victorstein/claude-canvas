---
name: agent-monitor
description: |
  Real-time monitoring of Claude Code sub-agent activity in a tabbed terminal interface.
  Auto-spawns as soon as any sub-agent starts running.
---

# Agent Monitor Canvas

Displays real-time sub-agent activity with:
- Tabbed interface (one tab per agent)
- Scrollable output streams
- Tool call display with results
- Git diff visualization

## Auto-Spawn Behavior

The monitor automatically spawns as soon as Claude Code dispatches any sub-agent using the Task tool. It uses Claude Code hooks to detect agent lifecycle events:

- **PreToolUse hook**: Detects when Task tool is invoked
- **SubagentStop hook**: Tracks when agents complete

## Manual Usage

```bash
# Show agent monitor in current terminal
bun run src/cli.ts show agent-monitor --scenario monitor

# Spawn agent monitor in a new WezTerm/tmux pane
bun run src/cli.ts spawn agent-monitor --scenario monitor

# With initial configuration
bun run src/cli.ts spawn agent-monitor --scenario monitor --config '{
  "parentSessionId": "session-123",
  "agents": {}
}'
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| Tab | Switch to next agent tab |
| 1-9 | Jump to agent by number |
| ↑/↓ | Scroll content up/down |
| PgUp/PgDn | Fast scroll (10 lines) |
| g | Jump to top |
| G | Jump to bottom |
| q/Esc | Close monitor |

## Status Indicators

Each tab shows a status indicator:
- 🟡 Yellow: Agent is running
- 🟢 Green: Agent completed successfully
- 🔴 Red: Agent encountered an error

## Content Display

For each agent, the monitor displays:

1. **Output Stream**: Text output from the agent's thinking and responses
2. **Tool Calls**: Each tool invocation with:
   - Tool name (highlighted in cyan)
   - Input parameters (truncated preview)
   - Status icon (✓ success, ✗ error, ⋯ pending)
   - Result (if available)
3. **Git Diffs**: File changes with syntax highlighting:
   - Green for additions (+)
   - Red for deletions (-)
   - Cyan for hunk headers (@@)

## Configuration

```typescript
interface AgentMonitorConfig {
  parentSessionId: string;
  agents: Record<string, AgentState>;
}

interface AgentState {
  id: string;                    // Unique agent identifier
  description: string;           // Task description
  status: "running" | "completed" | "error";
  startTime: number;             // Unix timestamp
  endTime: number | null;
  toolCalls: ToolCallRecord[];
  gitDiffs: DiffRecord[];
  output: string[];
}
```

## Hook Configuration

The plugin uses the following hooks (defined in `hooks/hooks.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"${CLAUDE_PLUGIN_ROOT}/src/hooks/pre-tool-use.ts\""
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun \"${CLAUDE_PLUGIN_ROOT}/src/hooks/subagent-stop.ts\""
          }
        ]
      }
    ]
  }
}
```

## Tracking File

Agent state is stored in `/tmp/claude-agents-{session}.json` and includes:
- Parent session ID
- Canvas pane ID (when spawned)
- Socket path for IPC
- All tracked agents with their current state

## Example Prompts

- "Run these three tasks in parallel and show me the monitor"
- "I want to see what the sub-agents are doing"
- "Open the agent activity viewer"
