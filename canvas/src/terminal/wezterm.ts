/**
 * WezTerm pane operations for canvas management.
 */

import { spawn, spawnSync } from "child_process";
import type { PaneOperations, CreatePaneOptions } from "./types";

const WEZTERM_PANE_FILE = "/tmp/claude-canvas-wezterm-pane-id";

/**
 * Get the stored canvas pane ID for WezTerm.
 */
export async function getWeztermPaneId(): Promise<string | null> {
  try {
    const file = Bun.file(WEZTERM_PANE_FILE);
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
 * Save the canvas pane ID for WezTerm.
 */
export async function saveWeztermPaneId(paneId: string): Promise<void> {
  await Bun.write(WEZTERM_PANE_FILE, paneId);
}

/**
 * Clear the stored WezTerm pane ID.
 */
export async function clearWeztermPaneId(): Promise<void> {
  await Bun.write(WEZTERM_PANE_FILE, "");
}

interface WeztermPane {
  pane_id: number;
  tab_id: number;
  window_id: number;
  workspace: string;
  size: { rows: number; cols: number };
  cursor_x: number;
  cursor_y: number;
  cursor_visibility: string;
  left_col: number;
  top_row: number;
  is_active: boolean;
  is_zoomed: boolean;
  tty_name: string;
  title: string;
  cwd: string;
}

/**
 * WezTerm implementation of PaneOperations.
 */
export class WeztermOperations implements PaneOperations {
  async verifyPane(paneId: string): Promise<boolean> {
    try {
      // Use wezterm cli list to check if pane exists
      const result = spawnSync("wezterm", ["cli", "list", "--format", "json"]);
      if (result.status !== 0) return false;

      const panes: WeztermPane[] = JSON.parse(result.stdout.toString());
      return panes.some((p) => String(p.pane_id) === paneId);
    } catch {
      return false;
    }
  }

  async createPane(
    command: string,
    options?: CreatePaneOptions
  ): Promise<string> {
    const percent = options?.splitPercent ?? 67;
    const direction = options?.direction === "bottom" ? "--bottom" : "--right";

    return new Promise((resolve, reject) => {
      // wezterm cli split-pane --right --percent 67 -- bash -c "command"
      const args = [
        "cli",
        "split-pane",
        direction,
        "--percent",
        String(percent),
        "--",
        "bash",
        "-c",
        command,
      ];

      const proc = spawn("wezterm", args);
      let output = "";
      let stderr = "";

      proc.stdout?.on("data", (data) => {
        output += data.toString();
      });

      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", async (code) => {
        if (code === 0 && output.trim()) {
          const paneId = output.trim();
          await saveWeztermPaneId(paneId);
          resolve(paneId);
        } else {
          reject(
            new Error(`Failed to create WezTerm pane: ${stderr || "unknown error"}`)
          );
        }
      });

      proc.on("error", (err) => reject(err));
    });
  }

  async sendCommand(paneId: string, command: string): Promise<boolean> {
    return new Promise((resolve) => {
      // wezterm cli send-text --pane-id X --no-paste "command\n"
      const args = [
        "cli",
        "send-text",
        "--pane-id",
        paneId,
        "--no-paste",
        command + "\n",
      ];

      const proc = spawn("wezterm", args);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }

  async interruptAndSend(paneId: string, command: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Send Ctrl+C first (ASCII 3)
      const ctrlCArgs = [
        "cli",
        "send-text",
        "--pane-id",
        paneId,
        "--no-paste",
        "\x03",
      ];

      const ctrlCProc = spawn("wezterm", ctrlCArgs);

      ctrlCProc.on("close", (code) => {
        if (code !== 0) {
          resolve(false);
          return;
        }

        // Wait briefly for process to terminate
        setTimeout(async () => {
          // Send clear && command
          const success = await this.sendCommand(
            paneId,
            `clear && ${command}`
          );
          resolve(success);
        }, 150);
      });

      ctrlCProc.on("error", () => resolve(false));
    });
  }

  async killPane(paneId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("wezterm", ["cli", "kill-pane", "--pane-id", paneId]);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }
}
