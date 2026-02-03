/**
 * Multi-format output formatter for CLI.
 * Supports: pretty, json, compact, plain
 */

import { Style, Symbols, AsciiSymbol, UI, shouldUseColor, isTTY, styled } from './ui.js';

export type OutputFormat = 'pretty' | 'json' | 'compact' | 'plain';

export interface FormatterOptions {
  format: OutputFormat;
  noColor?: boolean;
  verbose?: boolean;
}

export interface SuccessPayload {
  message?: string;
  [key: string]: unknown;
}

export interface SuggestedFix {
  field?: string;
  format?: string;
  example?: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  hint?: string;
  suggestedFix?: SuggestedFix;
  /**
   * Indicates if the error can be fixed by adjusting parameters.
   * - true: Fix the parameters (see suggestedFix) and retry the SAME command
   * - false: The approach may not work, consider alternatives
   */
  recoverable?: boolean;
}

const VERSION = '1.0';

/**
 * Determine the effective output format
 * Priority: explicit flag > REFLY_FORMAT env > auto-detect (TTY=pretty, pipe=json)
 */
export function resolveFormat(explicitFormat?: OutputFormat, autoDetect = true): OutputFormat {
  // 1. Explicit format from CLI flag
  if (explicitFormat) {
    return explicitFormat;
  }

  // 2. Environment variable override (always respected)
  const envFormat = process.env.REFLY_FORMAT as OutputFormat | undefined;
  if (envFormat && ['pretty', 'json', 'compact', 'plain'].includes(envFormat)) {
    return envFormat;
  }

  // 3. Auto-detect based on TTY
  if (autoDetect) {
    // When piped (not a TTY), use JSON for machine parsing
    // When interactive (TTY), use pretty for human readability
    return isTTY() ? 'pretty' : 'json';
  }

  return 'pretty';
}

/**
 * Output formatter class
 */
export class OutputFormatter {
  private options: FormatterOptions;
  private useColor: boolean;
  private useUnicode: boolean;

  constructor(options: Partial<FormatterOptions> = {}) {
    this.options = {
      format: options.format || 'pretty',
      noColor: options.noColor ?? false,
      verbose: options.verbose ?? false,
    };

    this.useColor = !this.options.noColor && this.options.format !== 'plain' && shouldUseColor();

    // Use Unicode symbols for pretty/compact formats, ASCII only for plain
    this.useUnicode = this.options.format !== 'plain';
  }

  /**
   * Output a success response
   */
  success(type: string, payload: SuccessPayload): void {
    switch (this.options.format) {
      case 'json':
        this.outputJson({ ok: true, type, version: VERSION, payload });
        break;
      case 'pretty':
        this.outputPretty(type, payload);
        break;
      case 'compact':
        this.outputCompact(type, payload);
        break;
      case 'plain':
        this.outputPlain(type, payload);
        break;
    }
  }

  /**
   * Output an error response
   */
  error(error: ErrorPayload): void {
    switch (this.options.format) {
      case 'json':
        this.outputJson({
          ok: false,
          type: 'error',
          version: VERSION,
          error,
        });
        break;
      case 'pretty':
        this.outputErrorPretty(error);
        break;
      case 'compact':
        this.outputErrorCompact(error);
        break;
      case 'plain':
        this.outputErrorPlain(error);
        break;
    }
  }

  /**
   * Output progress message (non-blocking, for TTY only)
   */
  progress(message: string): void {
    if (this.options.format === 'json') {
      return; // No progress in JSON mode
    }

    if (!isTTY()) {
      console.log(message);
      return;
    }

    const icon = this.useColor ? styled(Symbols.RUNNING, Style.TEXT_INFO) : AsciiSymbol.RUNNING;
    process.stdout.write(`\r${icon} ${message}`);
  }

  /**
   * Clear progress line
   */
  clearProgress(): void {
    if (isTTY()) {
      process.stdout.write('\r\x1b[K');
    }
  }

  // === JSON Format ===

  private outputJson(data: unknown): void {
    console.log(JSON.stringify(data, this.sanitizeJsonReplacer, 2));
  }

