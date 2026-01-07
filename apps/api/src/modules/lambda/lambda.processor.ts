import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { QUEUE_LAMBDA_RESULT } from '../../utils/const';
import { LambdaResultEnvelope, ResultPayload } from './lambda.dto';
import { LambdaResultHandlerService } from './result-handler.service';

/**
 * Job data for Lambda result processing
 */
export interface LambdaResultJobData {
  envelope: LambdaResultEnvelope<ResultPayload>;
}

/**
 * Processor for Lambda result queue
 *
 * This processor receives results from Lambda functions via SQS -> BullMQ bridge
 * and delegates to the result handler service for processing.
 *
 * The SQS -> BullMQ bridge is a separate component that:
 * 1. Polls the SQS result queue
 * 2. Parses the result envelope
 * 3. Enqueues to BullMQ for reliable processing
 */
@Processor(QUEUE_LAMBDA_RESULT)
export class LambdaResultProcessor extends WorkerHost {
  private readonly logger = new Logger(LambdaResultProcessor.name);

  constructor(private readonly resultHandler: LambdaResultHandlerService) {
    super();
  }

  async process(job: Job<LambdaResultJobData>): Promise<void> {
    const { envelope } = job.data;

    try {
      await this.resultHandler.processResult(envelope);
    } catch (error) {
      this.logger.error(
        `[${QUEUE_LAMBDA_RESULT}] Error processing result: jobId=${envelope.jobId}, error=${(error as Error)?.stack}`,
      );
      throw error; // Re-throw to trigger BullMQ retry logic
    }
  }
}
