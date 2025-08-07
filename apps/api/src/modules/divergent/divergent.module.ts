import { Module } from '@nestjs/common';
import { DivergentService } from './divergent.service';
import { DivergentSessionService } from './divergent-session.service';
import { DivergentController } from './divergent.controller';
import { CommonModule } from '../common/common.module';

/**
 * DivergentAgent module
 * Implements total-divide-total loop functionality using existing skillResponse architecture
 */
@Module({
  imports: [CommonModule],
  controllers: [DivergentController],
  providers: [DivergentService, DivergentSessionService],
  exports: [DivergentService, DivergentSessionService],
})
export class DivergentModule {}
