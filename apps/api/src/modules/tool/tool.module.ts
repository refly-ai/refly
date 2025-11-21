import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { CollabModule } from '../collab/collab.module';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';
import { QUEUE_SYNC_TOOL_CREDIT_USAGE } from '../../utils/const';
import { isDesktop } from '../../utils/runtime';

import { CreditModule } from '../credit/credit.module';
import { SyncToolCreditUsageProcessor } from '../credit/credit.processor';
import { DriveModule } from '../drive/drive.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { MiscModule } from '../misc/misc.module';
import { ProviderModule } from '../provider/provider.module';
import { AdapterFactory } from './adapters/factory/factory';
import { ComposioModule } from './composio/composio.module';
import { ConfigLoader } from './core/loader/loader';
import { ToolDefinitionRegistry } from './core/registry/definition';
import { ToolFactory } from './core/registry/factory';
import { ToolInventoryService } from './inventory/inventory.service';
import { ToolController } from './tool.controller';
import { ToolService } from './tool.service';
import { ResourceHandler } from './utils/resource';
import { ScaleboxModule } from './sandbox/scalebox.module';

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
    ScaleboxModule,
    ...(isDesktop() ? [] : [BullModule.registerQueue({ name: QUEUE_SYNC_TOOL_CREDIT_USAGE })]),
  ],
  controllers: [ToolController],
  providers: [
    ToolService,

    SyncToolCreditUsageProcessor,
    // Tool inventory service (loads from database)
    ToolInventoryService,
    // Configuration and registry services for dual-table tool system
    ConfigLoader,
    ToolDefinitionRegistry,
    ToolFactory,
    AdapterFactory,
    // Resource handler for input/output resource preprocessing
    ResourceHandler,
  ],
  exports: [ToolService, ToolInventoryService, ConfigLoader, ToolDefinitionRegistry, ToolFactory],
})
export class ToolModule {}
