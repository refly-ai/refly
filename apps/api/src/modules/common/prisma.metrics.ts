import { Injectable, OnModuleInit } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { metrics } from '@opentelemetry/api';
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
 * - db.slow_query.count{operation, model} - Slow query counter (>100ms)
 * - db.query.count{operation, model} - Total query counter
 */
@Injectable()
export class PrismaMetrics implements OnModuleInit {
  private readonly SLOW_QUERY_THRESHOLD_MS = 100;

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
      const labels = { operation, model };

      // Record metrics
      queryDuration.record(e.duration, labels);
      queryCounter.add(1, labels);

      if (e.duration > this.SLOW_QUERY_THRESHOLD_MS) {
        slowQueryCounter.add(1, labels);
        this.logger.warn(`Slow query detected: ${operation} on ${model} took ${e.duration}ms`);
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
   * Extract table/model name from SQL query
   */
  private extractModel(query: string): string {
    // Pattern 1: FROM "TableName" or INTO "TableName" or UPDATE "TableName"
    const fromMatch = query.match(/(?:FROM|INTO|UPDATE)\s+"?(\w+)"?/i);
    if (fromMatch) {
      return fromMatch[1];
    }

    // Pattern 2: "TableName".field
    const tableMatch = query.match(/"(\w+)"\./);
    if (tableMatch) {
      return tableMatch[1];
    }

    // Pattern 3: JOIN "TableName"
    const joinMatch = query.match(/JOIN\s+"?(\w+)"?/i);
    if (joinMatch) {
      return joinMatch[1];
    }

    return 'unknown';
  }
}
