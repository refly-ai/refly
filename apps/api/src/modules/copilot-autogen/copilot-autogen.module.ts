import { Module } from '@nestjs/common';
import { CopilotAutogenController } from './copilot-autogen.controller';
import { CopilotAutogenService } from './copilot-autogen.service';
import { SkillModule } from '../skill/skill.module';
import { ActionModule } from '../action/action.module';
import { CanvasModule } from '../canvas/canvas.module';
import { ToolModule } from '../tool/tool.module';
import { ProviderModule } from '../provider/provider.module';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [SkillModule, ActionModule, CanvasModule, ToolModule, ProviderModule, CanvasSyncModule],
  controllers: [CopilotAutogenController],
  providers: [CopilotAutogenService, PrismaService],
  exports: [CopilotAutogenService],
})
export class CopilotAutogenModule {}
