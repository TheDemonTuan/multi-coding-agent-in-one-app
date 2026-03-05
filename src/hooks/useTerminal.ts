import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

export interface UseTerminalOptions {
  onData?: (data: string) => void;
  onWrite?: (data: string) => void;
}

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement>,
  options: UseTerminalOptions = {}
) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
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
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Create ResizeObserver once and store in ref - prevents leak on remount
    if (!resizeObserverRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (fitAddonRef.current && terminalRef.current) {
          fitAddonRef.current.fit();
        }
      });
    }
    resizeObserverRef.current.observe(containerRef.current);

    return () => {
      // Disconnect resize observer but don't destroy it - reuse on remount
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      terminal.dispose();
    };
  }, []);

  const write = (data: string) => {
    terminalRef.current?.write(data);
  };

  const sendData = (data: string) => {
    terminalRef.current?.input(data);
  };

  const focus = () => {
    terminalRef.current?.focus();
  };

  const clear = () => {
    terminalRef.current?.clear();
  };

  return {
    terminal: terminalRef.current,
    write,
    sendData,
    focus,
    clear,
  };
}
