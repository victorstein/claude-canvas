/**
 * Tmux pane operations for canvas management.
 */

import { spawn, spawnSync } from "child_process";
import type { PaneOperations, CreatePaneOptions } from "./types";

const TMUX_PANE_FILE = "/tmp/claude-canvas-tmux-pane-id";

/**
 * Get the stored canvas pane ID for tmux.
 */
export async function getTmuxPaneId(): Promise<string | null> {
  try {
    const file = Bun.file(TMUX_PANE_FILE);
    if (await file.exists()) {
      const paneId = (await file.text()).trim();
      if (paneId) {
        return paneId;
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Save the canvas pane ID for tmux.
 */
export async function saveTmuxPaneId(paneId: string): Promise<void> {
  await Bun.write(TMUX_PANE_FILE, paneId);
}

/**
 * Clear the stored tmux pane ID.
 */
export async function clearTmuxPaneId(): Promise<void> {
  await Bun.write(TMUX_PANE_FILE, "");
}

/**
 * Tmux implementation of PaneOperations.
 */
export class TmuxOperations implements PaneOperations {
  async verifyPane(paneId: string): Promise<boolean> {
    try {
      const result = spawnSync("tmux", [
        "display-message",
        "-t",
        paneId,
        "-p",
        "#{pane_id}",
      ]);
      const output = result.stdout?.toString().trim();
      // Pane exists only if command succeeds AND returns the same pane ID
      return result.status === 0 && output === paneId;
    } catch {
      return false;
    }
  }

  async createPane(
    command: string,
    options?: CreatePaneOptions
  ): Promise<string> {
    const percent = options?.splitPercent ?? 67;
    const direction = options?.direction === "bottom" ? "-v" : "-h";

    return new Promise((resolve, reject) => {
      // Use split-window for side-by-side split
      // -p gives canvas specified width percentage
      // -P -F prints the new pane ID so we can save it
      const args = [
        "split-window",
        direction,
        "-p",
        String(percent),
        "-P",
        "-F",
        "#{pane_id}",
        command,
      ];

      const proc = spawn("tmux", args);
      let paneId = "";

      proc.stdout?.on("data", (data) => {
        paneId += data.toString();
      });

      proc.on("close", async (code) => {
        if (code === 0 && paneId.trim()) {
          const id = paneId.trim();
          await saveTmuxPaneId(id);
          resolve(id);
        } else {
          reject(new Error("Failed to create tmux pane"));
        }
      });

      proc.on("error", (err) => reject(err));
    });
  }

  async sendCommand(paneId: string, command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const args = ["send-keys", "-t", paneId, command, "Enter"];
      const proc = spawn("tmux", args);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }

  async interruptAndSend(paneId: string, command: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Send Ctrl+C to interrupt any running process
      const killProc = spawn("tmux", ["send-keys", "-t", paneId, "C-c"]);

      killProc.on("close", () => {
        // Wait for process to terminate before sending new command
        setTimeout(() => {
          // Clear the terminal and run the new command
          const args = [
            "send-keys",
            "-t",
            paneId,
            `clear && ${command}`,
            "Enter",
          ];
          const proc = spawn("tmux", args);
          proc.on("close", (code) => resolve(code === 0));
          proc.on("error", () => resolve(false));
        }, 150);
      });

      killProc.on("error", () => resolve(false));
    });
  }

  async killPane(paneId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("tmux", ["kill-pane", "-t", paneId]);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }
}
