import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User } from '@refly/openapi-schema';
import { VariableExtractionResult } from 'src/modules/variable-extraction/variable-extraction.dto';
import { VariableExtractionService } from 'src/modules/variable-extraction/variable-extraction.service';

@Controller('v1/variable-extraction')
export class VariableExtractionController {
  constructor(private readonly variableExtractionService: VariableExtractionService) {}

  /**
   * Unified variable extraction interface
   * Supports two modes: 'direct' (directly update Canvas variables) and 'candidate' (return candidate solutions)
   */
  @UseGuards(JwtAuthGuard)
  @Post('extract')
  async extractVariables(
    @LoginedUser() user: User,
    @Body() body: {
      prompt: string; // Original natural language prompt
      canvasId: string; // Canvas ID, used to get existing variable context
      mode: 'direct' | 'candidate'; // Processing mode
      sessionId?: string; // Optional, check for candidate records when in direct mode
    },
  ): Promise<VariableExtractionResult> {
    return this.variableExtractionService.extractVariables(user, body.prompt, body.canvasId, {
      mode: body.mode,
      sessionId: body.sessionId,
    });
  }
}
