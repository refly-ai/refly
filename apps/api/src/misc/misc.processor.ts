import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_IMAGE_PROCESSING, QUEUE_CLEAN_STATIC_FILES } from '@/utils/const';
import { MiscService } from '@/misc/misc.service';
import { FileObject } from '@/misc/misc.dto';

@Processor(QUEUE_IMAGE_PROCESSING)
export class ImageProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(private miscService: MiscService) {
    super();
  }

  async process(job: Job<FileObject>): Promise<void> {
    try {
      await this.miscService.processImage(job.data);
      this.logger.log(`Successfully processed image for key ${job.data?.storageKey}`);
    } catch (error) {
      this.logger.error(`Error processing image: ${error instanceof Error ? error.stack : error}`);
      throw error;
    }
  }
}

@Processor(QUEUE_CLEAN_STATIC_FILES)
export class CleanStaticFilesProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanStaticFilesProcessor.name);

  constructor(private miscService: MiscService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    try {
      await this.miscService.cleanOrphanedStaticFiles();
      this.logger.log('Successfully cleaned orphaned static files');
    } catch (error) {
      this.logger.error(
        `Error cleaning static files: ${error instanceof Error ? error.stack : error}`,
      );
      throw error;
    }
  }
}
