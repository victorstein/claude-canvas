/**
 * Terminal multiplexer types and interfaces for canvas pane management.
 */

export type MultiplexerType = "tmux" | "wezterm" | "none";

export interface TerminalEnvironment {
  multiplexer: MultiplexerType;
  inTmux: boolean;
  inWezterm: boolean;
  summary: string;
}

export interface CreatePaneOptions {
  /** Percentage of terminal width for new pane (default: 67) */
  splitPercent?: number;
  /** Direction: right (horizontal split) or bottom (vertical split) */
  direction?: "right" | "bottom";
}

/**
 * Interface for terminal multiplexer pane operations.
 * Implemented by TmuxOperations and WeztermOperations.
 */
export interface PaneOperations {
  /** Check if an existing pane is still valid */
  verifyPane(paneId: string): Promise<boolean>;

  /** Create a new split pane running the command, returns pane ID */
  createPane(command: string, options?: CreatePaneOptions): Promise<string>;

  /** Send a command/text to an existing pane */
  sendCommand(paneId: string, command: string): Promise<boolean>;

  /** Interrupt current process (Ctrl+C) and send new command */
  interruptAndSend(paneId: string, command: string): Promise<boolean>;

  /** Kill/close a pane */
  killPane(paneId: string): Promise<boolean>;
}

export interface SpawnResult {
  method: MultiplexerType;
  pid?: number;
}

export interface SpawnOptions {
  socketPath?: string;
  scenario?: string;
}
