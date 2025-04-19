import { WorkerHost } from '@nestjs/bullmq';

import { AuthService } from '../auth/auth.service';
import { QUEUE_SEND_VERIFICATION_EMAIL } from '../../utils/const';
import { Processor } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SendVerificationEmailJobData } from './auth.dto';

@Processor(QUEUE_SEND_VERIFICATION_EMAIL)
export class AuthProcessor extends WorkerHost {
  private readonly logger = new Logger(AuthProcessor.name);

  constructor(private authService: AuthService) {
    super();
  }

  async process(job: Job<SendVerificationEmailJobData>) {
    const { sessionId } = job.data;
    try {
      this.logger.log(`Sending verification email for session ${sessionId}`);
      await this.authService.sendVerificationEmail(sessionId);
    } catch (error) {
      this.logger.error(error);
    }
  }
}
