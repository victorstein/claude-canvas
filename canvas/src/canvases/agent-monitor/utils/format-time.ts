/**
 * Time Formatting Utilities for Agent Monitor
 *
 * Provides relative time formatting (e.g., "2m ago", "just now")
 */

/**
 * Format a timestamp as relative time (e.g., "2m ago", "just now")
 */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp;

  if (diff < 0) {
    return "just now";
  }

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 5) {
    return "just now";
  }

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}h ago`;
    }
    return `${hours}h ${remainingMinutes}m ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format a duration in milliseconds as human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  if (minutes < 60) {
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  }

  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format a timestamp as short time (HH:MM:SS)
 */
export function formatShortTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}
