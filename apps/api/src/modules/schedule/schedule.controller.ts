import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { User } from '@refly/openapi-schema';
import { ScheduleService } from './schedule.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  ListSchedulesDto,
  GetScheduleRecordsDto,
  ListAllScheduleRecordsDto,
  GetScheduleRecordDetailDto,
  TriggerScheduleManuallyDto,
  RetryScheduleRecordDto,
} from './schedule.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { buildSuccessResponse } from '../../utils';

@Controller('v1/schedule')
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post('create')
  async createSchedule(@LoginedUser() user: User, @Body() dto: CreateScheduleDto) {
    const result = await this.scheduleService.createSchedule(user.uid, dto);
    return buildSuccessResponse(result);
  }

  @Post('update')
  async updateSchedule(
    @LoginedUser() user: User,
    @Body() body: UpdateScheduleDto & { scheduleId: string },
  ) {
    const { scheduleId, ...dto } = body;
    const result = await this.scheduleService.updateSchedule(user.uid, scheduleId, dto);
    return buildSuccessResponse(result);
  }

  @Post('delete')
  async deleteSchedule(@LoginedUser() user: User, @Body() body: { scheduleId: string }) {
    const result = await this.scheduleService.deleteSchedule(user.uid, body.scheduleId);
    return buildSuccessResponse(result);
  }

  @Post('detail')
  async getSchedule(@LoginedUser() user: User, @Body() body: { scheduleId: string }) {
    const result = await this.scheduleService.getSchedule(user.uid, body.scheduleId);
    return buildSuccessResponse(result);
  }

  @Post('list')
  async listSchedules(@LoginedUser() user: User, @Body() dto: ListSchedulesDto) {
    const result = await this.scheduleService.listSchedules(
      user.uid,
      dto.canvasId,
      dto.page,
      dto.pageSize,
    );
    return buildSuccessResponse(result);
  }

  @Post('records')
  async getScheduleRecords(@LoginedUser() user: User, @Body() dto: GetScheduleRecordsDto) {
    const result = await this.scheduleService.getScheduleRecords(
      user.uid,
      dto.scheduleId,
      dto.page,
      dto.pageSize,
    );
    return buildSuccessResponse(result);
  }

  @Post('records/list')
  async listAllScheduleRecords(@LoginedUser() user: User, @Body() dto: ListAllScheduleRecordsDto) {
    const result = await this.scheduleService.listAllScheduleRecords(
      user.uid,
      dto.page,
      dto.pageSize,
      dto.status,
      dto.keyword,
      dto.tools,
      dto.canvasId,
    );
    return buildSuccessResponse(result);
  }

  @Post('records/tools')
  async getAvailableTools(@LoginedUser() user: User) {
    const result = await this.scheduleService.getAvailableTools(user.uid);
    return buildSuccessResponse(result);
  }

  @Post('record/detail')
  async getScheduleRecordDetail(
    @LoginedUser() user: User,
    @Body() dto: GetScheduleRecordDetailDto,
  ) {
    const result = await this.scheduleService.getScheduleRecordDetail(
      user.uid,
      dto.scheduleRecordId,
    );
    return buildSuccessResponse(result);
  }

  @Post('record/snapshot')
  async getRecordSnapshot(@LoginedUser() user: User, @Body() dto: GetScheduleRecordDetailDto) {
    const result = await this.scheduleService.getRecordSnapshot(user.uid, dto.scheduleRecordId);
    return buildSuccessResponse(result);
  }

  @Post('trigger')
  async triggerScheduleManually(
    @LoginedUser() user: User,
    @Body() dto: TriggerScheduleManuallyDto,
  ) {
    const result = await this.scheduleService.triggerScheduleManually(user.uid, dto.scheduleId);
    return buildSuccessResponse(result);
  }

  @Post('record/retry')
  async retryScheduleRecord(@LoginedUser() user: User, @Body() dto: RetryScheduleRecordDto) {
    const result = await this.scheduleService.retryScheduleRecord(user.uid, dto.scheduleRecordId);
    return buildSuccessResponse(result);
  }
}
