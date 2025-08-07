import { Module } from '@nestjs/common';
import { DivergentService } from './divergent.service';
import { DivergentSessionService } from './divergent-session.service';
import { DivergentController } from './divergent.controller';
import { DivergentEngine } from './engines/divergent-engine';
import { SkillOrchestrator } from './engines/skill-orchestrator';
import { CommonModule } from '../common/common.module';

/**
 * DivergentAgent module
 * Implements total-divide-total loop functionality using existing skillResponse architecture
 */
@Module({
  imports: [CommonModule],
  controllers: [DivergentController],
  providers: [
    DivergentService,
    DivergentSessionService,
    DivergentEngine,
    SkillOrchestrator,
    {
      provide: 'SkillService',
      useValue: null, // Will be properly provided in production
    },
    {
      provide: 'BaseChatModel',
      useValue: null, // Will be properly provided in production
    },
  ],
  exports: [DivergentService, DivergentSessionService, DivergentEngine, SkillOrchestrator],
})
export class DivergentModule {}
