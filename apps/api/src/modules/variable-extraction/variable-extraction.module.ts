import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { CanvasModule } from '../canvas/canvas.module';
import { ProviderModule } from '../provider/provider.module';
import { VariableExtractionController } from './variable-extraction.controller';
import { VariableExtractionService } from './variable-extraction.service';

@Module({
  imports: [CommonModule, CanvasModule, ProviderModule],
  controllers: [VariableExtractionController],
  providers: [VariableExtractionService],
  exports: [VariableExtractionService],
})
export class VariableExtractionModule {}
