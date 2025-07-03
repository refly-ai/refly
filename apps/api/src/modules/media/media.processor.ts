import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma.service';
import { QUEUE_MEDIA } from '../../utils';
import { GenerateMediaJobData } from './media.service';
import { ActionStatus } from '@refly/openapi-schema';
import { ImageProcessor } from './processors/image.processor';
import { VideoProcessor } from './processors/video.processor';
import { AudioProcessor } from './processors/audio.processor';

@Processor(QUEUE_MEDIA)
export class MediaProcessor extends WorkerHost {
  private logger = new Logger(MediaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageProcessor: ImageProcessor,
    private readonly videoProcessor: VideoProcessor,
    private readonly audioProcessor: AudioProcessor,
  ) {
    super();
  }

  async process(job: Job<GenerateMediaJobData>): Promise<void> {
    const { resultId, version, mediaType, prompt, config, genId } = job.data;

    try {
      // 更新状态为执行中
      await this.updateActionResult(resultId, version, {
        status: 'executing' as ActionStatus,
      });

      let result: any;
      switch (mediaType) {
        case 'image':
          result = await this.imageProcessor.generateImage(prompt, config, genId);
          break;
        case 'video':
          result = await this.videoProcessor.generateVideo(prompt, config);
          break;
        case 'audio':
          result = await this.audioProcessor.generateAudio(prompt, config);
          break;
        default:
          throw new Error(`Unsupported media type: ${mediaType}`);
      }

      // 更新结果
      await this.updateActionResult(resultId, version, {
        status: 'finish' as ActionStatus,
        context: JSON.stringify(result),
      });

      this.logger.log(`Media generation completed for ${resultId}`);
    } catch (error) {
      this.logger.error(`Media generation failed for ${resultId}:`, error);

      await this.updateActionResult(resultId, version, {
        status: 'failed' as ActionStatus,
        errors: JSON.stringify([error.message]),
      });
    }
  }

  private async updateActionResult(
    resultId: string,
    version: number,
    updates: Partial<{
      status: ActionStatus;
      context: string;
      errors: string;
    }>,
  ) {
    await this.prisma.actionResult.update({
      where: {
        resultId_version: {
          resultId,
          version,
        },
      },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });
  }
}
