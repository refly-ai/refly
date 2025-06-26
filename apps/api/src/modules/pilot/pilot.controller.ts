import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  User,
  CreatePilotSessionRequest,
  UpdatePilotSessionRequest,
  UpsertPilotSessionResponse,
  EntityType,
  ListPilotSessionsResponse,
  GetPilotSessionDetailResponse,
} from '@refly/openapi-schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { buildSuccessResponse } from '../../utils';
import { PilotService } from './pilot.service';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { pilotSessionPO2DTO, pilotStepPO2DTO } from './pilot.dto';

@Controller('v1/pilot')
export class PilotController {
  constructor(private pilotService: PilotService) {}

  @UseGuards(JwtAuthGuard)
  @Post('session/new')
  async createPilotSession(
    @LoginedUser() user: User,
    @Body() body: CreatePilotSessionRequest,
  ): Promise<UpsertPilotSessionResponse> {
    const session = await this.pilotService.createPilotSession(user, body);
    return buildSuccessResponse(pilotSessionPO2DTO(session));
  }

  @UseGuards(JwtAuthGuard)
  @Post('session/update')
  async updatePilotSession(
    @LoginedUser() user: User,
    @Body() body: UpdatePilotSessionRequest,
  ): Promise<UpsertPilotSessionResponse> {
    const session = await this.pilotService.updatePilotSession(user, body);
    return buildSuccessResponse(pilotSessionPO2DTO(session));
  }

  @UseGuards(JwtAuthGuard)
  @Get('session/list')
  async listPilotSessions(
    @LoginedUser() user: User,
    @Query('targetId') targetId?: string,
    @Query('targetType') targetType?: EntityType,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize?: number,
  ): Promise<ListPilotSessionsResponse> {
    const sessions = await this.pilotService.listPilotSessions(
      user,
      targetId,
      targetType,
      page,
      pageSize,
    );
    return buildSuccessResponse(sessions.map((session) => pilotSessionPO2DTO(session)));
  }

  @UseGuards(JwtAuthGuard)
  @Get('session/detail')
  async getPilotSessionDetail(
    @LoginedUser() user: User,
    @Query('sessionId') sessionId: string,
  ): Promise<GetPilotSessionDetailResponse> {
    const { session, steps } = await this.pilotService.getPilotSessionDetail(user, sessionId);

    return buildSuccessResponse({
      ...pilotSessionPO2DTO(session),
      steps: steps.map(({ step, actionResult }) => pilotStepPO2DTO(step, actionResult)),
    });
  }
}
