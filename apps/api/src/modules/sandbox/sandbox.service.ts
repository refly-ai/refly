import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { v4 as uuidv4 } from 'uuid';

interface ExecuteRequest {
  requestId: string;
  language: string;
  code: string;
  timeout?: number;
}

interface ExecuteResponse {
  requestId: string;
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  exitCode?: number;
  executionTime?: number;
}

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);
  private readonly REQUEST_CHANNEL = 'sandbox:execute:request';
  private readonly RESPONSE_CHANNEL_PREFIX = 'sandbox:execute:response:';
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  constructor(private redisService: RedisService) {}

  async execute(language: string, code: string, timeout?: number): Promise<ExecuteResponse> {
    const requestId = uuidv4();
    const responseChannel = `${this.RESPONSE_CHANNEL_PREFIX}${requestId}`;
    const timeoutMs = timeout || this.DEFAULT_TIMEOUT;

    const request: ExecuteRequest = {
      requestId,
      language,
      code,
      timeout: Math.floor(timeoutMs / 1000), // Convert to seconds for worker
    };

    this.logger.log(`Executing code: requestId=${requestId}, language=${language}`);

    try {
      // Get Redis client and create subscriber
      const client = this.redisService.getClient();
      const subscriber = client.duplicate();

      // Subscribe to response channel
      await subscriber.subscribe(responseChannel);

      // Send request
      const payload = JSON.stringify(request);
      await client.publish(this.REQUEST_CHANNEL, payload);
      this.logger.log(`Request published: requestId=${requestId}`);

      // Wait for response with timeout
      const response = await this.waitForResponse(subscriber, responseChannel, timeoutMs);

      // Cleanup
      await subscriber.unsubscribe(responseChannel);
      await subscriber.quit();

      return response;
    } catch (error) {
      this.logger.error(`Execution failed: requestId=${requestId}`, error.stack);
      throw error;
    }
  }

  private waitForResponse(
    subscriber: any,
    channel: string,
    timeoutMs: number,
  ): Promise<ExecuteResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      subscriber.on('message', (ch: string, message: string) => {
        if (ch === channel) {
          clearTimeout(timer);
          try {
            const response = JSON.parse(message) as ExecuteResponse;
            this.logger.log(`Response received: requestId=${response.requestId}`);
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        }
      });
    });
  }
}
