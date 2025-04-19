import { Module } from '@nestjs/common';
import { ActionController } from './action.controller';
import { ActionService } from './action.service';
import { CommonModule } from '../common/common.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [CommonModule, SubscriptionModule],
  controllers: [ActionController],
  providers: [ActionService],
  exports: [ActionService],
})
export class ActionModule {}
