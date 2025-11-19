import { Module, forwardRef } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { StepModule } from '../step/step.module';
import { ProviderModule } from '../provider/provider.module';
import { SkillModule } from '../skill/skill.module';
import { ToolCallModule } from '../tool-call/tool-call.module';
import { ActionController } from './action.controller';
import { ActionService } from './action.service';
import { DriveModule } from '../drive/drive.module';

@Module({
  imports: [
    CommonModule,
    StepModule,
    ProviderModule,
    ToolCallModule,
    DriveModule,
    forwardRef(() => SkillModule),
  ],
  controllers: [ActionController],
  providers: [ActionService],
  exports: [ActionService],
})
export class ActionModule {}
