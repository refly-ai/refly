import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { EventService } from './event.service';
import { QUEUE_SIMPLE_EVENT } from '@/utils/const';
import { SimpleEventData } from '@/event/event.dto';

@Processor(QUEUE_SIMPLE_EVENT)
export class EventProcessor extends WorkerHost {
  private readonly logger = new Logger(EventProcessor.name);

  constructor(private eventService: EventService) {
    super();
  }

  async process(job: Job<SimpleEventData>) {
    this.logger.log(`[${QUEUE_SIMPLE_EVENT}] job: ${JSON.stringify(job)}`);

    try {
      await this.eventService.handleSimpleEvent(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_SIMPLE_EVENT}] error: ${error?.stack}`);
      throw error;
    }
  }
}
