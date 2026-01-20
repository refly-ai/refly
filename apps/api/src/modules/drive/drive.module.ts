import { Module } from '@nestjs/common';
import { DriveController } from './drive.controller';
import { DriveCliController } from './drive-cli.controller';
import { DriveService } from './drive.service';
import { CommonModule } from '../common/common.module';
import { MiscModule } from '../misc/misc.module';
import { ProviderModule } from '../provider/provider.module';
import { LambdaModule } from '../lambda/lambda.module';

@Module({
  imports: [CommonModule, MiscModule, ProviderModule, LambdaModule],
  controllers: [DriveController, DriveCliController],
  providers: [DriveService],
  exports: [DriveService],
})
export class DriveModule {}
