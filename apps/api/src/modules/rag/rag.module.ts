import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { RAGService } from './rag.service';
import { ProviderModule } from '../provider/provider.module';

@Module({
  imports: [CommonModule, ProviderModule],
  providers: [RAGService],
  exports: [RAGService],
})
export class RAGModule {}
