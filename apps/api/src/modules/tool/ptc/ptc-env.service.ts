import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { SandboxExecuteRequest, User } from '@refly/openapi-schema';
import { Config } from '../../config/config.decorator';
import { ApiKeyService } from '../../auth/api-key.service';

export interface PtcEnvVars {
  REFLY_TOOL_SERVICE_API_URL: string;
  REFLY_TOOL_SERVICE_API_KEY: string;
  REFLY_PTC_DEBUG: string;
  REFLY_CANVAS_ID: string;
  REFLY_RESULT_ID?: string;
  REFLY_RESULT_VERSION?: string;
  REFLY_PTC_CALL_ID?: string;
}

interface CachedApiKey {
  apiKey: string;
  createdAt: number;
}

/** Cache TTL: 12 hours (leaves buffer before the 1-day key expiration) */
const API_KEY_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class PtcEnvService {
  @Config.string('endpoint', 'http://localhost:5800')
  private readonly endpoint: string;

  /** In-memory cache: uid -> cached API key */
  private readonly apiKeyCache = new Map<string, CachedApiKey>();

  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
    private readonly apiKeyService: ApiKeyService,
  ) {
    this.logger.setContext(PtcEnvService.name);
    void this.config; // Suppress unused warning - used by @Config decorators
  }

  /**
   * Get PTC environment variables for sandbox execution
   * In development mode, use environment variables directly
   * In production, create temporary API key for sandbox authentication
   *
   * @param user - User
   * @param req - Sandbox execute request containing context
   */
  async getPtcEnvVars(user: User, req: SandboxExecuteRequest): Promise<PtcEnvVars> {
    const toolServiceApiUrl = this.endpoint.replace('localhost', 'host.docker.internal');
    const toolServiceApiKey = await this.getOrCreateApiKey(user.uid);
    const isPtcDebugEnabled = this.config.get<string>('ptc.debug') === 'true';

    return {
      REFLY_TOOL_SERVICE_API_URL: toolServiceApiUrl,
      REFLY_TOOL_SERVICE_API_KEY: toolServiceApiKey,
      REFLY_PTC_DEBUG: String(isPtcDebugEnabled),
      REFLY_CANVAS_ID: req.context?.canvasId ?? undefined,
      REFLY_RESULT_ID: req.context?.parentResultId ?? undefined,
      REFLY_RESULT_VERSION: req.context?.version ? String(req.context?.version) : undefined,
      REFLY_PTC_CALL_ID: req.context?.toolCallId ?? undefined,
    };
  }

  /**
   * Get a cached API key for the user, or create a new one if expired/missing.
   */
  private async getOrCreateApiKey(uid: string): Promise<string> {
    const cached = this.apiKeyCache.get(uid);
    if (cached && Date.now() - cached.createdAt < API_KEY_CACHE_TTL_MS) {
      return cached.apiKey;
    }

    const sessionName = `PTC_SESSION_${uid}`;
    const created = await this.apiKeyService.createApiKey(uid, sessionName, 1);

    this.apiKeyCache.set(uid, { apiKey: created.apiKey, createdAt: Date.now() });

    return created.apiKey;
  }
}