  /**
   * JSON replacer that sanitizes control characters in strings.
   * Control characters (U+0000 to U+001F) can break jq parsing.
   */
  private sanitizeJsonReplacer = (_key: string, value: unknown): unknown => {
    if (typeof value === 'string') {
      // Remove control characters (except \n, \r, \t which are common)
      // Using character code check to avoid linter issues with control chars in regex
      return value
        .split('')
        .filter((char) => {
          const code = char.charCodeAt(0);
          // Allow printable chars (>= 0x20), and \t (0x09), \n (0x0A), \r (0x0D)
          return code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
        })
        .join('');
    }
    return value;
  };

  // === Pretty Format ===

  private outputPretty(type: string, payload: SuccessPayload): void {
    // Special handling for workflow status
    if (type === 'workflow.status' || type === 'workflow.progress') {
      this.outputWorkflowStatus(payload);
      return;
    }

    // Special handling for CLI status (Phase 1: Charm-style cards)
    if (type === 'status') {
      this.outputStatusPretty(payload);
      return;
    }

    // Phase 2: Workflow list with Docker-style table
    if (type === 'workflow.list') {
      this.outputWorkflowListPretty(payload);
      return;
    }

    const { message, ...rest } = payload;

    // Success icon and message
    if (message) {
      console.log(UI.successMsg(message));
    } else {
      console.log(UI.successMsg(this.humanizeType(type)));
    }

    // Check if this is a node-related output (has node data)
    if (rest.node && typeof rest.node === 'object') {
      console.log();
      this.outputNodeInfo(rest.node as Record<string, unknown>);
    } else {
      // Additional fields (using labeled values for better visual)
      const fields = this.extractDisplayFields(rest);
      if (fields.length > 0) {
        console.log();
        for (const [key, value] of fields) {
          console.log(UI.labeledValue(this.humanizeKey(key), this.formatValue(value)));
        }
      }
    }

    // Nested objects (like diff, builder) - but skip 'node' as it's handled above
    const nested = this.extractNestedObjects(rest);
    for (const [key, obj] of nested) {
      if (key === 'node') continue; // Already handled
      console.log();
      this.outputNestedObject(key, obj as Record<string, unknown>);
    }

    // Workflow stats summary (if available)
    if (rest.nodesCount !== undefined || rest.edgesCount !== undefined) {
      console.log();
      const stats: Array<{
        label: string;
        value: string | number;
        type?: 'success' | 'error' | 'warning' | 'info';
      }> = [];
      if (rest.nodesCount !== undefined)
        stats.push({ label: 'Nodes', value: rest.nodesCount as number });
      if (rest.edgesCount !== undefined)
        stats.push({ label: 'Edges', value: rest.edgesCount as number });
      if (rest.valid !== undefined) {
        stats.push({
          label: 'Valid',
          value: rest.valid ? '✓' : '✗',
          type: rest.valid ? 'success' : 'error',
        });
      }
      console.log(UI.stats(stats));
    }

    // Hint/next step
    if (rest.nextStep) {
      console.log();
      console.log(UI.dim(`  💡 ${rest.nextStep}`));
    }

    console.log();
  }

  /**
   * Output node information in a visual format
   */
  private outputNodeInfo(node: Record<string, unknown>): void {
    const id = (node.id as string) || (node.nodeId as string) || 'unknown';
    const type = (node.type as string) || (node.nodeType as string) || 'unknown';
    const dependsOn = (node.dependsOn as string[]) || (node.dependencies as string[]) || [];

    // Node card display
    console.log(UI.nodeCard({ id, type, dependsOn }));

    // Additional node properties (config, etc.)
    const skipKeys = [
      'id',
      'nodeId',
      'type',
      'nodeType',
      'dependsOn',
      'dependencies',
      'config',
      'data',
    ];
    const extraFields = Object.entries(node).filter(
      ([k, v]) => !skipKeys.includes(k) && v !== null && v !== undefined && typeof v !== 'object',
    );

    if (extraFields.length > 0) {
      for (const [key, value] of extraFields) {
        console.log(UI.labeledValue(this.humanizeKey(key), this.formatValue(value)));
      }
    }
  }

