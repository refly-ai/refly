import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Config } from '../../config/config.decorator';
import { ApiKeyService } from '../../auth/api-key.service';
import { getEnv, IENV } from '@refly/utils';

export interface PtcEnvVars {
  REFLY_TOOL_SERVICE_API_URL: string;
  REFLY_TOOL_SERVICE_API_KEY: string;
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
   */
  async getPtcEnvVars(uid: string, resultId?: string): Promise<PtcEnvVars> {
    if (getEnv() === IENV.DEVELOPMENT) {
      return {
        REFLY_TOOL_SERVICE_API_URL: process.env.REFLY_TOOL_SERVICE_API_URL,
        REFLY_TOOL_SERVICE_API_KEY: process.env.REFLY_TOOL_SERVICE_API_KEY,
      };
    }

    // Create temporary API key for sandbox authentication (1 day expiration)
    // Use resultId if available, otherwise use a generic name
    const sessionName = resultId ? `PTC_SESSION_${resultId}` : 'PTC_SESSION_GENERIC';
    const createdApiKey = await this.apiKeyService.createApiKey(uid, sessionName, 1);

    return {
      REFLY_TOOL_SERVICE_API_URL: this.endpoint,
      REFLY_TOOL_SERVICE_API_KEY: createdApiKey.apiKey,
    };
  }
}
