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

  @Config.string('sandbox.skillLib.endpoint', '')
  private readonly skillLibEndpoint: string;

  @Config.string('sandbox.skillLib.bucket', '')
  private readonly skillLibBucket: string;

  @Config.string('sandbox.skillLib.region', '')
  private readonly skillLibRegion: string;

  @Config.string('sandbox.skillLib.accessKey', '')
  private readonly skillLibAccessKey: string;

  @Config.string('sandbox.skillLib.secretKey', '')
  private readonly skillLibSecretKey: string;

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
        ...(skillLibConfig ? { skillLibConfig: skillLibConfig.config } : {}),
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
    skillLibConfig?: { config: Record<string, unknown> };
  } {
    if (params.language !== 'skill') {
      return { normalizedParams: params };
    }

    const skillLibConfig = this.buildSkillLibConfig(context);

    return {
      normalizedParams: params,
      skillLibConfig: { config: skillLibConfig },
    };
  }

  private buildSkillLibConfig(context: SandboxExecutionContext): Record<string, unknown> {
    this.logger.info({ skillLibEndpoint: this.skillLibEndpoint }, 'Skill lib endpoint override');
    const normalizedPrefix = this.skillLibPathPrefix
      ? this.skillLibPathPrefix.replace(/\/+$/, '')
      : '';

    let path = '';
    let hash = '';
    if (normalizedPrefix || this.skillLibHash) {
      if (!normalizedPrefix || !this.skillLibHash) {
        throw new Error('cc-skill requires skillLibConfig path/hash');
      }
      path = `${normalizedPrefix}/${this.skillLibHash}`;
      hash = this.skillLibHash;
    } else if (context.s3LibConfig?.path && context.s3LibConfig?.hash) {
      path = context.s3LibConfig.path;
      hash = context.s3LibConfig.hash;
    } else {
      throw new Error('cc-skill requires skillLibConfig path/hash');
    }

    const endpoint = this.skillLibEndpoint || this.normalizeEndpoint(context.s3Config);
    if (!endpoint) {
      throw new Error('cc-skill requires a valid s3 endpoint for skillLibConfig');
    }

    const bucket = this.skillLibBucket || context.s3LibConfig?.bucket || context.s3Config.bucket;
    const region = this.skillLibRegion || context.s3LibConfig?.region || context.s3Config.region;
    if (!bucket || !region) {
      throw new Error('cc-skill requires skillLibConfig bucket/region');
    }

    const accessKey =
      this.skillLibAccessKey || context.s3LibConfig?.accessKey || context.s3Config.accessKey;
    const secretKey =
      this.skillLibSecretKey || context.s3LibConfig?.secretKey || context.s3Config.secretKey;

    return {
      endpoint,
      bucket,
      region,
      path,
      hash,
      ...(accessKey ? { accessKey } : {}),
      ...(secretKey ? { secretKey } : {}),
      ...(context.s3LibConfig?.reset !== undefined ? { reset: context.s3LibConfig.reset } : {}),
    };
  }

  private normalizeEndpoint(
    s3Config: Partial<{ endPoint: string; port: number; useSSL: boolean }>,
  ): string {
    const endPoint = s3Config.endPoint;
    if (!endPoint) return '';
    if (endPoint.startsWith('http://') || endPoint.startsWith('https://')) {
      return endPoint;
    }

    const scheme = s3Config.useSSL ? 'https' : 'http';
    const port = s3Config.port;
    const includePort =
      port &&
      !Number.isNaN(port) &&
      !(scheme === 'http' && port === 80) &&
      !(scheme === 'https' && port === 443);

    return includePort ? `${scheme}://${endPoint}:${port}` : `${scheme}://${endPoint}`;
  }
}
