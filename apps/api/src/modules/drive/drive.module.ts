import { Module } from '@nestjs/common';
import { DriveController } from './drive.controller';
import { DriveService } from './drive.service';
import { CommonModule } from '../common/common.module';
import { MiscModule } from '../misc/misc.module';
import { ProviderModule } from '../provider/provider.module';

@Module({
  imports: [CommonModule, MiscModule, ProviderModule],
  controllers: [DriveController],
  providers: [DriveService],
  exports: [DriveService],
})
export class DriveModule {}
