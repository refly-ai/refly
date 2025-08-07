import { Module } from '@nestjs/common';
import { DivergentService } from './divergent.service';
import { DivergentSessionService } from './divergent-session.service';
import { DivergentController } from './divergent.controller';
import { DivergentEngine } from './engines/divergent-engine';
import { SkillOrchestrator } from './engines/skill-orchestrator';
import { SkillServiceIntegration } from './services/skill-service-integration';
import { CommonModule } from '../common/common.module';
import { SkillModule } from '../skill/skill.module';
import { SkillService } from '../skill/skill.service';

/**
 * DivergentAgent module
 * Implements total-divide-total loop functionality using existing skillResponse architecture
 */
@Module({
  imports: [CommonModule, SkillModule],
  controllers: [DivergentController],
  providers: [
    DivergentService,
    DivergentSessionService,
    DivergentEngine,
    SkillOrchestrator,
    SkillServiceIntegration,
    {
      provide: 'SkillService',
      useFactory: (skillService) => skillService,
      inject: [SkillService],
    },
    {
      provide: 'BaseChatModel',
      useValue: null, // Will be properly provided in production
    },
  ],
  exports: [
    DivergentService,
    DivergentSessionService,
    DivergentEngine,
    SkillOrchestrator,
    SkillServiceIntegration,
  ],
})
export class DivergentModule {}
