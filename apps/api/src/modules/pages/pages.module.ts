import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { CommonModule } from '../common/common.module';
import { CanvasModule } from '../canvas/canvas.module';
import { ShareModule } from '../share/share.module';

@Module({
  imports: [
    CommonModule,
    CanvasModule,
    ShareModule, // Make sure ShareModule is correctly imported here
  ],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
