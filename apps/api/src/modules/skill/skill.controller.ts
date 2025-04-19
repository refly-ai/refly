import {
  Controller,
  UseGuards,
  Get,
  Post,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  Res,
  ParseBoolPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { SkillService } from './skill.service';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import {
  User,
  DeleteSkillInstanceRequest,
  DeleteSkillInstanceResponse,
  DeleteSkillTriggerRequest,
  DeleteSkillTriggerResponse,
  InvokeSkillRequest,
  InvokeSkillResponse,
  ListSkillInstanceResponse,
  ListSkillTriggerResponse,
  CreateSkillInstanceRequest,
  CreateSkillInstanceResponse,
  UpdateSkillInstanceRequest,
  UpdateSkillInstanceResponse,
  CreateSkillTriggerRequest,
  CreateSkillTriggerResponse,
  UpdateSkillTriggerRequest,
  UpdateSkillTriggerResponse,
  PinSkillInstanceRequest,
  PinSkillInstanceResponse,
  UnpinSkillInstanceRequest,
  UnpinSkillInstanceResponse,
  ListSkillResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';
import { Response } from 'express';
import { skillInstancePO2DTO, skillTriggerPO2DTO } from './skill.dto';

@Controller('v1/skill')
export class SkillController {
  constructor(private skillService: SkillService) {}

  @Get('/list')
  async listSkillTemplates(): Promise<ListSkillResponse> {
    return buildSuccessResponse(this.skillService.listSkills());
  }

  @UseGuards(JwtAuthGuard)
  @Post('/invoke')
  async invokeSkill(
    @LoginedUser() user: User,
    @Body() body: InvokeSkillRequest,
  ): Promise<InvokeSkillResponse> {
    const { resultId } = await this.skillService.sendInvokeSkillTask(user, body);
    return buildSuccessResponse({ resultId });
  }

  @UseGuards(JwtAuthGuard)
  @Post('/streamInvoke')
  async streamInvokeSkill(
    @LoginedUser() user: User,
    @Body() body: InvokeSkillRequest,
    @Res() res: Response,
  ) {
    await this.skillService.invokeSkillFromApi(user, body, res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/instance/list')
  async listSkillInstances(
    @LoginedUser() user: User,
    @Query('skillId') skillId: string,
    @Query('sortByPin', new DefaultValuePipe(false), ParseBoolPipe) sortByPin: boolean,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ): Promise<ListSkillInstanceResponse> {
    const skills = await this.skillService.listSkillInstances(user, {
      skillId,
      sortByPin,
      page,
      pageSize,
    });
    return buildSuccessResponse(skills.map((skill) => skillInstancePO2DTO(skill)));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/instance/new')
  async createSkillInstance(
    @LoginedUser() user: User,
    @Body() body: CreateSkillInstanceRequest,
  ): Promise<CreateSkillInstanceResponse> {
    const skillInstanceList = await this.skillService.createSkillInstance(user, body);
    return buildSuccessResponse(skillInstanceList.map((skill) => skillInstancePO2DTO(skill)));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/instance/update')
  async updateSkillInstance(
    @LoginedUser() user: User,
    @Body() body: UpdateSkillInstanceRequest,
  ): Promise<UpdateSkillInstanceResponse> {
    const skillInstance = await this.skillService.updateSkillInstance(user, body);
    return buildSuccessResponse(skillInstancePO2DTO(skillInstance));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/instance/pin')
  async pinSkillInstance(
    @LoginedUser() user: User,
    @Body() body: PinSkillInstanceRequest,
  ): Promise<PinSkillInstanceResponse> {
    await this.skillService.pinSkillInstance(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Post('/instance/unpin')
  async unpinSkillInstance(
    @LoginedUser() user: User,
    @Body() body: UnpinSkillInstanceRequest,
  ): Promise<UnpinSkillInstanceResponse> {
    await this.skillService.unpinSkillInstance(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Post('/instance/delete')
  async deleteSkillInstance(
    @LoginedUser() user: User,
    @Body() body: DeleteSkillInstanceRequest,
  ): Promise<DeleteSkillInstanceResponse> {
    await this.skillService.deleteSkillInstance(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/trigger/list')
  async listSkillTriggers(
    @LoginedUser() user: User,
    @Query('skillId') skillId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ): Promise<ListSkillTriggerResponse> {
    const triggers = await this.skillService.listSkillTriggers(user, {
      skillId,
      page,
      pageSize,
    });
    return buildSuccessResponse(triggers.map((trigger) => skillTriggerPO2DTO(trigger)));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/trigger/new')
  async createSkillTrigger(
    @LoginedUser() user: User,
    @Body() body: CreateSkillTriggerRequest,
  ): Promise<CreateSkillTriggerResponse> {
    const triggers = await this.skillService.createSkillTrigger(user, body);
    return buildSuccessResponse(triggers.map((trigger) => skillTriggerPO2DTO(trigger)));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/trigger/update')
  async updateSkillTrigger(
    @LoginedUser() user: User,
    @Body() body: UpdateSkillTriggerRequest,
  ): Promise<UpdateSkillTriggerResponse> {
    const trigger = await this.skillService.updateSkillTrigger(user, body);
    return buildSuccessResponse(skillTriggerPO2DTO(trigger));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/trigger/delete')
  async deleteSkillTrigger(
    @LoginedUser() user: User,
    @Body() body: DeleteSkillTriggerRequest,
  ): Promise<DeleteSkillTriggerResponse> {
    await this.skillService.deleteSkillTrigger(user, body);
    return buildSuccessResponse();
  }
}
