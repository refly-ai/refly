import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { EvalServiceKeyGuard } from './eval.guard';
import { EvalService } from './eval.service';
import { EvalRunRequest, EvalRunResponse } from './eval.types';

@Controller('internal/eval')
@UseGuards(EvalServiceKeyGuard)
export class EvalController {
  constructor(private readonly evalService: EvalService) {}

  @Post('v1/run')
  async run(@Body() body: EvalRunRequest): Promise<EvalRunResponse> {
    return this.evalService.run(body);
  }

  @Post('v1/healthz')
  healthz(): { status: string } {
    return { status: 'ok' };
  }
}
