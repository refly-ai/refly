import { Module } from '@nestjs/common';
import { ProviderController } from './provider.controller';
import { ProviderService } from './provider.service';
import { AutoModelRoutingService } from './auto-model-router.service';
import { AutoModelTrialService } from './auto-model-trial.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [ProviderController],
  providers: [ProviderService, AutoModelRoutingService, AutoModelTrialService],
  exports: [ProviderService, AutoModelRoutingService, AutoModelTrialService],
})
export class ProviderModule {}
