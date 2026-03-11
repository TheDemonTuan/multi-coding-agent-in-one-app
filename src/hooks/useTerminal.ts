import { useEffect, useRef } from 'react';
import { Terminal, ITerminalOptions } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

export interface UseTerminalOptions {
  onData?: (data: string) => void;
  onWrite?: (data: string) => void;
}

// Optimized terminal options for better performance (VAL-PERF-008)
// Option C: Balanced - performance optimizations
const OPTIMIZED_OPTIONS: ITerminalOptions = {
  cursorBlink: true,
  fontSize: 14,
  fontFamily: '"Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
  theme: {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#f5c2e7',
    cyan: '#94e2d5',
    white: '#bac2de',
  },
  allowProposedApi: true,
  // Configure scrollback buffer to prevent memory bloat (VAL-PERF-002)
  scrollback: 300, // Updated for Option C: Balanced performance optimization

  // Performance optimizations (VAL-PERF-008)
  drawBoldTextInBrightColors: false, // Disable to reduce rendering overhead
  minimumContrastRatio: 1, // Skip contrast recalculation for performance
  
  // Smooth scrolling improvements - disabled for instant scroll response (Option C)
  fastScrollSensitivity: 10, // Increased for faster scroll
  smoothScrollDuration: 0, // Disabled for instant scroll response
  
  // Additional performance optimizations
  convertEol: true, // Reduce parsing overhead
};

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement>,
  options: UseTerminalOptions = {}
) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal(OPTIMIZED_OPTIONS);

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    // Use canvas rendering only - WebGL causes issues on many systems
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Create ResizeObserver per instance and clean up on unmount
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current) {
        // Use requestAnimationFrame for smoother resize (VAL-PERF-008)
        requestAnimationFrame(() => {
          fitAddonRef.current?.fit();
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      // Disconnect ResizeObserver on unmount
      resizeObserver.disconnect();
      // Dispose terminal - this will also dispose all other addons
      terminal.dispose();
    };
  }, []);

  return {
    terminal: terminalRef.current,
    fitAddon: fitAddonRef.current,
  };
}
