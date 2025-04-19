import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { RAGService } from './rag.service';
import { RagController } from './rag.controller';

@Module({
  imports: [CommonModule],
  providers: [RAGService],
  exports: [RAGService],
  controllers: [RagController],
})
export class RAGModule {}
