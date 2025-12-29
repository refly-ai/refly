import { Controller, Logger, Post, Body } from '@nestjs/common';
import { SandboxService } from './sandbox.service';

interface ExecuteCodeRequest {
  language: string;
  code: string;
  timeout?: number;
}

interface ExecuteCodeResponse {
  success: boolean;
  data?: {
    requestId: string;
    success: boolean;
    stdout?: string;
    stderr?: string;
    error?: string;
    exitCode?: number;
    executionTime?: number;
  };
  error?: string;
}

@Controller('v1/sandbox')
export class SandboxController {
  private readonly logger = new Logger(SandboxController.name);

  constructor(private sandboxService: SandboxService) {}

  @Post('execute')
  async execute(@Body() body: ExecuteCodeRequest): Promise<ExecuteCodeResponse> {
    const { language, code, timeout } = body;

    this.logger.log(`Received execute request: language=${language}`);

    try {
      const result = await this.sandboxService.execute(language, code, timeout);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Execute request failed:', error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
