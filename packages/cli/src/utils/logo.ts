/**
 * Refly ASCII Logo
 * Used by init command for branding display
 */

import { shouldUseColor, isTTY, Style, UI } from './ui.js';

/**
 * REFLY.AI ASCII Logo (Gradient Block Style)
 */
export const REFLY_LOGO = `█▀█ █▀▀ █▀▀ █   █ █   █▀█ █
█▀▄ █▀▀ █▀▀ █   █▄█ ▀ █▀█ █
▀ ▀ ▀▀▀ ▀   ▀▀▀  ▀    ▀ ▀ ▀`;

/**
 * Print the Refly logo to stderr
 * Only prints if TTY and colors are enabled
 */
export function printLogo(options?: { color?: boolean; force?: boolean }): void {
  const useColor = options?.color ?? shouldUseColor();
  const tty = isTTY();

  // Skip logo if not TTY (unless forced)
  if (!tty && !options?.force) {
    return;
  }

  if (useColor) {
    // Print with green color
    process.stderr.write(`${Style.TEXT_SUCCESS}${REFLY_LOGO}${Style.RESET}\n`);
  } else {
    process.stderr.write(`${REFLY_LOGO}\n`);
  }
}

/**
 * Print a success message with checkmark
 */
export function printSuccess(message: string): void {
  process.stderr.write(`${UI.successMsg(message)}\n`);
}

/**
 * Print an error message with cross
 */
export function printError(message: string): void {
  process.stderr.write(`${UI.errorMsg(message)}\n`);
}

/**
 * Print a dimmed/muted message
 */
export function printDim(message: string): void {
  process.stderr.write(`${UI.dim(message)}\n`);
}

/**
 * Print a plain message
 */
export function println(message: string): void {
  process.stderr.write(`${message}\n`);
}
