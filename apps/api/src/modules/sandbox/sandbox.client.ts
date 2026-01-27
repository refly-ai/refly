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

  @Config.string('sandbox.skillLib.pathPrefix', '')
  private readonly skillLibPathPrefix: string;

  @Config.string('sandbox.skillLib.hash', '')
  private readonly skillLibHash: string;

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
    const { normalizedParams, skillLibConfig } = this.transformSkillRequestIfNeeded(
      params,
      context,
    );

    this.logger.info({
      requestId,
      language: normalizedParams.language,
      canvasId: context.canvasId,
      uid: context.uid,
      codeLength: normalizedParams.code?.length,
      envKeys: context.env ? Object.keys(context.env) : [],
    });

    const request: WorkerExecuteRequest = {
      requestId,
      code: normalizedParams.code,
      language: normalizedParams.language,
      provider: normalizedParams.provider,
      config: {
        s3: context.s3Config,
        s3DrivePath: context.s3DrivePath,
        s3LibConfig: context.s3LibConfig,
        env: context.env,
        timeout: context.timeout || timeoutMs,
        limits: context.limits,
        ...(skillLibConfig
          ? {
              skill: { key: skillLibConfig.skillKey },
              skillLibConfig: skillLibConfig.config,
            }
          : {}),
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

  private transformSkillRequestIfNeeded(
    params: SandboxExecuteParams,
    context: SandboxExecutionContext,
  ): {
    normalizedParams: SandboxExecuteParams;
    skillLibConfig?: { skillKey: string; config: Record<string, unknown> };
  } {
    if (params.language !== 'shell') {
      return { normalizedParams: params };
    }

    const rawCode = params.code?.trim() || '';
    const prefix = 'cc-skill ';
    if (!rawCode.startsWith(prefix)) {
      return { normalizedParams: params };
    }

    const skillKey = rawCode.slice(prefix.length).trim();
    if (!skillKey) {
      throw new Error('cc-skill requires a skill key');
    }

    const skillLibConfig = this.buildSkillLibConfig(context);

    return {
      normalizedParams: {
        ...params,
        code: "echo 'Skill taken over'",
      },
      skillLibConfig: { skillKey, config: skillLibConfig },
    };
  }

  private buildSkillLibConfig(context: SandboxExecutionContext): Record<string, unknown> {
    if (!context.s3LibConfig) {
      throw new Error('cc-skill requires s3LibConfig to build skillLibConfig');
    }

    const normalizedPrefix = this.skillLibPathPrefix
      ? this.skillLibPathPrefix.replace(/\/+$/, '')
      : '';
    const path = normalizedPrefix
      ? `${normalizedPrefix}/${this.skillLibHash}`
      : context.s3LibConfig.path;
    const hash = this.skillLibHash || context.s3LibConfig.hash;

    if (!path || !hash) {
      throw new Error('cc-skill requires skillLibConfig path/hash');
    }

    const endpoint = this.normalizeEndpoint(context.s3Config);
    if (!endpoint) {
      throw new Error('cc-skill requires a valid s3 endpoint for skillLibConfig');
    }

    return {
      endpoint,
      bucket: context.s3LibConfig.bucket,
      region: context.s3LibConfig.region,
      path,
      hash,
      accessKey: context.s3LibConfig.accessKey,
      secretKey: context.s3LibConfig.secretKey,
      reset: context.s3LibConfig.reset,
    };
  }

  private normalizeEndpoint(s3Config: { endPoint: string; port: number; useSSL: boolean }): string {
    if (!s3Config.endPoint) return '';
    if (s3Config.endPoint.startsWith('http://') || s3Config.endPoint.startsWith('https://')) {
      return s3Config.endPoint;
    }

    const scheme = s3Config.useSSL ? 'https' : 'http';
    const port = s3Config.port;
    const includePort =
      port &&
      !Number.isNaN(port) &&
      !(scheme === 'http' && port === 80) &&
      !(scheme === 'https' && port === 443);

    return includePort
      ? `${scheme}://${s3Config.endPoint}:${port}`
      : `${scheme}://${s3Config.endPoint}`;
  }
}
