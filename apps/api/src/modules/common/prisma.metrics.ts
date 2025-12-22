import { Injectable, OnModuleInit } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { metrics, trace } from '@opentelemetry/api';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';

interface QueryEvent {
  query: string;
  params: string;
  duration: number;
  timestamp: Date;
  target: string;
}

/**
 * Automatic Prisma query monitoring service
 *
 * This service hooks into PrismaService's query events during module initialization
 * and records OpenTelemetry metrics automatically. No changes to PrismaService required.
 *
 * Metrics produced:
 * - db.query.duration{operation, model} - Query execution time histogram
 *   - Labels: operation (SELECT/INSERT/etc), model (table name)
 * - db.slow_query.count{operation, model} - Slow query counter (>100ms)
 * - db.query.count{operation, model} - Total query counter
 *
 * Architecture:
 * - Low cardinality labels: operation × model (for aggregation)
 * - SQL sanitization: Lightweight string replacement (high performance)
 * - Trace linking: traceId + sanitized SQL in structured logs
 */
@Injectable()
export class PrismaMetrics implements OnModuleInit {
  private readonly SLOW_QUERY_THRESHOLD_MS = 100;
  private readonly MAX_SQL_LENGTH = 200; // Limit SQL template length

  // Known table names from Prisma schema
  private readonly KNOWN_TABLES = new Set([
    // Core tables
    'accounts',
    'verification_sessions',
    'users',
    // Action/Skill tables
    'action_results',
    'action_steps',
    'action_messages',
    'pilot_sessions',
    'pilot_steps',
    'copilot_sessions',
    'skill_instances',
    'skill_triggers',
    // Workflow tables
    'workflow_executions',
    'workflow_node_executions',
    'workflow_apps',
    // Canvas tables
    'canvases',
    'canvas_versions',
    'canvas_templates',
    'canvas_template_categories',
    'canvas_template_category_relations',
    'canvas_entity_relations',
    // Resource tables
    'resources',
    'documents',
    'code_artifacts',
    'drive_files',
    'static_files',
    'file_parse_records',
    // Project/Share tables
    'projects',
    'share_records',
    'duplicate_records',
    // Billing/Credit tables
    'token_usages',
    'subscriptions',
    'credit_recharges',
    'vouchers',
    // Provider/Tool tables
    'providers',
    'provider_items',
    'toolset_inventory',
    'tool_methods',
    'tool_instances',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PrismaMetrics.name);
  }

  async onModuleInit() {
    this.logger.info('Initializing Prisma metrics monitoring');
    this.initializeMetrics();
  }

  private initializeMetrics() {
    // Create OpenTelemetry metrics
    const meter = metrics.getMeter('refly-api');
    const queryDuration = meter.createHistogram('db.query.duration', {
      description: 'Database query execution time',
      unit: 'ms',
    });
    const slowQueryCounter = meter.createCounter('db.slow_query.count', {
      description: `Number of slow queries (>${this.SLOW_QUERY_THRESHOLD_MS}ms)`,
    });
    const queryCounter = meter.createCounter('db.query.count', {
      description: 'Total number of database queries',
    });

    // Attach to Prisma query events
    (this.prisma as unknown as PrismaClient).$on('query' as never, (e: QueryEvent) => {
      const operation = this.extractOperation(e.query);
      const model = this.extractModel(e.query);

      // Sanitize SQL to create template (removes parameter values)
      const sanitizedSql = this.sanitizeQuery(e.query);

      // Get current trace ID for linking metrics → traces
      const span = trace.getActiveSpan();
      const traceId = span?.spanContext().traceId || '';

      // Low cardinality labels (for aggregation & dashboards)
      const labels = { operation, model };

      // Record metrics
      queryDuration.record(e.duration, labels);
      queryCounter.add(1, labels);

      // Slow query detection with detailed context
      if (e.duration > this.SLOW_QUERY_THRESHOLD_MS) {
        slowQueryCounter.add(1, labels);
        this.logger.warn({
          msg: 'Slow query detected',
          operation,
          model,
          duration: e.duration,
          sql: sanitizedSql,
          trace_id: traceId,
        });
      }
    });

    this.logger.info('Prisma metrics monitoring initialized successfully');
  }

  /**
   * Extract SQL operation type from query string
   */
  private extractOperation(query: string): string {
    const match = query
      .trim()
      .match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|BEGIN|COMMIT|ROLLBACK)/i);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
  }

  /**
   * Extract table/model name from SQL query using heuristic rules
   *
   * Strategy (100% classification):
   * 1. Special cases: transaction commands, health checks
   * 2. Match "schema"."table" pattern and find known tables
   * 3. Extract all quoted identifiers and find first known table
   * 4. Fallback: use first non-schema quoted identifier
   * 5. Last resort: classify as _complex_query or _unclassified
   */
  private extractModel(query: string): string {
    const trimmedQuery = query.trim();

    // Priority 1: Transaction statements (no table involved)
    const operation = this.extractOperation(trimmedQuery);
    if (operation === 'BEGIN' || operation === 'COMMIT' || operation === 'ROLLBACK') {
      return '_transaction';
    }

    // Priority 2: Health check queries
    if (trimmedQuery === 'SELECT 1' || /^SELECT\s+1\s*$/i.test(trimmedQuery)) {
      return '_health_check';
    }

    // Priority 3: Try to match "schema"."table" pattern
    // Matches: "refly"."users" or "public"."canvases"
    const schemaTablePattern = /"[^"]+"\."([^"]+)"/g;
    let match: RegExpExecArray | null = null;
    match = schemaTablePattern.exec(trimmedQuery);
    while (match !== null) {
      const tableName = match[1];
      if (this.KNOWN_TABLES.has(tableName)) {
        return tableName;
      }
      match = schemaTablePattern.exec(trimmedQuery);
    }

    // Priority 4: Extract all quoted identifiers and find first known table
    // Matches: "users", "canvases", etc.
    const quotedPattern = /"([^"]+)"/g;
    const allIdentifiers: string[] = [];
    match = quotedPattern.exec(trimmedQuery);
    while (match !== null) {
      allIdentifiers.push(match[1]);
      match = quotedPattern.exec(trimmedQuery);
    }

    // Filter out common schema names
    const schemaNames = new Set(['refly', 'public', 'pg_catalog', 'information_schema']);
    const nonSchemaIdentifiers = allIdentifiers.filter((id) => !schemaNames.has(id));

    // Find first known table
    for (const identifier of nonSchemaIdentifiers) {
      if (this.KNOWN_TABLES.has(identifier)) {
        return identifier;
      }
    }

    // Priority 5: Fallback - use first non-schema identifier (might be table name)
    if (nonSchemaIdentifiers.length > 0) {
      return nonSchemaIdentifiers[0];
    }

    // Priority 6: Last resort - complex query without clear table reference
    return '_unclassified';
  }

  /**
   * Sanitize SQL query by removing parameter values
   *
   * Uses lightweight string replacement for high performance.
   * Limits output length to prevent huge SQL templates in logs.
   *
   * Example:
   *   Input:  SELECT * FROM "users" WHERE id = $1 AND name = 'John'
   *   Output: SELECT * FROM "users" WHERE id = ? AND name = ?
   */
  private sanitizeQuery(query: string): string {
    return query
      .replace(/\$\d+/g, '?') // Postgres parameters: $1, $2, ... → ?
      .replace(/'[^']*'/g, "'?'") // String literals: 'value' → '?'
      .replace(/\b\d+\b/g, '?') // Standalone numbers: 123 → ?
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()
      .substring(0, this.MAX_SQL_LENGTH);
  }
}
