import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../common/common.module';
import { LambdaService } from './lambda.service';
import { LambdaResultHandlerService } from './result-handler.service';
import { LambdaResultProcessor } from './lambda.processor';
import { SqsBridgeService } from './sqs-bridge.service';
import {
  QUEUE_LAMBDA_DOC_INGEST,
  QUEUE_LAMBDA_IMAGE_TRANSFORM,
  QUEUE_LAMBDA_DOC_RENDER,
  QUEUE_LAMBDA_VIDEO_ANALYZE,
  QUEUE_LAMBDA_RESULT,
} from '../../utils/const';
import { isDesktop } from '../../utils/runtime';

// Queue registrations for BullMQ (only in non-desktop mode)
const queueRegistrations = isDesktop()
  ? []
  : [
      BullModule.registerQueue({ name: QUEUE_LAMBDA_DOC_INGEST }),
      BullModule.registerQueue({ name: QUEUE_LAMBDA_IMAGE_TRANSFORM }),
      BullModule.registerQueue({ name: QUEUE_LAMBDA_DOC_RENDER }),
      BullModule.registerQueue({ name: QUEUE_LAMBDA_VIDEO_ANALYZE }),
      BullModule.registerQueue({ name: QUEUE_LAMBDA_RESULT }),
    ];

// Processors and bridge services are only needed in non-desktop mode
const processorProviders = isDesktop() ? [] : [LambdaResultProcessor, SqsBridgeService];

@Module({
  imports: [CommonModule, ...queueRegistrations],
  providers: [LambdaService, LambdaResultHandlerService, ...processorProviders],
  exports: [LambdaService, LambdaResultHandlerService],
})
export class LambdaModule {}