  private outputNestedObject(label: string, obj: Record<string, unknown>): void {
    const humanLabel = this.humanizeKey(label);
    const fields = Object.entries(obj).filter(
      ([, v]) => v !== null && v !== undefined && typeof v !== 'object',
    );

    if (fields.length === 0) return;

    // Compact display for small objects
    if (fields.length <= 3) {
      const parts = fields.map(([k, v]) => `${this.humanizeKey(k)}: ${this.formatValue(v)}`);
      console.log(UI.indent(UI.dim(`${humanLabel}: `) + parts.join('  ')));
    } else {
      console.log(UI.indent(UI.dim(`${humanLabel}:`)));
      for (const [k, v] of fields) {
        console.log(UI.keyValue(this.humanizeKey(k), this.formatValue(v), 14));
      }
    }
  }

  private outputErrorPretty(error: ErrorPayload): void {
    console.log(UI.errorMsg(error.message));

    if (error.code) {
      console.log(UI.keyValue('Code', UI.dim(error.code)));
    }

    // Show recoverable status prominently
    if (error.recoverable !== undefined) {
      const recoverableText = error.recoverable
        ? '🔄 Recoverable: Fix the parameter and retry the SAME command'
        : '❌ Not recoverable: Consider a different approach';
      console.log(UI.dim(`  ${recoverableText}`));
    }

    if (error.details && Object.keys(error.details).length > 0) {
      console.log();
      console.log(UI.indent(UI.dim('Details:')));
      for (const [key, value] of Object.entries(error.details)) {
        const humanKey = this.humanizeKey(key);
        // For objects, show key on its own line then formatted object below
        if (typeof value === 'object' && value !== null) {
          console.log(UI.indent(`${UI.dim(`${humanKey}:`)}`));
          console.log(UI.indent(this.formatObject(value as Record<string, unknown>, 2), 4));
        } else {
          console.log(UI.keyValue(humanKey, this.formatValue(value), 14));
        }
      }
    }

    if (error.hint) {
      console.log();
      console.log(UI.dim(`  💡 Hint: ${error.hint}`));
    }

    if (error.suggestedFix && Object.keys(error.suggestedFix).length > 0) {
      console.log();
      console.log(UI.dim('  ✅ Suggested fix:'));
      console.log(
        UI.indent(this.formatObject(error.suggestedFix as Record<string, unknown>, 2), 4),
      );
    }

    console.log();
  }

  // === Workflow List Format (Phase 2: Docker-style table) ===

  private outputWorkflowListPretty(payload: SuccessPayload): void {
    const { workflows, total } = payload as { workflows: unknown[]; total: number };
    const workflowList = workflows as Array<Record<string, unknown>>;

    if (!workflowList || workflowList.length === 0) {
      console.log(UI.dim('  No workflows found'));
      console.log();
      return;
    }

    // Format status for each workflow
    const rows = workflowList.map((w) => ({
      name: String(w.name || '—').slice(0, 40),
      nodes: w.nodeCount ?? 0,
      updated: w.updatedAt ? UI.relativeTime(w.updatedAt as string) : '—',
    }));

    console.log(
      UI.table({
        title: 'WORKFLOWS',
        columns: [
          { key: 'name', label: 'Name', width: 45 },
          { key: 'nodes', label: 'Nodes', width: 6, align: 'right' },
          { key: 'updated', label: 'Updated', width: 12 },
        ],
        rows,
      }),
    );

    if (total > workflowList.length) {
      console.log();
      console.log(UI.dim(`  Showing ${workflowList.length} of ${total} workflows`));
    }
    console.log();
  }

  // === CLI Status Format (Phase 1: Charm-style cards) ===

