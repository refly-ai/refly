/**
 * UI utilities for CLI output styling.
 * Reference: OpenCode CLI ui.ts
 */

/**
 * ANSI color and style codes
 */
export const Style = {
  // Reset
  RESET: '\x1b[0m',

  // Text styles
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  ITALIC: '\x1b[3m',
  UNDERLINE: '\x1b[4m',

  // Text colors
  TEXT_HIGHLIGHT: '\x1b[96m', // Bright Cyan
  TEXT_HIGHLIGHT_BOLD: '\x1b[96m\x1b[1m',
  TEXT_DIM: '\x1b[90m', // Gray
  TEXT_DIM_BOLD: '\x1b[90m\x1b[1m',
  TEXT_NORMAL: '\x1b[0m',
  TEXT_NORMAL_BOLD: '\x1b[1m',

  // Status colors
  TEXT_SUCCESS: '\x1b[92m', // Bright Green
  TEXT_SUCCESS_BOLD: '\x1b[92m\x1b[1m',
  TEXT_WARNING: '\x1b[93m', // Bright Yellow
  TEXT_WARNING_BOLD: '\x1b[93m\x1b[1m',
  TEXT_DANGER: '\x1b[91m', // Bright Red
  TEXT_DANGER_BOLD: '\x1b[91m\x1b[1m',
  TEXT_INFO: '\x1b[94m', // Bright Blue
  TEXT_INFO_BOLD: '\x1b[94m\x1b[1m',

  // Additional colors
  TEXT_MAGENTA: '\x1b[95m',
  TEXT_MAGENTA_BOLD: '\x1b[95m\x1b[1m',
  TEXT_WHITE: '\x1b[97m',
  TEXT_WHITE_BOLD: '\x1b[97m\x1b[1m',
} as const;

/**
 * Unicode symbols for pretty output
 */
export const Symbols = {
  // Status
  SUCCESS: '✓',
  FAILURE: '✗',
  WARNING: '⚠',
  INFO: 'ℹ',
  PENDING: '○',
  RUNNING: '◐',
  ARROW_RIGHT: '→',
  ARROW_DOWN: '↓',
  PLAY: '▶',
  STOP: '■',

  // Box drawing
  BOX_TOP_LEFT: '┌',
  BOX_TOP_RIGHT: '┐',
  BOX_BOTTOM_LEFT: '└',
  BOX_BOTTOM_RIGHT: '┘',
  BOX_HORIZONTAL: '─',
  BOX_VERTICAL: '│',
  BOX_VERTICAL_RIGHT: '├',
  BOX_VERTICAL_LEFT: '┤',

  // Bullets
  BULLET: '•',
  DIAMOND: '◆',
} as const;

/**
 * ASCII fallback symbols for plain/no-color mode
 */
export const AsciiSymbol = {
  SUCCESS: '[ok]',
  FAILURE: '[err]',
  WARNING: '[warn]',
  INFO: '[info]',
  PENDING: '[ ]',
  RUNNING: '[..]',
  ARROW_RIGHT: '->',
  ARROW_DOWN: 'v',
  PLAY: '>',
  STOP: 'x',

  BOX_TOP_LEFT: '+',
  BOX_TOP_RIGHT: '+',
  BOX_BOTTOM_LEFT: '+',
  BOX_BOTTOM_RIGHT: '+',
  BOX_HORIZONTAL: '-',
  BOX_VERTICAL: '|',
  BOX_VERTICAL_RIGHT: '+',
  BOX_VERTICAL_LEFT: '+',

  BULLET: '*',
  DIAMOND: '*',
} as const;

/**
 * Tool display styles mapping
 * Format: [displayLabel, colorStyle]
 */
