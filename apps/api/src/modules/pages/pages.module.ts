import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { CommonModule } from '../common/common.module';
import { MiscModule } from '../misc/misc.module';
import { CanvasModule } from '../canvas/canvas.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { ShareModule } from '../share/share.module';

@Module({
  imports: [
    CommonModule,
    MiscModule,
    CanvasModule,
    KnowledgeModule,
    CodeArtifactModule,
    ShareModule, // Make sure ShareModule is correctly imported here
  ],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
