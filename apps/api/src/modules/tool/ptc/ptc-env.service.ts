import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SandboxExecuteRequest, User } from '@refly/openapi-schema';
import { Config } from '../../config/config.decorator';
import { ApiKeyService } from '../../auth/api-key.service';
import { getEnv, IENV } from '@refly/utils';

export interface PtcEnvVars {
  REFLY_TOOL_SERVICE_API_URL: string;
  REFLY_TOOL_SERVICE_API_KEY: string;
  REFLY_RESULT_ID?: string;
  REFLY_RESULT_VERSION?: string;
  REFLY_PTC_CALL_ID?: string;
}

@Injectable()
export class PtcEnvService {
  @Config.string('endpoint', 'http://localhost:5800')
  private readonly endpoint: string;

  constructor(
    private readonly logger: PinoLogger,
    private readonly apiKeyService: ApiKeyService,
  ) {
    this.logger.setContext(PtcEnvService.name);
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
    const { parentResultId: resultId, version, toolCallId } = req.context ?? {};

    // Context tracking environment variables
    const contextEnvVars: Partial<PtcEnvVars> = {
      ...(resultId && { REFLY_RESULT_ID: resultId }),
      ...(version !== undefined && { REFLY_RESULT_VERSION: String(version) }),
      ...(toolCallId && { REFLY_PTC_CALL_ID: toolCallId }),
    };

    if (getEnv() === IENV.DEVELOPMENT) {
      return {
        REFLY_TOOL_SERVICE_API_URL: process.env.REFLY_TOOL_SERVICE_API_URL,
        REFLY_TOOL_SERVICE_API_KEY: process.env.REFLY_TOOL_SERVICE_API_KEY,
        ...contextEnvVars,
      };
    }

    // Create temporary API key for sandbox authentication (1 day expiration)
    // Use parentResultId if available, otherwise use a generic name
    const sessionName = resultId ? `PTC_SESSION_${resultId}` : 'PTC_SESSION_GENERIC';
    const createdApiKey = await this.apiKeyService.createApiKey(user.uid, sessionName, 1);

    return {
      REFLY_TOOL_SERVICE_API_URL: this.endpoint,
      REFLY_TOOL_SERVICE_API_KEY: createdApiKey.apiKey,
      ...contextEnvVars,
    };
  }
}
