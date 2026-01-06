import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import {
  QUEUE_SYNC_TOOL_CREDIT_USAGE,
  QUEUE_SYNC_MULTIMODAL_CREDIT_USAGE,
} from '../../utils/const';
import { isDesktop } from '../../utils/runtime';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { CollabModule } from '../collab/collab.module';
import { CommonModule } from '../common/common.module';
import { CreditModule } from '../credit/credit.module';
import {
  SyncToolCreditUsageProcessor,
  SyncMultimodalCreditUsageProcessor,
} from '../credit/credit.processor';
import { DriveModule } from '../drive/drive.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { MiscModule } from '../misc/misc.module';
import { ProviderModule } from '../provider/provider.module';
import { BillingModule } from './billing/billing.module';
import { GeminiClientService } from './multimodal/gemini/client.service';
import { GeminiFileStoreService } from './multimodal/gemini/file-store.service';
import { GeminiService } from './multimodal/gemini/gemini.service';
import { ImageInterpreterService } from './multimodal/gemini/image.service';
import { MultimodalBridgeService } from './multimodal/multimodal-bridge.service';
import { MultimodalToolsService } from './multimodal/multimodal-tools.service';
import { ComposioModule } from './composio/composio.module';
import { AdapterFactory } from './dynamic-tooling/adapters/factory';
import { ToolFactory } from './dynamic-tooling/factory.service';
import { ToolInventoryService } from './inventory/inventory.service';
import { ResourceHandler } from './resource.service';
import { ScaleboxModule } from './sandbox/scalebox.module';
import {
  ComposioToolPostHandlerService,
  RegularToolPostHandlerService,
  ToolWrapperFactoryService,
} from './tool-execution';
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
    ScaleboxModule,
    ...(isDesktop()
      ? []
      : [
          BullModule.registerQueue({ name: QUEUE_SYNC_TOOL_CREDIT_USAGE }),
          BullModule.registerQueue({ name: QUEUE_SYNC_MULTIMODAL_CREDIT_USAGE }),
        ]),
  ],
  controllers: [ToolController],
  providers: [
    ToolService,

    SyncToolCreditUsageProcessor,
    SyncMultimodalCreditUsageProcessor,
    // Tool inventory service (loads from database)
    ToolInventoryService,
    // Tool factory for creating dynamic tools from inventory
    ToolFactory,
    AdapterFactory,
    // Resource handler for input/output resource preprocessing
    ResourceHandler,
    // Post-handler and wrapper factory for tool result processing
    RegularToolPostHandlerService,
    ComposioToolPostHandlerService,
    ToolWrapperFactoryService,
    // Builtin tools - Gemini multimodal services
    GeminiClientService,
    GeminiFileStoreService,
    GeminiService,
    ImageInterpreterService,
    MultimodalToolsService,
    MultimodalBridgeService,
  ],
  exports: [
    ToolService,
    ToolInventoryService,
    ToolFactory,
    GeminiClientService,
    GeminiFileStoreService,
    GeminiService,
    ImageInterpreterService,
    MultimodalToolsService,
    MultimodalBridgeService,
  ],
})
export class ToolModule {}
