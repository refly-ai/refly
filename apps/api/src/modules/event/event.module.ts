import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { CommonModule } from '../common/common.module';
import { EventProcessor } from './event.processor';
import { SkillModule } from '../skill/skill.module';

@Module({
  imports: [CommonModule, SkillModule],
  providers: [EventService, EventProcessor],
  exports: [EventService],
})
export class EventModule {}
