import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { ExtractVariablesRequest, GenerateAppTemplateRequest, User } from '@refly/openapi-schema';
import {
  AppTemplateResult,
  VariableExtractionResult,
} from 'src/modules/variable-extraction/variable-extraction.dto';
import { VariableExtractionService } from 'src/modules/variable-extraction/variable-extraction.service';

@Controller('v1/variable-extraction')
export class VariableExtractionController {
  constructor(private readonly variableExtractionService: VariableExtractionService) {}

  /**
   * APP publishing template generation endpoint
   * Generates user intent templates based on all original Canvas prompts and variables
   */
  @UseGuards(JwtAuthGuard)
  @Post('generate-template')
  async generateAppTemplate(
    @LoginedUser() user: User,
    @Body() body: GenerateAppTemplateRequest,
  ): Promise<AppTemplateResult> {
    return this.variableExtractionService.generateAppPublishTemplate(user, body.canvasId);
  }

  /**
   * Unified variable extraction interface
   * Supports two modes: 'direct' (directly update Canvas variables) and 'candidate' (return candidate solutions)
   */
  @UseGuards(JwtAuthGuard)
  @Post('extract')
  async extractVariables(
    @LoginedUser() user: User,
    @Body() body: ExtractVariablesRequest,
  ): Promise<VariableExtractionResult> {
    return this.variableExtractionService.extractVariables(user, body.prompt, body.canvasId, {
      mode: body.mode,
      sessionId: body.sessionId,
    });
  }
}
