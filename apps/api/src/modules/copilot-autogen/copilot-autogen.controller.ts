import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { CopilotAutogenService } from './copilot-autogen.service';
import { GenerateWorkflowRequest } from './copilot-autogen.dto';
import { buildSuccessResponse } from '../../utils';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User } from '@refly/openapi-schema';

@Controller('v1/copilot-autogen')
export class CopilotAutogenController {
  private readonly logger = new Logger(CopilotAutogenController.name);

  constructor(private copilotAutogenService: CopilotAutogenService) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generateWorkflow(@LoginedUser() user: User, @Body() body: GenerateWorkflowRequest) {
    this.logger.log(`[Autogen API] Received request from user ${user.uid}`);
    this.logger.log(`[Autogen API] Query: ${body.query}`);

    try {
      const result = await this.copilotAutogenService.generateWorkflow(user, body);
      this.logger.log(`[Autogen API] Successfully generated workflow in canvas ${result.canvasId}`);
      return buildSuccessResponse(result);
    } catch (error) {
      this.logger.error(`[Autogen API] Failed to generate workflow: ${error.message}`);
      throw error;
    }
  }
}
