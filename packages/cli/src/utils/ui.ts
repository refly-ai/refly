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
      const styledValue = item.type
        ? item.type === 'success'
          ? UI.success(value)
          : item.type === 'error'
            ? UI.error(value)
            : item.type === 'warning'
              ? UI.warning(value)
              : UI.info(value)
        : UI.bold(value);
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
};

export default UI;
