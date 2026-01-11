/**
 * Cyberpunk Theme for Agent Monitor
 *
 * Consistent color palette inspired by the flight canvas.
 */

export const THEME = {
  // Primary colors
  neonCyan: "cyan",
  neonMagenta: "magenta",
  neonGreen: "green",
  neonYellow: "yellow",
  neonRed: "red",
  neonBlue: "blue",

  // Neutral colors
  dim: "gray",
  dimmer: "blackBright",
  bg: "black",
  text: "white",

  // Semantic colors
  running: "yellow",
  completed: "green",
  error: "red",
  pending: "gray",

  // UI colors
  border: "cyan",
  borderDim: "gray",
  activeBg: "blue",
  activeText: "white",
  header: "magenta",
  label: "cyan",
} as const;

/**
 * Spinner frames for animated loading indicator
 */
export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Alternative spinner styles
 */
export const SPINNER_STYLES = {
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  line: ["-", "\\", "|", "/"],
  circle: ["◐", "◓", "◑", "◒"],
  bounce: ["⠁", "⠂", "⠄", "⠂"],
  pulse: ["█", "▓", "▒", "░", "▒", "▓"],
} as const;

/**
 * Get status color from theme
 */
export function getStatusColor(status: "running" | "completed" | "error"): string {
  return THEME[status];
}

/**
 * Get age-based dimming color
 * Returns progressively dimmer colors for older content
 */
export function getAgeColor(ageMs: number): string {
  const seconds = ageMs / 1000;

  if (seconds < 5) return THEME.text;        // Fresh: white
  if (seconds < 30) return THEME.dim;        // Recent: gray
  return THEME.dimmer;                        // Old: dark gray
}
