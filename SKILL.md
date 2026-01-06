---
name: claude-canvas
description: Control terminal TUIs to display graphics like calendars, documents, and dashboards with interactive scenarios
---

# claude-canvas

Spawn and control interactive terminal displays (TUIs) showing calendars, documents, and other visualizations in separate terminal windows. Supports interactive scenarios like meeting time picker and document editing with real-time IPC communication.

## Quick Start

```bash
cd .claude/skills/claude-canvas

# Run calendar in current terminal
bun run src/cli.ts show calendar

# Spawn calendar in new tmux split
bun run src/cli.ts spawn calendar

# Spawn meeting picker scenario
bun run src/cli.ts spawn calendar --scenario meeting-picker --config '{"calendars": [...]}'

# Check terminal environment
bun run src/cli.ts env
```

Or use the wrapper script:
```bash
./run-canvas.sh show calendar
./run-canvas.sh spawn calendar --scenario meeting-picker
```

## Scenarios

Each canvas type supports multiple scenarios that define different interaction modes.

### Calendar Scenarios

#### `display` (default)
View-only calendar display. User can navigate weeks but cannot select times.

```bash
bun run src/cli.ts show calendar --scenario display
```

#### `meeting-picker`
Interactive scenario for selecting a free time slot when viewing multiple people's calendars.

- Shows multiple calendars overlaid with different colors
- User can **click** on free slots to select a meeting time
- Selection is sent back to Claude via IPC
- Supports configurable time slot granularity (15/30/60 min)

```bash
bun run src/cli.ts show calendar --scenario meeting-picker --config '{
  "calendars": [
    {
      "name": "Alice",
      "color": "blue",
      "events": [
        {"id": "1", "title": "Meeting", "startTime": "2025-01-06T09:00:00", "endTime": "2025-01-06T10:00:00"}
      ]
    },
    {
      "name": "Bob",
      "color": "green",
      "events": [
        {"id": "2", "title": "Call", "startTime": "2025-01-06T14:00:00", "endTime": "2025-01-06T15:00:00"}
      ]
    }
  ],
  "slotGranularity": 30
}'
```

### Document Scenarios

#### `display` (default)
Read-only document view with markdown rendering. User can scroll but cannot select text.

```bash
./run-canvas.sh spawn document --scenario display --config '{
  "content": "# Hello World\n\nThis is **markdown** content.",
  "title": "My Document"
}'
```

#### `edit`
Interactive document view with text selection. User can click and drag to select text, which is sent to Claude via IPC in real-time.

- Renders markdown with syntax highlighting (headers, bold, italic, code, links, lists, blockquotes)
- Diff highlighting: green background for additions, red for deletions
- Click and drag to select text
- Selection automatically sent to Claude via IPC

```bash
./run-canvas.sh spawn document --scenario edit --config '{
  "content": "# My Blog Post\n\nThis is the **introduction** to my post.\n\n## Section One\n\n- Point one\n- Point two\n\n```javascript\nconst x = 42;\n```\n\n> A quote here\n\n[Link text](https://example.com)",
  "title": "Blog Post Draft",
  "diffs": [
    {"startOffset": 50, "endOffset": 62, "type": "add"}
  ]
}'
```

**Document Config:**
```typescript
interface DocumentConfig {
  content: string;        // Markdown content
  title?: string;         // Document title (shown in header)
  diffs?: DocumentDiff[]; // Optional diff markers for highlighting
  readOnly?: boolean;     // Disable selection (default: false for edit scenario)
}

interface DocumentDiff {
  startOffset: number;    // Character offset in content
  endOffset: number;
  type: "add" | "delete";
}
```

**Selection Result (sent via IPC):**
```typescript
interface DocumentSelection {
  selectedText: string;   // The selected text
  startOffset: number;    // Start character offset
  endOffset: number;      // End character offset
  startLine: number;      // Line number (1-based)
  endLine: number;
  startColumn: number;    // Column in start line
  endColumn: number;
}
```

### Flight Scenarios

#### `booking` (default)
Cyberpunk-themed flight comparison and seat selection interface.

- Shows flight options with airline, times, duration, and price
- Interactive seat map for seat selection
- Keyboard navigation between flights and seats
- Returns selected flight and seat via IPC

