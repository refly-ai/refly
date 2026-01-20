import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import {
  WorkerExecuteRequest,
  WorkerExecuteResponse,
  SandboxExecuteParams,
  SandboxExecutionContext,
} from './sandbox.schema';
import { SANDBOX_HTTP, SANDBOX_TIMEOUTS } from './sandbox.constants';
import { SandboxExecutionTimeoutError } from './sandbox.exception';
import { Config } from '../config/config.decorator';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SandboxClient {
  @Config.string('sandbox.url', SANDBOX_HTTP.DEFAULT_URL)
  private readonly sandboxUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SandboxClient.name);
    void this.config; // Suppress unused warning
  }

  async executeCode(
    params: SandboxExecuteParams,
    context: SandboxExecutionContext,
    timeout?: number,
  ): Promise<WorkerExecuteResponse> {
    const requestId = uuidv4();
    const timeoutMs = timeout || SANDBOX_TIMEOUTS.DEFAULT;
    const startTime = performance.now();

    this.logger.info({
      requestId,
      language: params.language,
      canvasId: context.canvasId,
      uid: context.uid,
      codeLength: params.code?.length,
      envKeys: context.env ? Object.keys(context.env) : [],
    });

    const request: WorkerExecuteRequest = {
      requestId,
      code: params.code,
      language: params.language,
      provider: params.provider,
      config: {
        s3: context.s3Config,
        s3DrivePath: context.s3DrivePath,
        s3LibConfig: context.s3LibConfig,
        env: context.env,
        timeout: context.timeout || timeoutMs,
        limits: context.limits,
      },
      metadata: {
        uid: context.uid,
        canvasId: context.canvasId,
        parentResultId: context.parentResultId,
        targetId: context.targetId,
        targetType: context.targetType,
        model: context.model,
        providerItemId: context.providerItemId,
        version: context.version,
      },
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${this.sandboxUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = (await response.json()) as WorkerExecuteResponse;
      const totalTime = performance.now() - startTime;

      this.logger.info({
        requestId,
        status: result.status,
        exitCode: result.data?.exitCode,
        hasError: !!result.data?.error,
        filesCount: result.data?.files?.length || 0,
        totalMs: Math.round(totalTime * 100) / 100,
      });

      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw SandboxExecutionTimeoutError.create(requestId, timeoutMs);
      }
      throw error;
    }
  }
}
