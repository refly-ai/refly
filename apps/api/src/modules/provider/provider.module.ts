import { Module } from '@nestjs/common';
import { ProviderController } from './provider.controller';
import { ProviderService } from './provider.service';
import { AutoModelRoutingService } from './auto-model-router.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [ProviderController],
  providers: [ProviderService, AutoModelRoutingService],
  exports: [ProviderService, AutoModelRoutingService],
})
export class ProviderModule {}
