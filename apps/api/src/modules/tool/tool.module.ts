import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ToolController } from './tool.controller';
import { ToolService } from './tool.service';
import { InternalToolService } from './internal-tool.service';
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { CanvasModule } from '../canvas/canvas.module';
import { CollabModule } from '../collab/collab.module';
import { ProviderModule } from '../provider/provider.module';

@Module({
  imports: [
    CommonModule,
    McpServerModule,
    CodeArtifactModule,
    CollabModule,
    KnowledgeModule,
    CanvasModule,
    ProviderModule,
  ],
  controllers: [ToolController],
  providers: [ToolService, InternalToolService],
  exports: [ToolService, InternalToolService],
})
export class ToolModule {}
