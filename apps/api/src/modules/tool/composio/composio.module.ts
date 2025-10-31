import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ComposioController } from './composio.controller';
import { ComposioService } from './composio.service';
import { CommonModule } from '../../common/common.module';
import { QUEUE_SYNC_TOOL_CREDIT_USAGE } from '../../../utils/const';
import { isDesktop } from '../../../utils/runtime';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    ...(isDesktop() ? [] : [BullModule.registerQueue({ name: QUEUE_SYNC_TOOL_CREDIT_USAGE })]),
  ],
  controllers: [ComposioController],
  providers: [ComposioService],
  exports: [ComposioService],
})
export class ComposioModule {}
