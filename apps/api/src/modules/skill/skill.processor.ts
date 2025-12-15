import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { SkillService } from './skill.service';
import { QUEUE_SKILL, QUEUE_CHECK_STUCK_ACTIONS } from '../../utils/const';
import { InvokeSkillJobData } from './skill.dto';
import { SKILL_DEFAULTS } from './skill.constant';

@Processor(QUEUE_SKILL, { concurrency: SKILL_DEFAULTS.INVOKE_WORKER_CONCURRENCY })
export class SkillProcessor extends WorkerHost {
  private readonly logger = new Logger(SkillProcessor.name);

  constructor(private skillService: SkillService) {
    super();
  }

  async process(job: Job<InvokeSkillJobData>) {
    this.logger.log(`[handleInvokeSkill] job: ${JSON.stringify(job.data.resultId)}`);

    try {
      await this.skillService.invokeSkillFromQueue(job.data);
    } catch (error) {
      this.logger.error(`[handleInvokeSkill] error: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_CHECK_STUCK_ACTIONS)
export class CheckStuckActionsProcessor extends WorkerHost {
  private readonly logger = new Logger(CheckStuckActionsProcessor.name);

  constructor(private skillService: SkillService) {
    super();
  }

  async process() {
    try {
      await this.skillService.checkStuckActions();
    } catch (error) {
      this.logger.error(`[handleCheckStuckActions] error: ${error?.stack}`);
      throw error;
    }
  }
}
