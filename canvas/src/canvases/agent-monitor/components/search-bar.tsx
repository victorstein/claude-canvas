/**
 * SearchBar Component for Agent Monitor
 *
 * A search input bar that appears when user presses '/'
 * Filters content items based on the search query.
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { THEME } from "../theme";

interface SearchBarProps {
  /** Whether search mode is active */
  active: boolean;
  /** Current search query */
  query: string;
  /** Callback when query changes */
  onQueryChange: (query: string) => void;
  /** Callback when search is cancelled (Esc) */
  onCancel: () => void;
  /** Callback when search is submitted (Enter) */
  onSubmit: () => void;
  /** Number of matches found */
  matchCount?: number;
  /** Width of the search bar */
  width?: number;
}

export function SearchBar({
  active,
  query,
  onQueryChange,
  onCancel,
  onSubmit,
  matchCount = 0,
  width = 40,
}: SearchBarProps) {
  // Handle keyboard input when active
  useInput(
    (input, key) => {
      if (!active) return;

      if (key.escape) {
        onCancel();
        return;
      }

      if (key.return) {
        onSubmit();
        return;
      }

      if (key.backspace || key.delete) {
        onQueryChange(query.slice(0, -1));
        return;
      }

      // Add printable characters
      if (input && !key.ctrl && !key.meta) {
        onQueryChange(query + input);
      }
    },
    { isActive: active }
  );

  if (!active) return null;

  return (
    <Box
      borderStyle="round"
      borderColor={THEME.neonCyan}
      paddingX={1}
      width={width}
    >
      <Text color={THEME.neonCyan}>/</Text>
      <Text color={THEME.text}>{query}</Text>
      <Text color={THEME.dim}>█</Text>
      <Box flexGrow={1} />
      {query.length > 0 && (
        <Text color={matchCount > 0 ? THEME.neonGreen : THEME.neonRed}>
          {matchCount} {matchCount === 1 ? "match" : "matches"}
        </Text>
      )}
    </Box>
  );
}

/**
 * Hook to manage search state
 */
export function useSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const startSearch = () => {
    setIsSearching(true);
    setSearchQuery("");
  };

  const cancelSearch = () => {
    setIsSearching(false);
    setSearchQuery("");
  };

  const submitSearch = () => {
    // Keep search active with current query
    // User can press Esc to clear
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  return {
    isSearching,
    searchQuery,
    startSearch,
    cancelSearch,
    submitSearch,
    setSearchQuery,
    clearSearch,
  };
}

/**
 * Filter function for content items based on search query
 */
export function matchesSearch(
  text: string,
  query: string,
  caseSensitive: boolean = false
): boolean {
  if (!query) return true;

  const searchText = caseSensitive ? text : text.toLowerCase();
  const searchQuery = caseSensitive ? query : query.toLowerCase();

  return searchText.includes(searchQuery);
}

/**
 * Highlight matching text in a string
 */
export function highlightMatch(
  text: string,
  query: string,
  highlightColor: string = THEME.neonYellow
): React.ReactNode {
  if (!query) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <Text color={highlightColor} bold>
        {match}
      </Text>
      {after}
    </>
  );
}
