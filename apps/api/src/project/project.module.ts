import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { CommonModule } from '@/common/common.module';
import { MiscModule } from '@/misc/misc.module';
import { KnowledgeModule } from '@/knowledge/knowledge.module';
import { CanvasModule } from '@/canvas/canvas.module';
import { RAGModule } from '@/rag/rag.module';

@Module({
  imports: [CommonModule, MiscModule, KnowledgeModule, RAGModule, CanvasModule],
  providers: [ProjectService],
  controllers: [ProjectController],
  exports: [ProjectService],
})
export class ProjectModule {}