  private outputStatusPretty(payload: SuccessPayload): void {
    const { cli_version, auth_status, user, skill, api_endpoint } = payload as Record<
      string,
      unknown
    >;

    const sym = this.useUnicode ? Symbols : AsciiSymbol;

    // Header
    console.log(`${sym.DIAMOND} ${UI.bold('Refly CLI')} v${cli_version || '?'}`);
    console.log();

    // Auth status
    const authOk = auth_status === 'valid';
    const userObj = user as Record<string, unknown> | null;
    let authText = '';
    if (authOk && userObj?.email) {
      authText = String(userObj.email);
    } else if (auth_status === 'expired') {
      authText = 'Token expired';
    } else {
      authText = 'Not authenticated';
    }

    // Skill status
    const skillObj = skill as Record<string, unknown> | null;
    const skillInstalled = skillObj?.installed === true;
    const skillVersion = skillObj?.version ? `v${skillObj.version}` : '';
    const skillUpToDate = skillObj?.up_to_date === true;
    let skillText = '';
    if (skillInstalled) {
      skillText = skillVersion + (skillUpToDate ? ' (up to date)' : ' (update available)');
    } else {
      skillText = 'Not installed';
    }

    // Build combined status card
    const authIcon = authOk
      ? styled(sym.SUCCESS, Style.TEXT_SUCCESS)
      : styled(sym.FAILURE, Style.TEXT_DANGER);
    const connIcon = authOk
      ? styled(sym.SUCCESS, Style.TEXT_SUCCESS)
      : styled(sym.PENDING, Style.TEXT_DIM);
    const skillIcon = skillInstalled
      ? styled(sym.SUCCESS, Style.TEXT_SUCCESS)
      : styled(sym.PENDING, Style.TEXT_DIM);

    const displayEndpoint = api_endpoint ? String(api_endpoint) : 'https://refly.ai';
    const lines: Array<{ text: string; indent?: boolean; muted?: boolean }> = [
      { text: `${authIcon} Account    ${authOk ? authText : authText}`, muted: !authOk },
      { text: `${connIcon} Link       ${displayEndpoint}` },
      { text: `${skillIcon} Version    ${skillText}`, muted: !skillInstalled },
    ];

    console.log(
      UI.card({
        title: 'Status',
        lines,
        width: 45,
      }),
    );
    console.log();
  }

  // === Workflow Status Format ===

  private outputWorkflowStatus(payload: SuccessPayload): void {
    const {
      runId,
      status,
      title,
      totalNodes,
      executedNodes,
      failedNodes,
      nodeStatuses,
      createdAt,
      updatedAt,
      watching,
      isInitial,
      completed,
      // For progress updates
      summary,
      changedNodes,
    } = payload as Record<string, unknown>;

    const sym = this.useUnicode ? Symbols : AsciiSymbol;

    // Header with status
    const statusStr = (status as string) || 'unknown';
    const statusIcon = UI.statusIcon(statusStr);
    const statusLabel = this.formatWorkflowStatus(statusStr);

    // For progress updates (delta mode), show compact output
    if (changedNodes && !isInitial) {
      const progressStr = UI.progressBar(
        (executedNodes as number) || 0,
        (totalNodes as number) || 1,
        { width: 25 },
      );
      console.log(`  ${progressStr} ${statusIcon} ${statusLabel}`);

      // Show changed nodes
      const nodes = changedNodes as Array<Record<string, unknown>>;
      if (nodes && nodes.length > 0) {
        for (const node of nodes) {
          const nodeIcon = UI.statusIcon(node.status as string);
          const nodeTitle = (node.title as string) || (node.nodeId as string);
          console.log(`    ${nodeIcon} ${nodeTitle}`);
        }
      }

      if (summary) {
        console.log(UI.dim(`    ${summary}`));
      }
      return;
    }

    // Full status output
    console.log(`${statusIcon} ${UI.bold('Workflow')} ${statusLabel}`);
    console.log();

    // Progress bar
    const total = (totalNodes as number) || 0;
    const executed = (executedNodes as number) || 0;
    const failed = (failedNodes as number) || 0;

    if (total > 0) {
      const progressStr = UI.progressBar(executed, total, { width: 30 });
      console.log(`  ${progressStr}`);
      console.log();
    }

    // Run info
    console.log(UI.labeledValue('Run ID', (runId as string) || '—'));
    if (title) {
      console.log(UI.labeledValue('Title', title as string));
    }

    // Time info
    if (createdAt) {
      const duration = UI.formatDuration(createdAt as string, updatedAt as string);
      console.log(
        UI.labeledValue(
          'Started',
          UI.formatTime(createdAt as string) + (duration ? ` (${duration})` : ''),
        ),
      );
    }

    // Node statuses
    const nodes = nodeStatuses as Array<Record<string, unknown>>;
    if (nodes && nodes.length > 0) {
      console.log();
      console.log(UI.dim('  Nodes:'));

      nodes.forEach((node, idx) => {
        const isLast = idx === nodes.length - 1;
        const prefix = isLast ? sym.BOX_BOTTOM_LEFT : sym.BOX_VERTICAL_RIGHT;
        const nodeIcon = UI.statusIcon(node.status as string);
        const nodeTitle = (node.title as string) || (node.nodeId as string);
        const nodeType = (node.nodeType as string) || '';
        const nodeProgress = node.progress as number;

        let line = `  ${prefix}${sym.BOX_HORIZONTAL} ${nodeIcon} ${nodeTitle}`;
        if (nodeType) {
          line += ` ${UI.dim(`(${nodeType})`)}`;
        }
        if (nodeProgress !== undefined && nodeProgress < 100 && node.status === 'executing') {
          line += ` ${UI.dim(`${nodeProgress}%`)}`;
        }
        console.log(line);

        // Show error message if failed
        if (node.status === 'failed' && node.errorMessage) {
          const errorPrefix = isLast ? '   ' : `  ${sym.BOX_VERTICAL}`;
          // Clean up error message (remove JSON array brackets if present)
          let errorMsg = node.errorMessage as string;
          if (errorMsg.startsWith('[') && errorMsg.endsWith(']')) {
            try {
              const parsed = JSON.parse(errorMsg);
              errorMsg = Array.isArray(parsed) ? parsed.join(', ') : errorMsg;
            } catch {
              // Keep original if not valid JSON
            }
          }
          if (errorMsg && errorMsg !== '[]') {
            console.log(`${errorPrefix}  ${UI.error(errorMsg)}`);
          }
        }
      });
    }

    // Summary stats
    if (failed > 0) {
      console.log();
      console.log(
        UI.stats([
          { label: 'Completed', value: executed, type: 'success' },
          { label: 'Failed', value: failed, type: 'error' },
          { label: 'Total', value: total },
        ]),
      );
    }

    // Watch mode indicator
    if (watching) {
      console.log();
      console.log(UI.dim(`  ${sym.RUNNING} Watching for updates...`));
    }

    // Completion message
    if (completed) {
      console.log();
      if (statusStr === 'finish') {
        console.log(UI.successMsg('Workflow completed successfully'));
      } else if (statusStr === 'failed') {
        console.log(UI.errorMsg('Workflow failed'));
      }
    }

    console.log();
  }