```bash
bun run src/cli.ts spawn flight --scenario booking --config '{
  "title": "// FLIGHT_BOOKING_TERMINAL //",
  "flights": [
    {
      "id": "ua123",
      "airline": "United Airlines",
      "flightNumber": "UA 123",
      "origin": {
        "code": "SFO",
        "name": "San Francisco International",
        "city": "San Francisco",
        "timezone": "PST"
      },
      "destination": {
        "code": "DEN",
        "name": "Denver International",
        "city": "Denver",
        "timezone": "MST"
      },
      "departureTime": "2026-01-08T12:55:00-08:00",
      "arrivalTime": "2026-01-08T16:37:00-07:00",
      "duration": 162,
      "price": 34500,
      "currency": "USD",
      "cabinClass": "economy",
      "aircraft": "Boeing 737-800",
      "stops": 0,
      "seatmap": {
        "rows": 30,
        "seatsPerRow": ["A", "B", "C", "D", "E", "F"],
        "aisleAfter": ["C"],
        "unavailable": ["1A", "1B", "1C", "1D", "1E", "1F"],
        "premium": ["2A", "2B", "2C", "2D", "2E", "2F"],
        "occupied": ["3A", "3C", "4B", "5D"]
      }
    }
  ]
}'
```

**Flight Config:**
```typescript
interface FlightConfig {
  flights: Flight[];
  title?: string;           // Header title
  showSeatmap?: boolean;    // Enable seat selection
  selectedFlightId?: string; // Pre-select a flight
}

interface Flight {
  id: string;
  airline: string;          // e.g., "United Airlines"
  flightNumber: string;     // e.g., "UA 123"
  origin: Airport;
  destination: Airport;
  departureTime: string;    // ISO datetime
  arrivalTime: string;      // ISO datetime
  duration: number;         // Minutes
  price: number;            // Cents
  currency: string;         // e.g., "USD"
  cabinClass: "economy" | "premium" | "business" | "first";
  aircraft?: string;        // e.g., "Boeing 737-800"
  stops: number;            // 0 = nonstop
  seatmap?: Seatmap;        // Optional seat selection
}

interface Airport {
  code: string;             // 3-letter code
  name: string;             // Full airport name
  city: string;
  timezone: string;
}

interface Seatmap {
  rows: number;
  seatsPerRow: string[];    // e.g., ["A", "B", "C", "D", "E", "F"]
  aisleAfter: string[];     // e.g., ["C"] = aisle after seat C
  unavailable: string[];    // Blocked seats
  premium: string[];        // Extra legroom/exit row
  occupied: string[];       // Already booked
}
```

**Flight Controls:**
- `↑/↓`: Navigate between flights
- `Tab`: Switch focus between flight list and seatmap
- `←/→/↑/↓` (in seatmap): Move seat cursor
- `Space`: Select/deselect seat
- `Enter`: Confirm selection
- `Shift+Enter`: Confirm immediately (skip countdown)
- `q` or `Esc`: Cancel

**Flight Result (sent via IPC):**
```typescript
interface FlightResult {
  selectedFlight: Flight;
  selectedSeat?: string;    // e.g., "12A"
}
```

## High-Level API (for programmatic use)

Use the API module for spawning interactive canvases with IPC:

```typescript
import { pickMeetingTime, displayCalendar, displayDocument, editDocument } from "./src/api";

// Spawn meeting picker and wait for user selection
const result = await pickMeetingTime({
  calendars: [
    { name: "Alice", color: "blue", events: [...] },
    { name: "Bob", color: "green", events: [...] },
  ],
  slotGranularity: 30,
  minDuration: 30,
  maxDuration: 120,
});

if (result.success && result.data) {
  console.log(`User selected: ${result.data.startTime} - ${result.data.endTime}`);
} else if (result.cancelled) {
  console.log("User cancelled selection");
} else {
  console.error(`Error: ${result.error}`);
}

// Spawn document editor and wait for user selection
const docResult = await editDocument({
  content: "# My Document\n\nEdit this **markdown** content.",
  title: "Draft",
  diffs: [{ startOffset: 20, endOffset: 30, type: "add" }],
});

if (docResult.success && docResult.data) {
  console.log(`User selected: "${docResult.data.selectedText}"`);
  console.log(`At position: ${docResult.data.startOffset}-${docResult.data.endOffset}`);
}
```

