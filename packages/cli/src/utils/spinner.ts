/**
 * Progress spinner for long-running CLI operations.
 * Gracefully degrades in non-TTY environments.
 */

import { Style, Symbols, AsciiSymbol, styled, shouldUseColor, isTTY } from './ui.js';

// Braille spinner frames for smooth animation
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// ASCII fallback frames
const ASCII_FRAMES = ['-', '\\', '|', '/'];

export interface SpinnerOptions {
  color?: string;
  interval?: number;
}

/**
 * Spinner class for indeterminate progress
 */
export class Spinner {
  private message: string;
  private intervalId?: ReturnType<typeof setInterval>;
  private frameIndex = 0;
  private useColor: boolean;
  private frames: string[];
  private color: string;
  private interval: number;
  private started = false;

  constructor(message: string, options: SpinnerOptions = {}) {
    this.message = message;
    this.useColor = shouldUseColor();
    this.frames = this.useColor ? SPINNER_FRAMES : ASCII_FRAMES;
    this.color = options.color || Style.TEXT_INFO;
    this.interval = options.interval || 80;
  }

  /**
   * Start the spinner
   */
  start(): this {
    if (this.started) return this;
    this.started = true;

    if (!isTTY()) {
      // Non-TTY: print message once
      console.log(this.message);
      return this;
    }

    // Hide cursor
    process.stdout.write('\x1b[?25l');

    this.intervalId = setInterval(() => {
      const frame = this.frames[this.frameIndex];
      const styledFrame = this.useColor ? styled(frame, this.color) : frame;
      process.stdout.write(`\r${styledFrame} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, this.interval);

    return this;
  }

  /**
   * Update the spinner message
   */
  update(message: string): this {
    this.message = message;
    if (!isTTY()) {
      console.log(message);
    }
    return this;
  }

  /**
   * Stop with success
   */
  success(message?: string): void {
    this.stop();
    const icon = this.useColor ? styled(Symbols.SUCCESS, Style.TEXT_SUCCESS) : AsciiSymbol.SUCCESS;
    console.log(`${icon} ${message || this.message}`);
  }

  /**
   * Stop with failure
   */
  fail(message?: string): void {
    this.stop();
    const icon = this.useColor ? styled(Symbols.FAILURE, Style.TEXT_DANGER) : AsciiSymbol.FAILURE;
    console.log(`${icon} ${message || this.message}`);
  }

  /**
   * Stop with warning
   */
  warn(message?: string): void {
    this.stop();
    const icon = this.useColor ? styled(Symbols.WARNING, Style.TEXT_WARNING) : AsciiSymbol.WARNING;
    console.log(`${icon} ${message || this.message}`);
  }

  /**
   * Stop with info
   */
  info(message?: string): void {
    this.stop();
    const icon = this.useColor ? styled(Symbols.INFO, Style.TEXT_INFO) : AsciiSymbol.INFO;
    console.log(`${icon} ${message || this.message}`);
  }

  /**
   * Stop the spinner without status
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    if (isTTY()) {
      // Clear line and show cursor
      process.stdout.write('\r\x1b[K');
      process.stdout.write('\x1b[?25h');
    }

    this.started = false;
  }
}

/**
 * Create and start a spinner
 */
export function spinner(message: string, options?: SpinnerOptions): Spinner {
  return new Spinner(message, options).start();
}

/**
 * Progress bar for determinate progress
 */
export interface ProgressBarOptions {
  total: number;
  width?: number;
  showPercentage?: boolean;
  showCount?: boolean;
}

export class ProgressBar {
  private current = 0;
  private total: number;
  private width: number;
  private showPercentage: boolean;
  private showCount: boolean;
  private useColor: boolean;
  private message = '';

  constructor(options: ProgressBarOptions) {
    this.total = options.total;
    this.width = options.width || 30;
    this.showPercentage = options.showPercentage ?? true;
    this.showCount = options.showCount ?? true;
    this.useColor = shouldUseColor();
  }

  /**
   * Update progress
   */
  update(current: number, message?: string): void {
    this.current = current;
    if (message) this.message = message;

    if (!isTTY()) {
      // Non-TTY: print only on completion or every 25%
      const percent = Math.round((current / this.total) * 100);
      if (percent % 25 === 0 || current === this.total) {
        console.log(
          `Progress: ${percent}% (${current}/${this.total})${message ? ` - ${message}` : ''}`,
        );
      }
      return;
    }

    const percent = Math.round((this.current / this.total) * 100);
    const filled = Math.round((this.current / this.total) * this.width);
    const empty = this.width - filled;

    const filledChar = this.useColor
      ? styled('█'.repeat(filled), Style.TEXT_SUCCESS)
      : '#'.repeat(filled);
    const emptyChar = this.useColor ? styled('░'.repeat(empty), Style.TEXT_DIM) : '-'.repeat(empty);

    let status = '';
    if (this.showPercentage) status += ` ${percent}%`;
    if (this.showCount) status += ` (${this.current}/${this.total})`;
    if (this.message) status += ` ${this.message}`;

    process.stdout.write(`\r[${filledChar}${emptyChar}]${status}`);
  }

  /**
   * Increment by 1
   */
  increment(message?: string): void {
    this.update(this.current + 1, message);
  }

  /**
   * Complete the progress bar
   */
  complete(message?: string): void {
    this.update(this.total);
    if (isTTY()) {
      console.log(); // New line after progress bar
    }
    if (message) {
      const icon = this.useColor
        ? styled(Symbols.SUCCESS, Style.TEXT_SUCCESS)
        : AsciiSymbol.SUCCESS;
      console.log(`${icon} ${message}`);
    }
  }
}

/**
 * Step progress for multi-step operations
 */
export interface Step {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

export class StepProgress {
  private steps: Step[];
  private useColor: boolean;

  constructor(stepNames: string[]) {
    this.steps = stepNames.map((name) => ({ name, status: 'pending' }));
    this.useColor = shouldUseColor();
  }

  /**
   * Render all steps
   */
  render(): void {
    console.log();
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      console.log(this.formatStep(i, step));
    }
  }

  /**
   * Start a step
   */
  start(index: number): void {
    this.steps[index].status = 'running';
    this.rerender();
  }

  /**
   * Complete a step
   */
  complete(index: number): void {
    this.steps[index].status = 'completed';
    this.rerender();
  }

  /**
   * Fail a step
   */
  fail(index: number): void {
    this.steps[index].status = 'failed';
    this.rerender();
  }

  /**
   * Skip a step
   */
  skip(index: number): void {
    this.steps[index].status = 'skipped';
    this.rerender();
  }

  private formatStep(index: number, step: Step): string {
    const icon = this.getIcon(step.status);
    const style = this.getStyle(step.status);
    const stepNum = `Step ${index + 1}/${this.steps.length}:`;

    if (this.useColor) {
      return `  ${icon} ${styled(stepNum, Style.TEXT_DIM)} ${style(step.name)}`;
    }
    return `  ${icon} ${stepNum} ${step.name}`;
  }

  private getIcon(status: Step['status']): string {
    if (this.useColor) {
      switch (status) {
        case 'pending':
          return styled(Symbols.PENDING, Style.TEXT_DIM);
        case 'running':
          return styled(Symbols.RUNNING, Style.TEXT_INFO);
        case 'completed':
          return styled(Symbols.SUCCESS, Style.TEXT_SUCCESS);
        case 'failed':
          return styled(Symbols.FAILURE, Style.TEXT_DANGER);
        case 'skipped':
          return styled(Symbols.ARROW_RIGHT, Style.TEXT_DIM);
      }
    }
    switch (status) {
      case 'pending':
        return AsciiSymbol.PENDING;
      case 'running':
        return AsciiSymbol.RUNNING;
      case 'completed':
        return AsciiSymbol.SUCCESS;
      case 'failed':
        return AsciiSymbol.FAILURE;
      case 'skipped':
        return AsciiSymbol.ARROW_RIGHT;
    }
  }

  private getStyle(status: Step['status']): (s: string) => string {
    if (!this.useColor) return (s) => s;

    switch (status) {
      case 'pending':
        return (s) => styled(s, Style.TEXT_DIM);
      case 'running':
        return (s) => styled(s, Style.TEXT_INFO);
      case 'completed':
        return (s) => s;
      case 'failed':
        return (s) => styled(s, Style.TEXT_DANGER);
      case 'skipped':
        return (s) => styled(s, Style.TEXT_DIM);
    }
  }

  private rerender(): void {
    if (!isTTY()) {
      // Non-TTY: just print the changed step
      const lastChanged = this.steps.findIndex(
        (s) => s.status === 'running' || s.status === 'completed' || s.status === 'failed',
      );
      if (lastChanged >= 0) {
        console.log(this.formatStep(lastChanged, this.steps[lastChanged]));
      }
      return;
    }

    // Move cursor up and rerender all steps
    process.stdout.write(`\x1b[${this.steps.length}A`);
    for (let i = 0; i < this.steps.length; i++) {
      process.stdout.write('\x1b[2K'); // Clear line
      console.log(this.formatStep(i, this.steps[i]));
    }
  }
}

export default { Spinner, spinner, ProgressBar, StepProgress };