  private formatWorkflowStatus(status: string): string {
    const statusMap: Record<string, string> = {
      init: 'Initializing',
      executing: 'Executing',
      finish: 'Completed',
      failed: 'Failed',
    };
    return statusMap[status] || status;
  }

  // === Compact Format ===

  private outputCompact(type: string, payload: SuccessPayload): void {
    const { message, ...rest } = payload;
    const icon = this.useColor ? styled(Symbols.SUCCESS, Style.TEXT_SUCCESS) : AsciiSymbol.SUCCESS;

    const mainMsg = message || this.humanizeType(type);
    const extras = this.extractDisplayFields(rest)
      .slice(0, 3)
      .map(([k, v]) => `${k}=${this.formatValue(v)}`)
      .join(' ');

    console.log(`${icon} ${mainMsg}${extras ? ` ${UI.dim(extras)}` : ''}`);
  }

  private outputErrorCompact(error: ErrorPayload): void {
    const icon = this.useColor ? styled(Symbols.FAILURE, Style.TEXT_DANGER) : AsciiSymbol.FAILURE;

    console.log(`${icon} ${error.message} ${UI.dim(`[${error.code}]`)}`);
    if (error.hint) {
      console.log(UI.dim(`  ${error.hint}`));
    }
    if (error.suggestedFix) {
      console.log(UI.dim(`  fix: ${this.formatValue(error.suggestedFix)}`));
    }
  }

  // === Plain Format ===

  private outputPlain(type: string, payload: SuccessPayload): void {
    const { message, ...rest } = payload;
    const mainMsg = message || this.humanizeType(type);

    console.log(`[ok] ${mainMsg}`);

    const fields = this.extractDisplayFields(rest);
    for (const [key, value] of fields) {
      console.log(`  ${this.humanizeKey(key)}: ${this.formatValue(value)}`);
    }
  }