## Commands

### `show` - Run canvas in current terminal
```bash
bun run src/cli.ts show [kind] [--id ID] [--config JSON] [--socket PATH] [--scenario NAME]
```

Options:
- `--id`: Canvas instance ID
- `--config`: JSON configuration for the canvas
- `--socket`: Unix socket path for IPC (used internally)
- `--scenario`: Scenario name (e.g., "display", "meeting-picker")

### `spawn` - Open canvas in new tmux split
```bash
bun run src/cli.ts spawn [kind] [--id ID] [--config JSON] [--socket PATH] [--scenario NAME]
```

Opens the canvas in a tmux split pane (requires tmux). Reuses existing canvas pane if one exists.

### `env` - Show detected terminal environment
```bash
bun run src/cli.ts env
```

## IPC Communication

Interactive scenarios communicate with Claude via Unix domain sockets.

### Message Protocol

**Controller → Canvas:**
```typescript
{ type: "close" }           // Request canvas to close
{ type: "update", config }  // Update canvas configuration
{ type: "ping" }            // Ping for health check
```

**Canvas → Controller:**
```typescript
{ type: "ready", scenario }        // Canvas is ready
{ type: "selected", data }         // User made a selection
{ type: "cancelled", reason? }     // User cancelled
{ type: "error", message }         // Error occurred
{ type: "pong" }                   // Response to ping
```

## Calendar Controls

**Display scenario:**
- `←/→` or `h/l`: Navigate between days
- `n` or `PageDown`: Next week
- `p` or `PageUp`: Previous week
- `t`: Jump to today
- `q` or `Esc`: Quit

**Meeting picker scenario:**
- **Mouse click**: Select a free time slot
- `←/→`: Navigate weeks
- `t`: Jump to today
- `q` or `Esc`: Cancel selection

## Configuration Examples

### Basic Calendar Display
```json
{
  "title": "My Week",
  "events": [
    {
      "id": "1",
      "title": "Team Meeting",
      "startTime": "2025-01-06T09:00:00",
      "endTime": "2025-01-06T10:00:00",
      "color": "blue"
    },
    {
      "id": "2",
      "title": "Lunch",
      "startTime": "2025-01-06T12:00:00",
      "endTime": "2025-01-06T13:00:00",
      "color": "green"
    }
  ]
}
```

### Meeting Picker Config
```json
{
  "calendars": [
    {
      "name": "Alice",
      "color": "blue",
      "events": [
        {"id": "1", "title": "Standup", "startTime": "2025-01-06T09:00:00", "endTime": "2025-01-06T09:30:00"}
      ]
    },
    {
      "name": "Bob",
      "color": "magenta",
      "events": [
        {"id": "2", "title": "1:1", "startTime": "2025-01-06T14:00:00", "endTime": "2025-01-06T15:00:00"}
      ]
    }
  ],
  "slotGranularity": 30,
  "minDuration": 30,
  "maxDuration": 120
}
```

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│    Claude Code      │◄───────►│   claude-canvas     │
│    (controller)     │   IPC   │   (Bun/TypeScript)  │
└─────────────────────┘  socket └──────────┬──────────┘
        │                                  │
        │ spawn                            ▼
        │                           ┌──────────────┐
        └──────────────────────────►│ Scenario UI  │
                                    │ (Ink/React)  │
                                    └──────────────┘
```

## Tech Stack

- **Bun** - JavaScript runtime
- **TypeScript** - Language
- **Ink** - React-based TUI framework
- **Commander** - CLI framework

## Tips for Claude

When using this skill:

1. **Use `spawn` with `--scenario`** - Opens interactive canvases in a tmux split pane
2. **Use the API for IPC** - `pickMeetingTime()` handles socket setup automatically
3. **Requires tmux** - Canvas spawning only works inside a tmux session
4. **Pass JSON config** - Customize calendars with events and options
5. **Pane reuse** - The same split pane is reused for subsequent canvases
6. **For meeting picker** - Pass `calendars` array with each person's busy times
