import React, { useState, useEffect, useRef, useCallback } from 'react';

interface TerminalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, options: SearchOptions) => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  matchCount: number;
  currentMatchIndex: number;
}

export interface SearchOptions {
  caseSensitive: boolean;
  regex: boolean;
  wholeWord: boolean;
}

export const TerminalSearch: React.FC<TerminalSearchProps> = ({
  isOpen,
  onClose,
  onSearch,
  onFindNext,
  onFindPrevious,
  matchCount,
  currentMatchIndex,
}) => {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    regex: false,
    wholeWord: false,
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          onFindPrevious();
        } else {
          onFindNext();
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          onFindPrevious();
        } else {
          onFindNext();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onFindNext, onFindPrevious]);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    if (newQuery) {
      onSearch(newQuery, options);
    }
  }, [onSearch, options]);

  const handleOptionToggle = (option: keyof SearchOptions) => {
    const newOptions = { ...options, [option]: !options[option] };
    setOptions(newOptions);

    if (query) {
      onSearch(query, newOptions);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.container}>
      <div style={styles.searchBar}>
        <div style={styles.searchInputWrapper}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Find in terminal..."
            style={styles.searchInput}
          />
          {matchCount > 0 && (
            <span style={styles.matchCounter}>
              {currentMatchIndex + 1} of {matchCount}
            </span>
          )}
        </div>

        <div style={styles.options}>
          <label style={styles.optionLabel}>
            <input
              type="checkbox"
              checked={options.caseSensitive}
              onChange={() => handleOptionToggle('caseSensitive')}
            />
            <span style={styles.optionText}>Case sensitive</span>
          </label>
          <label style={styles.optionLabel}>
            <input
              type="checkbox"
              checked={options.regex}
              onChange={() => handleOptionToggle('regex')}
            />
            <span style={styles.optionText}>Regex</span>
          </label>
          <label style={styles.optionLabel}>
            <input
              type="checkbox"
              checked={options.wholeWord}
              onChange={() => handleOptionToggle('wholeWord')}
            />
            <span style={styles.optionText}>Whole word</span>
          </label>
        </div>

        <div style={styles.actions}>
          <button
            onClick={onFindPrevious}
            disabled={matchCount === 0}
            style={{
              ...styles.navButton,
              ...(matchCount === 0 ? styles.disabledButton : {}),
            }}
            title="Previous match (Shift+F3)"
          >
            ↑ Prev
          </button>
          <button
            onClick={onFindNext}
            disabled={matchCount === 0}
            style={{
              ...styles.navButton,
              ...(matchCount === 0 ? styles.disabledButton : {}),
            }}
            title="Next match (F3)"
          >
            Next ↓
          </button>
          <button onClick={onClose} style={styles.closeButton}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    padding: '8px',
    backgroundColor: '#1e1e2e',
    borderBottom: '1px solid #45475a',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  searchInputWrapper: {
    flex: 1,
    position: 'relative',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#313244',
    border: '1px solid #45475a',
    borderRadius: '6px',
    color: '#cdd6f4',
    outline: 'none',
  },
  matchCounter: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '12px',
    color: '#a6adc8',
  },
  options: {
    display: 'flex',
    gap: '12px',
  },
  optionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#a6adc8',
    userSelect: 'none',
  },
  optionText: {
    fontSize: '12px',
  },
  actions: {
    display: 'flex',
    gap: '6px',
  },
  navButton: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: '#45475a',
    color: '#cdd6f4',
    border: '1px solid #585b70',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  disabledButton: {
    backgroundColor: '#313244',
    color: '#6c7086',
    borderColor: '#45475a',
    cursor: 'not-allowed',
  },
  closeButton: {
    padding: '6px 10px',
    fontSize: '14px',
    backgroundColor: 'transparent',
    color: '#a6adc8',
    border: '1px solid #45475a',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
