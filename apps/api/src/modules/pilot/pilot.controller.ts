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
import { PilotDivergentService } from './pilot-divergent.service';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { pilotSessionPO2DTO, pilotStepPO2DTO } from './pilot.dto';

@Controller('v1/pilot')
export class PilotController {
  constructor(
    private pilotService: PilotService,
    private pilotDivergentService: PilotDivergentService,
  ) {}

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

  // ========== DIVERGENT MODE ENDPOINTS ==========

  @UseGuards(JwtAuthGuard)
  @Post('divergent/session/new')
  async createDivergentSession(
    @LoginedUser() user: User,
    @Body() request: CreatePilotSessionRequest & {
      mode?: 'divergent';
      maxDivergence?: number;
      maxDepth?: number;
      prompt?: string;
    },
  ) {
    const result = await this.pilotDivergentService.createDivergentSession(user, {
      ...request,
      mode: 'divergent',
    });

    return buildSuccessResponse(result);
  }

  @UseGuards(JwtAuthGuard)
  @Get('divergent/session/status')
  async getDivergentSessionStatus(
    @LoginedUser() _user: User,
    @Query('sessionId') sessionId: string,
  ) {
    const status = await this.pilotDivergentService.getDivergentSessionStatus(sessionId);
    return buildSuccessResponse(status);
  }

  @UseGuards(JwtAuthGuard)
  @Get('divergent/sessions')
  async listDivergentSessions(
    @LoginedUser() user: User,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const sessions = await this.pilotDivergentService.listDivergentSessions(user, limit);
    return buildSuccessResponse(sessions);
  }
}
