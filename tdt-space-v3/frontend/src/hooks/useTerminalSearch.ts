import { useState, useCallback, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { SearchAddon } from '@xterm/addon-search';

export interface SearchOptions {
  caseSensitive: boolean;
  regex: boolean;
  wholeWord: boolean;
}

export interface UseTerminalSearchReturn {
  isSearchOpen: boolean;
  matchCount: number;
  currentMatchIndex: number;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  findNext: () => void;
  findPrevious: () => void;
  searchTerm: (query: string, options: SearchOptions) => void;
}

export const useTerminalSearch = (
  terminal: React.MutableRefObject<Terminal | null>,
  searchAddon: React.MutableRefObject<SearchAddon | null>
): UseTerminalSearchReturn => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const lastQuery = useRef<string>('');
  const lastOptions = useRef<SearchOptions>({
    caseSensitive: false,
    regex: false,
    wholeWord: false,
  });

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setMatchCount(0);
    setCurrentMatchIndex(0);
  }, []);

  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => !prev);
  }, []);

  const searchTerm = useCallback((query: string, options: SearchOptions) => {
    if (!terminal.current || !searchAddon.current) return;

    lastQuery.current = query;
    lastOptions.current = options;

    if (!query) {
      searchAddon.current.clearDecorations();
      setMatchCount(0);
      setCurrentMatchIndex(0);
      return;
    }

    // Build search regex based on options
    let searchRegex: RegExp;
    const flags = options.caseSensitive ? 'g' : 'gi';

    if (options.regex) {
      try {
        searchRegex = new RegExp(query, flags);
      } catch (e) {
        console.error('Invalid regex:', e);
        return;
      }
    } else {
      // Escape special regex characters
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchRegex = new RegExp(escaped, flags);
    }

    if (options.wholeWord) {
      searchRegex = new RegExp(`\\b${searchRegex.source}\\b`, flags);
    }

    // Get terminal content
    const buffer = terminal.current.buffer.active;
    const content: string[] = [];

    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        content.push(line.translateToString());
      }
    }

    const fullContent = content.join('\n');
    const matches = fullContent.match(searchRegex);

    if (matches && matches.length > 0) {
      setMatchCount(matches.length);
      setCurrentMatchIndex(0);

      // Find and highlight first match
      searchAddon.current.findNext(query, {
        caseSensitive: options.caseSensitive,
        matchWholeWord: options.wholeWord,
        regex: options.regex,
      } as any);
    } else {
      setMatchCount(0);
      setCurrentMatchIndex(0);
    }
  }, [terminal, searchAddon]);

  const findNext = useCallback(() => {
    if (!terminal.current || !searchAddon.current || !lastQuery.current) return;

    const found = searchAddon.current.findNext(lastQuery.current, {
      caseSensitive: lastOptions.current.caseSensitive,
      matchWholeWord: lastOptions.current.wholeWord,
      regex: lastOptions.current.regex,
    } as any);

    if (found) {
      setCurrentMatchIndex((prev) => (prev + 1) % matchCount || prev);
    }
  }, [terminal, searchAddon, matchCount]);

  const findPrevious = useCallback(() => {
    if (!terminal.current || !searchAddon.current || !lastQuery.current) return;

    const found = searchAddon.current.findPrevious(lastQuery.current, {
      caseSensitive: lastOptions.current.caseSensitive,
      matchWholeWord: lastOptions.current.wholeWord,
      regex: lastOptions.current.regex,
    } as any);

    if (found) {
      setCurrentMatchIndex((prev) => (prev - 1 + matchCount) % matchCount || prev);
    }
  }, [terminal, searchAddon, matchCount]);

  return {
    isSearchOpen,
    matchCount,
    currentMatchIndex,
    openSearch,
    closeSearch,
    toggleSearch,
    findNext,
    findPrevious,
    searchTerm,
  };
};
