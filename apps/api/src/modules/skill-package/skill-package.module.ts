/**
 * Skill Package Module - NestJS module for skill package management.
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SkillPackageService } from './skill-package.service';
import { SkillInstallationService } from './skill-installation.service';
import {
  SkillPackageController,
  SkillInstallationController,
  SkillPackageCliController,
} from './skill-package.controller';
import { SkillExecutionController } from './skill-execution.controller';
import { CommonModule } from '../common/common.module';
import { CopilotAutogenModule } from '../copilot-autogen/copilot-autogen.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { CanvasModule } from '../canvas/canvas.module';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';
import { QUEUE_SKILL_EXECUTION, QUEUE_SKILL_WORKFLOW } from '../../utils/const';
import { SkillExecutionPlanService } from './skill-execution-plan.service';
import { SkillWorkflowMapperService } from './skill-workflow-mapper.service';
import { SkillPackageExecutorService } from './skill-package-executor.service';
import { SkillExecutionProcessor, SkillWorkflowProcessor } from './skill-execution.processor';
import { SkillGithubService } from './skill-github.service';

@Module({
  imports: [
    CommonModule,
    WorkflowModule,
    CopilotAutogenModule,
    CanvasModule,
    CanvasSyncModule,
    BullModule.registerQueue({ name: QUEUE_SKILL_EXECUTION }, { name: QUEUE_SKILL_WORKFLOW }),
  ],
  controllers: [
    SkillPackageController,
    SkillInstallationController,
    SkillPackageCliController,
    SkillExecutionController,
  ],
  providers: [
    SkillPackageService,
    SkillInstallationService,
    SkillExecutionPlanService,
    SkillWorkflowMapperService,
    SkillPackageExecutorService,
    SkillExecutionProcessor,
    SkillWorkflowProcessor,
    SkillGithubService,
  ],
  exports: [SkillPackageService, SkillInstallationService, SkillPackageExecutorService],
})
export class SkillPackageModule {}
