import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { CommonModule } from '@/common/common.module';
import { SubscriptionModule } from '@/subscription/subscription.module';
import { MiscModule } from '@/misc/misc.module';

@Module({
  imports: [CommonModule, MiscModule, SubscriptionModule],
  providers: [UserService],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