export const TOOL_STYLES: Record<string, [string, string]> = {
  // Workflow node types
  'knowledge.search': ['Search', Style.TEXT_INFO_BOLD],
  'llm.generate': ['Generate', Style.TEXT_SUCCESS_BOLD],
  'notification.email': ['Email', Style.TEXT_WARNING_BOLD],
  'code.executor': ['Code', Style.TEXT_DANGER_BOLD],
  'web.search': ['Web', Style.TEXT_HIGHLIGHT_BOLD],
  'document.read': ['Read', Style.TEXT_HIGHLIGHT_BOLD],
  'document.write': ['Write', Style.TEXT_SUCCESS_BOLD],

  // Builder operations
  'builder.start': ['Builder', Style.TEXT_INFO_BOLD],
  'builder.add-node': ['AddNode', Style.TEXT_SUCCESS_BOLD],
  'builder.remove-node': ['RemoveNode', Style.TEXT_WARNING_BOLD],
  'builder.connect': ['Connect', Style.TEXT_INFO_BOLD],
  'builder.validate': ['Validate', Style.TEXT_HIGHLIGHT_BOLD],
  'builder.commit': ['Commit', Style.TEXT_SUCCESS_BOLD],

  // Workflow operations
  'workflow.create': ['Create', Style.TEXT_SUCCESS_BOLD],
  'workflow.run': ['Run', Style.TEXT_INFO_BOLD],
  'workflow.list': ['List', Style.TEXT_DIM_BOLD],
  'workflow.get': ['Get', Style.TEXT_DIM_BOLD],
  'workflow.delete': ['Delete', Style.TEXT_DANGER_BOLD],
};

/**
 * Check if colors should be enabled
 */
export function shouldUseColor(): boolean {
  // Check NO_COLOR environment variable (https://no-color.org/)
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }

  // Check REFLY_NO_COLOR
  if (process.env.REFLY_NO_COLOR === '1') {
    return false;
  }

  // Check FORCE_COLOR
  if (process.env.FORCE_COLOR !== undefined) {
    return true;
  }

  // Check if stdout is a TTY
  return process.stdout.isTTY === true;
}

/**
 * Check if output is going to a TTY
 */
export function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Get the appropriate symbol based on color mode
 */
export function getSymbol(key: keyof typeof Symbols, useColor: boolean = shouldUseColor()): string {
  return useColor ? Symbols[key] : AsciiSymbol[key];
}

/**
 * Apply style to text if colors are enabled
 */
export function styled(text: string, style: string, useColor: boolean = shouldUseColor()): string {
  if (!useColor) {
    return text;
  }
  return `${style}${text}${Style.RESET}`;
}

/**
 * Format a stat value with the appropriate style based on type.
 */
function formatStatValue(value: string, type?: 'success' | 'error' | 'warning' | 'info'): string {
  if (!type) {
    return UI.bold(value);
  }

  switch (type) {
    case 'success':
      return UI.success(value);
    case 'error':
      return UI.error(value);
    case 'warning':
      return UI.warning(value);
    case 'info':
      return UI.info(value);
  }
}

/**
 * Helper functions for common styles
 */
