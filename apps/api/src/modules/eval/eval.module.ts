import { Module } from '@nestjs/common';
import { EvalController } from './eval.controller';
import { EvalService } from './eval.service';
import { SkillModule } from '../skill/skill.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [SkillModule, CommonModule],
  controllers: [EvalController],
  providers: [EvalService],
  exports: [EvalService],
})
export class EvalModule {}
