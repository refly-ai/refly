import { Controller, Post, Body, Logger } from '@nestjs/common';
import { CopilotAutogenService } from './copilot-autogen.service';
import { GenerateWorkflowRequest } from './copilot-autogen.dto';
import { buildSuccessResponse } from '../../utils';

@Controller('v1/copilot-autogen')
export class CopilotAutogenController {
  private readonly logger = new Logger(CopilotAutogenController.name);

  constructor(private copilotAutogenService: CopilotAutogenService) {}

  @Post('generate')
  async generateWorkflow(@Body() body: GenerateWorkflowRequest) {
    this.logger.log(`[Autogen API] Received request from user ${body.uid}`);
    this.logger.log(`[Autogen API] Query: ${body.query}`);

    try {
      const result = await this.copilotAutogenService.generateWorkflow(body);
      this.logger.log(`[Autogen API] Successfully generated workflow in canvas ${result.canvasId}`);
      return buildSuccessResponse(result);
    } catch (error) {
      this.logger.error(`[Autogen API] Failed to generate workflow: ${error.message}`);
      throw error;
    }
  }
}