export const UI = {
  // Styled text helpers
  success: (text: string) => styled(text, Style.TEXT_SUCCESS),
  error: (text: string) => styled(text, Style.TEXT_DANGER),
  warning: (text: string) => styled(text, Style.TEXT_WARNING),
  info: (text: string) => styled(text, Style.TEXT_INFO),
  highlight: (text: string) => styled(text, Style.TEXT_HIGHLIGHT),
  dim: (text: string) => styled(text, Style.TEXT_DIM),
  bold: (text: string) => styled(text, Style.BOLD),

  // Success/error icons with text
  successIcon: () => styled(getSymbol('SUCCESS'), Style.TEXT_SUCCESS),
  errorIcon: () => styled(getSymbol('FAILURE'), Style.TEXT_DANGER),
  warningIcon: () => styled(getSymbol('WARNING'), Style.TEXT_WARNING),
  infoIcon: () => styled(getSymbol('INFO'), Style.TEXT_INFO),

  // Formatted messages
  successMsg: (msg: string) => `${UI.successIcon()} ${msg}`,
  errorMsg: (msg: string) => `${UI.errorIcon()} ${msg}`,
  warningMsg: (msg: string) => `${UI.warningIcon()} ${msg}`,
  infoMsg: (msg: string) => `${UI.infoIcon()} ${msg}`,

  // Box drawing
  box: (title: string, content: string, width = 40) => {
    const useColor = shouldUseColor();
    const sym = useColor ? Symbols : AsciiSymbol;
    const titlePart = title ? `${sym.BOX_HORIZONTAL} ${title} ` : '';
    const remainingWidth = Math.max(0, width - titlePart.length - 2);

    const lines = [
      `  ${sym.BOX_TOP_LEFT}${titlePart}${sym.BOX_HORIZONTAL.repeat(remainingWidth)}${sym.BOX_TOP_RIGHT}`,
      ...content
        .split('\n')
        .map((line) => `  ${sym.BOX_VERTICAL}  ${line.padEnd(width - 4)}${sym.BOX_VERTICAL}`),
      `  ${sym.BOX_BOTTOM_LEFT}${sym.BOX_HORIZONTAL.repeat(width - 2)}${sym.BOX_BOTTOM_RIGHT}`,
    ];

    return lines.join('\n');
  },

  // Indentation
  indent: (text: string, spaces = 2) => {
    const pad = ' '.repeat(spaces);
    return text
      .split('\n')
      .map((line) => `${pad}${line}`)
      .join('\n');
  },

  // Key-value display
  keyValue: (key: string, value: string, keyWidth = 12) => {
    return `  ${UI.dim(key.padEnd(keyWidth))} ${value}`;
  },

  // Labeled value with icon (more visual than keyValue)
  labeledValue: (label: string, value: string, icon?: string) => {
    const useColor = shouldUseColor();
    const sym = useColor ? Symbols : AsciiSymbol;
    const displayIcon = icon || sym.BULLET;
    return `  ${displayIcon} ${UI.dim(`${label}:`)} ${value}`;
  },

  // Flow diagram for dependencies (e.g., input → search → generate)
  flowDiagram: (nodes: string[], highlight?: string) => {
    const useColor = shouldUseColor();
    const arrow = useColor ? ` ${Symbols.ARROW_RIGHT} ` : ' -> ';

    return nodes
      .map((node, idx) => {
        if (highlight && node === highlight) {
          return UI.highlight(UI.bold(node));
        }
        // First node is dimmed (usually input), last highlighted (output)
        if (idx === 0) {
          return UI.dim(node);
        }
        return node;
      })
      .join(arrow);
  },

  // Dependency display with visual arrow
  dependency: (from: string, to: string) => {
    const useColor = shouldUseColor();
    const arrow = useColor ? Symbols.ARROW_RIGHT : '->';
    return `  ${UI.dim(from)} ${arrow} ${UI.bold(to)}`;
  },

  // Multiple dependencies display
  dependencies: (deps: string[], nodeName: string) => {
    if (deps.length === 0) {
      return `  ${UI.dim('(no dependencies)')}`;
    }
    const useColor = shouldUseColor();
    const arrow = useColor ? Symbols.ARROW_RIGHT : '->';
    const depList = deps.map((d) => UI.dim(d)).join(', ');
    return `  ${depList} ${arrow} ${UI.bold(nodeName)}`;
  },

  // Tree structure for hierarchical data
  tree: (items: Array<{ label: string; children?: string[] }>) => {
    const useColor = shouldUseColor();
    const sym = useColor ? Symbols : AsciiSymbol;
    const lines: string[] = [];

    items.forEach((item, idx) => {
      const isLast = idx === items.length - 1;
      const prefix = isLast ? sym.BOX_BOTTOM_LEFT : sym.BOX_VERTICAL_RIGHT;
      lines.push(`  ${prefix}${sym.BOX_HORIZONTAL} ${item.label}`);

      if (item.children) {
        const childPrefix = isLast ? '   ' : `  ${sym.BOX_VERTICAL}`;
        item.children.forEach((child, childIdx) => {
          const childIsLast = childIdx === item.children!.length - 1;
          const childBranch = childIsLast ? sym.BOX_BOTTOM_LEFT : sym.BOX_VERTICAL_RIGHT;
          lines.push(`${childPrefix} ${childBranch}${sym.BOX_HORIZONTAL} ${UI.dim(child)}`);
        });
      }
    });

    return lines.join('\n');
  },

  // Node card display (compact visual representation)
  nodeCard: (node: { id: string; type: string; dependsOn?: string[] }) => {
    const useColor = shouldUseColor();
    const sym = useColor ? Symbols : AsciiSymbol;
    const [label, colorStyle] = TOOL_STYLES[node.type] || [node.type, Style.TEXT_INFO];
    const styledType = useColor ? `${colorStyle}${label}${Style.RESET}` : label;

    const lines: string[] = [];
    lines.push(`  ${sym.DIAMOND} ${UI.bold(node.id)} ${UI.dim('(')}${styledType}${UI.dim(')')}`);

    if (node.dependsOn && node.dependsOn.length > 0) {
      const arrow = useColor ? Symbols.ARROW_RIGHT : '->';
      const deps = node.dependsOn.join(', ');
      lines.push(`    ${UI.dim(deps)} ${arrow} ${node.id}`);
    }

    return lines.join('\n');
  },

  // Status badge
  badge: (text: string, type: 'success' | 'error' | 'warning' | 'info' | 'dim' = 'info') => {
    const useColor = shouldUseColor();
    if (!useColor) {
      return `[${text}]`;
    }

    const styles: Record<string, string> = {
      success: Style.TEXT_SUCCESS,
      error: Style.TEXT_DANGER,
      warning: Style.TEXT_WARNING,
      info: Style.TEXT_INFO,
      dim: Style.TEXT_DIM,
    };

    return `${styles[type]}[${text}]${Style.RESET}`;
  },

  // Summary stats line
  stats: (
    items: Array<{
      label: string;
      value: string | number;
      type?: 'success' | 'error' | 'warning' | 'info';
    }>,
  ) => {
    const parts = items.map((item) => {
      const value = String(item.value);
      const styledValue = formatStatValue(value, item.type);
      return `${UI.dim(`${item.label}:`)} ${styledValue}`;
    });
    return `  ${parts.join('  ')}`;
  },

  // Progress bar
  progressBar: (
    current: number,
    total: number,
    options?: {
      width?: number;
      showPercent?: boolean;
      showCount?: boolean;
      filledChar?: string;
      emptyChar?: string;
    },
  ) => {
    const useColor = shouldUseColor();
    const width = options?.width ?? 20;
    const showPercent = options?.showPercent ?? true;
    const showCount = options?.showCount ?? true;
    const filledChar = options?.filledChar ?? (useColor ? '█' : '#');
    const emptyChar = options?.emptyChar ?? (useColor ? '░' : '-');

    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    const filled = total > 0 ? Math.round((current / total) * width) : 0;
    const empty = width - filled;

    const bar = filledChar.repeat(filled) + emptyChar.repeat(empty);
    const coloredBar = useColor
      ? styled(bar, percent === 100 ? Style.TEXT_SUCCESS : Style.TEXT_INFO)
      : bar;

    const parts: string[] = [`[${coloredBar}]`];
    if (showPercent) {
      parts.push(`${percent.toString().padStart(3)}%`);
    }
    if (showCount) {
      parts.push(UI.dim(`${current}/${total}`));
    }

    return parts.join(' ');
  },

  // Status icon based on status string
  statusIcon: (status: string) => {
    const useColor = shouldUseColor();
    const sym = useColor ? Symbols : AsciiSymbol;

    switch (status) {
      case 'finish':
      case 'completed':
      case 'success':
        return styled(sym.SUCCESS, Style.TEXT_SUCCESS);
      case 'failed':
      case 'error':
        return styled(sym.FAILURE, Style.TEXT_DANGER);
      case 'executing':
      case 'running':
      case 'in_progress':
        return styled(sym.RUNNING, Style.TEXT_INFO);
      case 'init':
      case 'pending':
      case 'waiting':
        return styled(sym.PENDING, Style.TEXT_DIM);
      default:
        return styled(sym.INFO, Style.TEXT_DIM);
    }
  },

  // Format duration in human readable form
  formatDuration: (startTime?: string, endTime?: string) => {
    if (!startTime) return '';
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const durationMs = end - start;

    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.round((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  },

  // Format timestamp
  formatTime: (timestamp?: string) => {
    if (!timestamp) return UI.dim('—');
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
  },

  // Tool execution line
  toolLine: (toolType: string, message: string, duration?: number): string => {
    const useColor = shouldUseColor();
    const [label, colorStyle] = TOOL_STYLES[toolType] || [toolType, Style.TEXT_INFO_BOLD];
    const sym = useColor ? Symbols : AsciiSymbol;
    const styledLabel = useColor
      ? `${colorStyle}${label.padEnd(8)}${Style.RESET}`
      : label.padEnd(8);
    const durationStr = duration !== undefined ? UI.dim(` [${duration.toFixed(1)}s]`) : '';

    return `${sym.BOX_VERTICAL} ${styledLabel} ${message}${durationStr}`;
  },

  // ============================================================
  // Phase 1: Charm-style Card Component
  // ============================================================

  /**
   * Charm-style card with box border
   * @param options Card configuration
   * @returns Formatted card string
   */
  card: (options: {
    icon?: string;
    title: string;
    status?: 'success' | 'error' | 'warning' | 'info' | 'pending';
    lines: Array<{ text: string; indent?: boolean; muted?: boolean }>;
    width?: number;
  }): string => {
    const useColor = shouldUseColor();
    const sym = useColor ? Symbols : AsciiSymbol;
    const maxWidth = Math.min(options.width ?? 50, 100);
    const innerWidth = maxWidth - 4; // Account for borders and padding

    // Determine status icon
    let statusIcon = options.icon ?? '';
    if (!statusIcon && options.status) {
      const iconMap: Record<string, string> = {
        success: sym.SUCCESS,
        error: sym.FAILURE,
        warning: sym.PENDING,
        info: sym.RUNNING,
        pending: sym.PENDING,
      };
      statusIcon = iconMap[options.status] || '';
      if (useColor && options.status) {
        const styleMap: Record<string, string> = {
          success: Style.TEXT_SUCCESS,
          error: Style.TEXT_DANGER,
          warning: Style.TEXT_WARNING,
          info: Style.TEXT_INFO,
          pending: Style.TEXT_DIM,
        };
        statusIcon = styled(statusIcon, styleMap[options.status]);
      }
    }

    // Build title line
    const titleText = statusIcon ? `${statusIcon} ${options.title}` : options.title;

    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes need control characters
    const ansiRegex = /\x1b\[[0-9;]*m/g;

    // Truncate or wrap text to fit within card
    const truncate = (text: string, maxLen: number): string => {
      // Strip ANSI codes for length calculation
      const stripped = text.replace(ansiRegex, '');
      if (stripped.length <= maxLen) return text;
      // Find where to cut (accounting for ANSI codes)
      let visibleLen = 0;
      let cutIndex = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '\x1b') {
          // Skip ANSI sequence
          const end = text.indexOf('m', i);
          if (end !== -1) {
            i = end;
            continue;
          }
        }
        visibleLen++;
        if (visibleLen >= maxLen - 1) {
          cutIndex = i + 1;
          break;
        }
      }
      return `${text.slice(0, cutIndex)}…`;
    };

    const padRight = (text: string, width: number): string => {
      const stripped = text.replace(ansiRegex, '');
      const padding = Math.max(0, width - stripped.length);
      return text + ' '.repeat(padding);
    };

    const lines: string[] = [];

    // Top border
    lines.push(`${sym.BOX_TOP_LEFT}${sym.BOX_HORIZONTAL.repeat(maxWidth - 2)}${sym.BOX_TOP_RIGHT}`);

    // Title line
    const titleDisplay = truncate(titleText, innerWidth);
    lines.push(`${sym.BOX_VERTICAL} ${padRight(titleDisplay, innerWidth)} ${sym.BOX_VERTICAL}`);

    // Content lines
    for (const line of options.lines) {
      const prefix = line.indent ? '  ' : '';
      let content = prefix + line.text;
      if (line.muted && useColor) {
        content = prefix + UI.dim(line.text);
      }
      const displayContent = truncate(content, innerWidth);
      lines.push(`${sym.BOX_VERTICAL} ${padRight(displayContent, innerWidth)} ${sym.BOX_VERTICAL}`);
    }

    // Bottom border
    lines.push(
      `${sym.BOX_BOTTOM_LEFT}${sym.BOX_HORIZONTAL.repeat(maxWidth - 2)}${sym.BOX_BOTTOM_RIGHT}`,
    );

    return lines.join('\n');
  },

  // ============================================================
  // Phase 1: Docker-style Table Component
  // ============================================================

  /**
   * Docker-style table with header and rows
   * @param options Table configuration
   * @returns Formatted table string
   */
  table: (options: {
    title?: string;
    columns: Array<{
      key: string;
      label: string;
      width?: number;
      align?: 'left' | 'right';
    }>;
    rows: Array<Record<string, unknown>>;
    maxWidth?: number;
  }): string => {
    const useColor = shouldUseColor();
    const sym = useColor ? Symbols : AsciiSymbol;
    const maxTotalWidth = options.maxWidth ?? 100;

    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes need control characters
    const ansiStripRegex = /\x1b\[[0-9;]*m/g;

    // Calculate column widths
    const columns = options.columns.map((col) => {
      // Find max content width for this column
      let maxContentWidth = col.label.length;
      for (const row of options.rows) {
        const value = String(row[col.key] ?? '');
        // Strip ANSI codes and status icons for width calculation
        const stripped = value.replace(ansiStripRegex, '').replace(/^[✓✗◐○] /, '');
        maxContentWidth = Math.max(maxContentWidth, stripped.length);
      }
      return {
        ...col,
        calculatedWidth: col.width ?? Math.min(maxContentWidth, 40),
      };
    });

    // Adjust widths if total exceeds maxWidth
    const totalWidth = columns.reduce((sum, col) => sum + col.calculatedWidth + 2, 0);
    if (totalWidth > maxTotalWidth) {
      const scale = maxTotalWidth / totalWidth;
      for (const col of columns) {
        col.calculatedWidth = Math.max(5, Math.floor(col.calculatedWidth * scale));
      }
    }

    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes need control characters
    const ansiRegex = /\x1b\[[0-9;]*m/g;

    const truncate = (text: string, maxLen: number): string => {
      const stripped = text.replace(ansiRegex, '');
      if (stripped.length <= maxLen) return text;
      let visibleLen = 0;
      let cutIndex = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '\x1b') {
          const end = text.indexOf('m', i);
          if (end !== -1) {
            i = end;
            continue;
          }
        }
        visibleLen++;
        if (visibleLen >= maxLen - 1) {
          cutIndex = i + 1;
          break;
        }
      }
      return `${text.slice(0, cutIndex)}…`;
    };

    const pad = (text: string, width: number, align: 'left' | 'right' = 'left'): string => {
      const stripped = text.replace(ansiRegex, '');
      const padding = Math.max(0, width - stripped.length);
      return align === 'right' ? ' '.repeat(padding) + text : text + ' '.repeat(padding);
    };

    const lines: string[] = [];

    // Title (if provided)
    if (options.title) {
      lines.push(`${sym.DIAMOND} ${useColor ? UI.bold(options.title) : options.title}`);
    }

    // Header row
    const headerCells = columns.map((col) => {
      const label = useColor ? col.label.toUpperCase() : col.label.toUpperCase();
      return pad(label, col.calculatedWidth, col.align);
    });
    lines.push(headerCells.join('  '));

    // Divider
    const dividerCells = columns.map((col) => '─'.repeat(col.calculatedWidth));
    lines.push(useColor ? UI.dim(dividerCells.join('  ')) : dividerCells.join('  '));

    // Data rows
    for (const row of options.rows) {
      const cells = columns.map((col) => {
        let value = String(row[col.key] ?? '—');
        value = truncate(value, col.calculatedWidth);
        return pad(value, col.calculatedWidth, col.align);
      });
      lines.push(cells.join('  '));
    }

    return lines.join('\n');
  },

  // ============================================================
  // Phase 2/3 Extension Points (interfaces only)
  // ============================================================

  /**
   * Wizard step indicator (Phase 3)
   * Placeholder for future wizard-style login flow
   */
  wizardStep: (current: number, total: number, label: string): string => {
    const useColor = shouldUseColor();
    const stepText = `(${current}/${total})`;
    return useColor ? `${UI.dim(stepText)} ${label}` : `${stepText} ${label}`;
  },

  /**
   * Format relative time (e.g., "2h ago", "5m ago")
   */
  relativeTime: (date: Date | string): string => {
    const now = Date.now();
    const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
    const diffMs = now - then;

    if (diffMs < 60000) return 'just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
    return `${Math.floor(diffMs / 86400000)}d ago`;
  },

  /**
   * Format time remaining (e.g., "23h left", "5m left")
   */
  timeRemaining: (expiresAt: Date | string | number): string => {
    const now = Date.now();
    const expiry = parseExpiryTimestamp(expiresAt);
    const diffMs = expiry - now;

    if (diffMs <= 0) return 'expired';
    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s left`;
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m left`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h left`;
    return `${Math.floor(diffMs / 86400000)}d left`;
  },
};

/**
 * Parse expiry timestamp from various formats to milliseconds.
 */
function parseExpiryTimestamp(expiresAt: Date | string | number): number {
  if (typeof expiresAt === 'number') {
    return expiresAt * 1000; // Assume Unix timestamp in seconds
  }
  if (typeof expiresAt === 'string') {
    return new Date(expiresAt).getTime();
  }
  return expiresAt.getTime();
}

export default UI;
