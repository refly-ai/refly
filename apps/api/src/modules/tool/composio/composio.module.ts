import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../../common/common.module';
import { DriveModule } from '../../drive/drive.module';
import { MiscModule } from '../../misc/misc.module';
import { BillingModule } from '../billing/billing.module';
import { HandlersModule } from '../handlers/handlers.module';
import { ToolInventoryService } from '../inventory/inventory.service';
import { ComposioController } from './composio.controller';
import { ComposioService } from './composio.service';

@Module({
  imports: [ConfigModule, CommonModule, DriveModule, MiscModule, BillingModule, HandlersModule],
  controllers: [ComposioController],
  providers: [
    ComposioService,
    ToolInventoryService,
    // ResourceHandler now provided by HandlersModule
  ],
  exports: [ComposioService],
})
export class ComposioModule {}
