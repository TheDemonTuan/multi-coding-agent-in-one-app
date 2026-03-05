import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface TerminalProcessOptions {
  cwd: string;
  env?: Record<string, string>;
  shell?: string;
}

export class TerminalProcess extends EventEmitter {
  private process: ChildProcess | null = null;
  private pid: number | null = null;

  start(options: TerminalProcessOptions): number | null {
    const shell = options.shell || (process.platform === 'win32' ? 'powershell.exe' : 'bash');
    
    this.process = spawn(shell, [], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.pid = this.process.pid || null;

    this.process.stdout?.on('data', (data: Buffer) => {
      this.emit('data', data.toString('utf8'));
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      this.emit('data', data.toString('utf8'));
    });

    this.process.on('exit', (code) => {
      this.emit('exit', code);
    });

    this.process.on('error', (err) => {
      this.emit('error', err);
    });

    return this.pid;
  }

  write(data: string): void {
    if (this.process?.stdin) {
      this.process.stdin.write(data);
    }
  }

  resize(cols: number, rows: number): void {
    // Windows conpty resize via ANSI escape sequence
    // This is a simplified version
  }

  kill(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  getPid(): number | null {
    return this.pid;
  }
}
