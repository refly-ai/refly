import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ComposioController } from './composio.controller';
import { ComposioService } from './composio.service';
import { PostHandlerService } from './post-handler.service';
import { CommonModule } from '../../common/common.module';
import { DriveModule } from '../../drive/drive.module';
import { MiscModule } from '../../misc/misc.module';
import { BillingModule } from '../billing/billing.module';
import { ResourceHandler } from '../resource.service';
import { ToolInventoryService } from '../inventory/inventory.service';

@Module({
  imports: [ConfigModule, CommonModule, DriveModule, MiscModule, BillingModule],
  controllers: [ComposioController],
  providers: [ComposioService, PostHandlerService, ResourceHandler, ToolInventoryService],
  exports: [ComposioService],
})
export class ComposioModule {}
