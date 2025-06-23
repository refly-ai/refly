import { Module, forwardRef } from '@nestjs/common';
import { ActionController } from './action.controller';
import { ActionService } from './action.service';
import { CommonModule } from '../common/common.module';
import { ProviderModule } from '../provider/provider.module';
import { SkillModule } from '../skill/skill.module';

@Module({
  imports: [CommonModule, ProviderModule, forwardRef(() => SkillModule)],
  controllers: [ActionController],
  providers: [ActionService],
  exports: [ActionService],
})
export class ActionModule {}
