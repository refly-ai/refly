import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_SYNC_TOOL_CREDIT_USAGE } from '../../utils/const';
import { isDesktop } from '../../utils/runtime';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { CollabModule } from '../collab/collab.module';
import { CommonModule } from '../common/common.module';
import { CreditModule } from '../credit/credit.module';
import { SyncToolCreditUsageProcessor } from '../credit/credit.processor';
import { DriveModule } from '../drive/drive.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { MiscModule } from '../misc/misc.module';
import { ProviderModule } from '../provider/provider.module';
import { ToolCallModule } from '../tool-call/tool-call.module';
import { BillingModule } from './billing/billing.module';
import { ComposioModule } from './composio/composio.module';
import { AdapterFactory } from './dynamic-tooling/adapters/adapter-factory.service';
import { ToolFactory } from './dynamic-tooling/factory.service';
import { HandlersModule } from './handlers/handlers.module';
import { ToolInventoryService } from './inventory/inventory.service';
import {
  PtcEnvService,
  PtcSdkService,
  ToolDefinitionService,
  ToolExecutionService,
  ToolIdentifyService,
} from './ptc';
import { ScaleboxModule } from './sandbox/scalebox.module';
import { ToolController } from './tool.controller';
import { ToolService } from './tool.service';

@Module({
  imports: [
    CommonModule,
    McpServerModule,
    MiscModule,
    DriveModule,
    ComposioModule,
    CodeArtifactModule,
    CollabModule,
    KnowledgeModule,
    CanvasSyncModule,
    ProviderModule,
    CreditModule,
    BillingModule,
    HandlersModule,
    ScaleboxModule,
    ToolCallModule,
    ...(isDesktop() ? [] : [BullModule.registerQueue({ name: QUEUE_SYNC_TOOL_CREDIT_USAGE })]),
  ],
  controllers: [ToolController],
  providers: [
    ToolService,
    // Tool identify service for determining tool type
    ToolIdentifyService,
    // Tool execution service for API-based tool execution
    ToolExecutionService,
    // Tool definition service for schema export
    ToolDefinitionService,
    // PTC SDK service for loading SDK definitions
    PtcSdkService,
    // PTC env service for sandbox environment variables
    PtcEnvService,

    SyncToolCreditUsageProcessor,
    // Tool inventory service (loads from database)
    ToolInventoryService,
    // Tool factory for creating dynamic tools from inventory
    ToolFactory,
    AdapterFactory,
    // ResourceHandler now provided by HandlersModule
    // All handler services are now provided by HandlersModule
  ],
  exports: [ToolService, ToolInventoryService, ToolFactory, PtcSdkService, PtcEnvService],
})
export class ToolModule {}
