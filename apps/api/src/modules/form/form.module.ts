import { Module } from '@nestjs/common';
import { FormService } from './form.service';
import { FormController } from './form.controller';
import { CommonModule } from '../common/common.module';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [CommonModule],
  controllers: [FormController],
  providers: [FormService, PrismaService],
  exports: [FormService],
})
export class FormModule {}
