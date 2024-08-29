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
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { SkillService } from './skill.service';
import { User } from '@/utils/decorators/user.decorator';
import { User as UserModel } from '@prisma/client';
import {
  DeleteSkillInstanceRequest,
  DeleteSkillInstanceResponse,
  DeleteSkillTriggerRequest,
  DeleteSkillTriggerResponse,
  InvokeSkillRequest,
  InvokeSkillResponse,
  ListSkillInstanceResponse,
  ListSkillTemplateResponse,
  ListSkillTriggerResponse,
  CreateSkillInstanceRequest,
  CreateSkillInstanceResponse,
  UpdateSkillInstanceRequest,
  UpdateSkillInstanceResponse,
  CreateSkillTriggerRequest,
  CreateSkillTriggerResponse,
  UpdateSkillTriggerRequest,
  UpdateSkillTriggerResponse,
  ListSkillJobsResponse,
  GetSkillJobDetailResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '@/utils';
import { Response } from 'express';
import { skillInstancePO2DTO, skillJobPO2DTO, skillTriggerPO2DTO } from './skill.dto';

@Controller('skill')
export class SkillController {
  constructor(private skillService: SkillService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/template/list')
  async listSkillTemplates(
    @User() user: UserModel,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ): Promise<ListSkillTemplateResponse> {
    return buildSuccessResponse(this.skillService.listSkillTemplates(user, { page, pageSize }));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/invoke')
  async invokeSkill(
    @User() user: UserModel,
    @Body() body: InvokeSkillRequest,
  ): Promise<InvokeSkillResponse> {
    const { jobId } = await this.skillService.sendInvokeSkillTask(user, body);
    return buildSuccessResponse({ jobId });
  }

  @UseGuards(JwtAuthGuard)
  @Post('/streamInvoke')
  async streamInvokeSkill(
    @User() user: UserModel,
    @Body() body: InvokeSkillRequest,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.status(200);

    await this.skillService.invokeSkillFromApi(user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/instance/list')
  async listSkillInstances(
    @User() user: UserModel,
    @Query('skillId') skillId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ): Promise<ListSkillInstanceResponse> {
    const skills = await this.skillService.listSkillInstances(user, { skillId, page, pageSize });
    return buildSuccessResponse(skills.map((skill) => skillInstancePO2DTO(skill)));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/instance/new')
  async createSkillInstance(
    @User() user: UserModel,
    @Body() body: CreateSkillInstanceRequest,
  ): Promise<CreateSkillInstanceResponse> {
    const skillInstanceList = await this.skillService.createSkillInstance(user, body);
    return buildSuccessResponse(skillInstanceList.map((skill) => skillInstancePO2DTO(skill)));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/instance/update')
  async updateSkillInstance(
    @User() user: UserModel,
    @Body() body: UpdateSkillInstanceRequest,
  ): Promise<UpdateSkillInstanceResponse> {
    const skillInstance = await this.skillService.updateSkillInstance(user, body);
    return buildSuccessResponse(skillInstancePO2DTO(skillInstance));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/instance/delete')
  async deleteSkillInstance(
    @User() user: UserModel,
    @Body() body: DeleteSkillInstanceRequest,
  ): Promise<DeleteSkillInstanceResponse> {
    await this.skillService.deleteSkillInstance(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/trigger/list')
  async listSkillTriggers(
    @User() user: UserModel,
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
    @User() user: UserModel,
    @Body() body: CreateSkillTriggerRequest,
  ): Promise<CreateSkillTriggerResponse> {
    const triggers = await this.skillService.createSkillTrigger(user, body);
    return buildSuccessResponse(triggers.map((trigger) => skillTriggerPO2DTO(trigger)));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/trigger/update')
  async updateSkillTrigger(
    @User() user: UserModel,
    @Body() body: UpdateSkillTriggerRequest,
  ): Promise<UpdateSkillTriggerResponse> {
    const trigger = await this.skillService.updateSkillTrigger(user, body);
    return buildSuccessResponse(skillTriggerPO2DTO(trigger));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/trigger/delete')
  async deleteSkillTrigger(
    @User() user: UserModel,
    @Body() body: DeleteSkillTriggerRequest,
  ): Promise<DeleteSkillTriggerResponse> {
    await this.skillService.deleteSkillTrigger(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/job/list')
  async listSkillJobs(
    @User() user: UserModel,
    @Query('skillId') skillId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ): Promise<ListSkillJobsResponse> {
    const jobs = await this.skillService.listSkillJobs(user, {
      skillId: skillId || undefined,
      page,
      pageSize,
    });
    return buildSuccessResponse(jobs.map((log) => skillJobPO2DTO(log)));
  }

  @UseGuards(JwtAuthGuard)
  @Get('/job/detail')
  async getSkillJobDetail(
    @User() user: UserModel,
    @Query('jobId') jobId: string,
  ): Promise<GetSkillJobDetailResponse> {
    const job = await this.skillService.getSkillJobDetail(user, jobId);
    return buildSuccessResponse(skillJobPO2DTO(job));
  }
}
