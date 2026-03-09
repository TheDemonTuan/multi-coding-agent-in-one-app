/**
 * OSC 133 Shell Integration Parser
 *
 * OSC 133 is a standard for shell integration that allows terminal emulators
 * to detect prompt boundaries, command execution, and exit codes.
 *
 * Supported sequences:
 *   \x1b]133;A\x07  — Prompt start (PS1 rendered)
 *   \x1b]133;B\x07  — Command start (user is typing)
 *   \x1b]133;C\x07  — Pre-execution (command accepted, output begins)
 *   \x1b]133;D;{exitCode}\x07 — Command finished with exit code
 *
 * Compatible shells:
 *   - PowerShell 7+ (built-in)
 *   - zsh (with shell integration scripts)
 *   - bash (with shell integration scripts)
 *   - fish (built-in)
 */

export type OSC133Marker = 'A' | 'B' | 'C' | 'D';

export interface CommandBlock {
    id: string;
    /** Terminal row where the prompt started */
    promptRow: number;
    /** Terminal row where command output started */
    outputRow?: number;
    /** Exit code from OSC 133;D marker */
    exitCode?: number;
    /** Whether the command completed */
    isFinished: boolean;
}

// Regex to match OSC 133 sequences.
// Supports both BEL (\x07) and ST (\x1b\\) terminators.
const OSC133_REGEX = /\x1b\]133;([A-D])(?:;(\d+))?(?:\x07|\x1b\\)/g;

/**
 * Strips OSC 133 escape sequences from a data string.
 * Returns the cleaned string and an array of matched markers with their values.
 */
export function parseOSC133(
    data: string
): { cleaned: string; markers: Array<{ type: OSC133Marker; value?: number }> } {
    const markers: Array<{ type: OSC133Marker; value?: number }> = [];

    const cleaned = data.replace(OSC133_REGEX, (_match, type: string, valueStr?: string) => {
        const marker = type as OSC133Marker;
        const value = valueStr !== undefined ? parseInt(valueStr, 10) : undefined;
        markers.push({ type: marker, value });
        return ''; // Strip from data stream
    });

    return { cleaned, markers };
}

/**
 * CommandBlockTracker maintains state of OSC 133 command blocks
 * across terminal data events.
 */
export class CommandBlockTracker {
    private blocks: CommandBlock[] = [];
    private currentBlock: CommandBlock | null = null;
    private getCurrentRow: () => number;

    constructor(getCurrentRow: () => number) {
        this.getCurrentRow = getCurrentRow;
    }

    /**
     * Process OSC 133 markers and update block state.
     */
    processMarkers(markers: Array<{ type: OSC133Marker; value?: number }>): void {
        for (const { type, value } of markers) {
            switch (type) {
                case 'A': {
                    // Prompt start — open a new command block
                    this.currentBlock = {
                        id: Math.random().toString(36).substring(2, 9),
                        promptRow: this.getCurrentRow(),
                        isFinished: false,
                    };
                    this.blocks.push(this.currentBlock);
                    // Prune oldest blocks to prevent unbounded growth (max 500 entries)
                    if (this.blocks.length > 500) {
                        this.blocks.splice(0, this.blocks.length - 500);
                    }
                    break;
                }
                case 'B': {
                    // Command start — user typing
                    break;
                }
                case 'C': {
                    // Pre-execution — output begins
                    if (this.currentBlock) {
                        this.currentBlock.outputRow = this.getCurrentRow();
                    }
                    break;
                }
                case 'D': {
                    // Command finished
                    if (this.currentBlock) {
                        this.currentBlock.exitCode = value ?? 0;
                        this.currentBlock.isFinished = true;
                        this.currentBlock = null;
                    }
                    break;
                }
            }
        }
    }

    /** Get all completed and in-progress command blocks */
    getBlocks(): Readonly<CommandBlock[]> {
        return this.blocks;
    }

    /** Get prompt rows for navigation */
    getPromptRows(): number[] {
        return this.blocks.map((b) => b.promptRow);
    }

    /** Clear all tracked blocks (e.g., on terminal clear) */
    clear(): void {
        this.blocks = [];
        this.currentBlock = null;
    }
}
