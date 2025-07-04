import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';

interface SkillOutputStatus {
  lastOutputTime: number;
  hasOutput: boolean;
  outputCount: number;
  startTime: number;
  events: string[];
}

@Injectable()
export class SkillOutputTrackerService {
  private readonly logger = new Logger(SkillOutputTrackerService.name);
  private readonly REDIS_KEY_PREFIX = 'skill:output:';
  private readonly DEFAULT_TTL = 3600; // 1 hour

  constructor(private readonly redis: RedisService) {}

  /**
   * Initialize tracking for a skill execution
   */
  async initializeTracking(resultId: string): Promise<void> {
    const key = this.getRedisKey(resultId);
    const status: SkillOutputStatus = {
      lastOutputTime: Date.now(),
      hasOutput: false,
      outputCount: 0,
      startTime: Date.now(),
      events: [],
    };

    try {
      await this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(status));
      this.logger.debug(`Initialized output tracking for ${resultId}`);
    } catch (error) {
      this.logger.error(`Failed to initialize tracking for ${resultId}: ${error?.message}`);
    }
  }

  /**
   * Record an output event (meaningful content)
   */
  async recordOutput(resultId: string, eventType: string): Promise<void> {
    const key = this.getRedisKey(resultId);

    try {
      const statusJson = await this.redis.get(key);
      if (!statusJson) {
        this.logger.warn(`No tracking record found for ${resultId}, initializing...`);
        await this.initializeTracking(resultId);
        return this.recordOutput(resultId, eventType);
      }

      const status: SkillOutputStatus = JSON.parse(statusJson);
      status.lastOutputTime = Date.now();
      status.hasOutput = true;
      status.outputCount += 1;
      status.events.push(`${eventType}:${Date.now()}`);

      // Keep only the last 10 events to prevent memory issues
      if (status.events.length > 10) {
        status.events = status.events.slice(-10);
      }

      await this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(status));
      this.logger.debug(`Recorded output for ${resultId}: ${eventType}`);
    } catch (error) {
      this.logger.error(`Failed to record output for ${resultId}: ${error?.message}`);
    }
  }

  /**
   * Check if the skill has been idle for too long
   */
  async checkIdleTimeout(
    resultId: string,
    timeoutMs: number,
  ): Promise<{
    isTimeout: boolean;
    timeSinceLastOutput: number;
    hasAnyOutput: boolean;
  }> {
    const key = this.getRedisKey(resultId);

    try {
      const statusJson = await this.redis.get(key);
      if (!statusJson) {
        this.logger.warn(`No tracking record found for ${resultId}`);
        return {
          isTimeout: true,
          timeSinceLastOutput: Number.POSITIVE_INFINITY,
          hasAnyOutput: false,
        };
      }

      const status: SkillOutputStatus = JSON.parse(statusJson);
      const now = Date.now();
      const timeSinceLastOutput = now - status.lastOutputTime;
      const isTimeout = timeSinceLastOutput > timeoutMs;

      this.logger.debug(
        `Timeout check for ${resultId}: ${timeSinceLastOutput}ms since last output, timeout=${isTimeout}`,
      );

      return {
        isTimeout,
        timeSinceLastOutput,
        hasAnyOutput: status.hasOutput,
      };
    } catch (error) {
      this.logger.error(`Failed to check timeout for ${resultId}: ${error?.message}`);
      // When Redis is unavailable, don't timeout skills - let them continue running
      return {
        isTimeout: false,
        timeSinceLastOutput: 0,
        hasAnyOutput: false,
      };
    }
  }

  /**
   * Get current status for debugging
   */
  async getStatus(resultId: string): Promise<SkillOutputStatus | null> {
    const key = this.getRedisKey(resultId);

    try {
      const statusJson = await this.redis.get(key);
      return statusJson ? JSON.parse(statusJson) : null;
    } catch (error) {
      this.logger.error(`Failed to get status for ${resultId}: ${error?.message}`);
      return null;
    }
  }

  /**
   * Clean up tracking data when skill completes
   */
  async cleanupTracking(resultId: string): Promise<void> {
    const _key = this.getRedisKey(resultId);

    try {
      // We don't actually delete the key immediately, just let it expire
      // This allows for debugging and prevents issues if cleanup is called multiple times
      this.logger.debug(`Cleanup tracking for ${resultId} (will expire naturally)`);
    } catch (error) {
      this.logger.error(`Failed to cleanup tracking for ${resultId}: ${error?.message}`);
    }
  }

  private getRedisKey(resultId: string): string {
    return `${this.REDIS_KEY_PREFIX}${resultId}`;
  }

  /**
   * Determine if an event type should be considered as meaningful output
   */
  static isOutputEvent(eventType: string): boolean {
    const outputEvents = [
      'stream', // Chat model streaming content
      'tool_end', // Tool execution completed
      'artifact', // Artifact generated
      'log', // Skill logs (might contain important info)
      'structured_data', // Structured output
      'create_node', // Node creation
    ];

    const _nonOutputEvents = [
      'token_usage', // Just metadata
      'start', // Just start signal
      'end', // Just end signal
    ];

    return outputEvents.includes(eventType);
  }
}