  private outputErrorPlain(error: ErrorPayload): void {
    console.log(`[err] ${error.message}`);
    console.log(`  code: ${error.code}`);
    if (error.hint) {
      console.log(`  hint: ${error.hint}`);
    }
    if (error.suggestedFix) {
      console.log(`  suggestedFix: ${this.formatValue(error.suggestedFix)}`);
    }
  }

  // === Helper Methods ===

  private humanizeType(type: string): string {
    // builder.add-node -> Add Node
    return type
      .split('.')
      .pop()!
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private humanizeKey(key: string): string {
    // nodeCount -> Node Count, runId -> Run ID
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .replace(/Id$/, 'ID')
      .trim();
  }

  private formatValue(value: unknown, indent = 0): string {
    if (value === null || value === undefined) {
      return UI.dim('—');
    }
    if (typeof value === 'boolean') {
      return this.formatBooleanValue(value);
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      // For simple arrays, join with comma
      if (value.every((v) => typeof v !== 'object' || v === null)) {
        return value.map((v) => this.formatValue(v)).join(', ');
      }
      // For arrays of objects, format each on new line
      return value.map((v) => this.formatValue(v, indent)).join(', ');
    }
    // For objects, format as key-value pairs
    if (typeof value === 'object') {
      return this.formatObject(value as Record<string, unknown>, indent);
    }
    return JSON.stringify(value);
  }

  private formatBooleanValue(value: boolean): string {
    if (value) {
      return this.useColor ? styled(Symbols.SUCCESS, Style.TEXT_SUCCESS) : 'yes';
    }
    return this.useColor ? styled(Symbols.FAILURE, Style.TEXT_DANGER) : 'no';
  }

  /**
   * Format an object as readable key-value pairs
   */
  private formatObject(obj: Record<string, unknown>, indent = 0): string {
    const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined);

    if (entries.length === 0) {
      return UI.dim('{}');
    }

    // For compact display (3 or fewer simple fields), show inline
    const simpleEntries = entries.filter(([, v]) => typeof v !== 'object');
    if (simpleEntries.length === entries.length && entries.length <= 3) {
      const parts = entries.map(([k, v]) => `${this.humanizeKey(k)}: ${this.formatValue(v)}`);
      return parts.join(', ');
    }

    // For larger objects, show as tree structure
    const lines: string[] = [];
    const sym = this.useUnicode ? Symbols : AsciiSymbol;
    const padding = ' '.repeat(indent);

    entries.forEach(([key, val], idx) => {
      const isLast = idx === entries.length - 1;
      const prefix = isLast ? sym.BOX_BOTTOM_LEFT : sym.BOX_VERTICAL_RIGHT;
      const humanKey = this.humanizeKey(key);

      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        // Nested object - show header then recurse
        lines.push(`${padding}${prefix}${sym.BOX_HORIZONTAL} ${UI.dim(humanKey)}:`);
        const nestedStr = this.formatObject(val as Record<string, unknown>, indent + 3);
        lines.push(nestedStr);
      } else {
        lines.push(
          `${padding}${prefix}${sym.BOX_HORIZONTAL} ${UI.dim(humanKey)}: ${this.formatValue(val)}`,
        );
      }
    });

    return lines.join('\n');
  }

  private extractDisplayFields(obj: Record<string, unknown>): Array<[string, unknown]> {
    return Object.entries(obj).filter(
      ([key, value]) =>
        value !== null && value !== undefined && typeof value !== 'object' && key !== 'nextStep',
    );
  }

  private extractNestedObjects(obj: Record<string, unknown>): Array<[string, unknown]> {
    return Object.entries(obj).filter(
      ([key, value]) =>
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        key !== 'node' && // Skip raw node data in pretty mode
        key !== 'diff',
    );
  }
}

/**
 * Global formatter instance
 */
let globalFormatter: OutputFormatter | null = null;

/**
 * Initialize the global formatter
 */
export function initFormatter(options: Partial<FormatterOptions> = {}): OutputFormatter {
  globalFormatter = new OutputFormatter(options);
  return globalFormatter;
}

/**
 * Get the global formatter (initializes with defaults if not set)
 */
export function getFormatter(): OutputFormatter {
  if (!globalFormatter) {
    globalFormatter = new OutputFormatter({ format: resolveFormat() });
  }
  return globalFormatter;
}

export default OutputFormatter;
