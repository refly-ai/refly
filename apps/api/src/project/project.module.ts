import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { CommonModule } from '@/common/common.module';
import { MiscModule } from '@/misc/misc.module';

@Module({
  imports: [CommonModule, MiscModule],
  providers: [ProjectService],
  controllers: [ProjectController],
  exports: [ProjectService],
})
export class ProjectModule {}
