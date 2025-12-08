import { Module } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { InvitationController } from './invitation.controller';
import { CommonModule } from '../common/common.module';
import { CreditModule } from '../credit/credit.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [CommonModule, CreditModule, ConfigModule],
  controllers: [InvitationController],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
