/**
 * Terminal multiplexer abstraction layer.
 *
 * Supports both tmux and WezTerm for spawning canvas panes.
 */

import {
  TmuxOperations,
  getTmuxPaneId,
  clearTmuxPaneId,
} from "./tmux";
import {
  WeztermOperations,
  getWeztermPaneId,
  clearWeztermPaneId,
} from "./wezterm";
import type {
  TerminalEnvironment,
  PaneOperations,
  SpawnResult,
  SpawnOptions,
  MultiplexerType,
} from "./types";

// Re-export types
export * from "./types";

/**
 * Detect the current terminal multiplexer environment.
 */
export function detectTerminal(): TerminalEnvironment {
  const inTmux = !!process.env.TMUX;
  const inWezterm = !!process.env.WEZTERM_PANE;

  let multiplexer: MultiplexerType = "none";
  let summary = "no terminal multiplexer";

  if (inTmux) {
    multiplexer = "tmux";
    summary = "tmux";
  } else if (inWezterm) {
    multiplexer = "wezterm";
    summary = "wezterm";
  }

  return { multiplexer, inTmux, inWezterm, summary };
}

/**
 * Get the pane operations instance for the current multiplexer.
 * Returns null if no multiplexer is available.
 */
export function getOperations(): PaneOperations | null {
  const env = detectTerminal();
  switch (env.multiplexer) {
    case "tmux":
      return new TmuxOperations();
    case "wezterm":
      return new WeztermOperations();
    default:
      return null;
  }
}

/**
 * Get the stored canvas pane ID for the current multiplexer.
 */
async function getCanvasPaneId(
  multiplexer: MultiplexerType
): Promise<string | null> {
  switch (multiplexer) {
    case "tmux":
      return getTmuxPaneId();
    case "wezterm":
      return getWeztermPaneId();
    default:
      return null;
  }
}

/**
 * Clear the stored canvas pane ID for the current multiplexer.
 */
async function clearCanvasPaneId(multiplexer: MultiplexerType): Promise<void> {
  switch (multiplexer) {
    case "tmux":
      await clearTmuxPaneId();
      break;
    case "wezterm":
      await clearWeztermPaneId();
      break;
  }
}

/**
 * Spawn a canvas in a new pane.
 *
 * Supports both tmux and WezTerm. Will attempt to reuse an existing
 * canvas pane if one exists.
 */
export async function spawnCanvas(
  kind: string,
  id: string,
  configJson?: string,
  options?: SpawnOptions
): Promise<SpawnResult> {
  const env = detectTerminal();
  const ops = getOperations();

  if (!ops) {
    throw new Error(
      "Canvas requires a terminal multiplexer. " +
        "Please run inside tmux or WezTerm."
    );
  }

  // Get the directory of this script (skill directory)
  const scriptDir = import.meta.dir.replace("/terminal", "").replace("/src", "");
  const runScript = `${scriptDir}/run-canvas.sh`;

  // Auto-generate socket path for IPC if not provided
  const socketPath = options?.socketPath || `/tmp/canvas-${id}.sock`;

  // Build the command to run
  let command = `${runScript} show ${kind} --id ${id}`;
  if (configJson) {
    // Write config to a temp file to avoid shell escaping issues
    const configFile = `/tmp/canvas-config-${id}.json`;
    await Bun.write(configFile, configJson);
    command += ` --config "$(cat ${configFile})"`;
  }
  command += ` --socket ${socketPath}`;
  if (options?.scenario) {
    command += ` --scenario ${options.scenario}`;
  }

  // Try to reuse existing pane first
  const existingPaneId = await getCanvasPaneId(env.multiplexer);
  if (existingPaneId) {
    const valid = await ops.verifyPane(existingPaneId);
    if (valid) {
      const reused = await ops.interruptAndSend(existingPaneId, command);
      if (reused) {
        return { method: env.multiplexer };
      }
    }
    // Stale pane reference - clear it
    await clearCanvasPaneId(env.multiplexer);
  }

  // Create a new pane
  await ops.createPane(command, { splitPercent: 67 });
  return { method: env.multiplexer };
}
