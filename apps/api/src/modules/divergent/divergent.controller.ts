import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DivergentService } from './divergent.service';
import { DivergentSessionService } from './divergent-session.service';
import { User } from '@refly/openapi-schema';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import {
  CreateDivergentSessionRequest,
  UpdateDivergentSessionRequest,
  DivergentSessionResponse,
} from './divergent.dto';
import { DivergentSessionData, DivergentSessionStatus } from './models/divergent-session.model';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';

/**
 * DivergentAgent controller
 * Provides API endpoints for divergent functionality
 */
@Controller('divergent')
export class DivergentController {
  constructor(
    private readonly divergentService: DivergentService,
    private readonly sessionService: DivergentSessionService,
  ) {}

  /**
   * Health check endpoint
   */
  @Get('info')
  getServiceInfo() {
    return this.divergentService.getServiceInfo();
  }

  /**
   * Create a new divergent session
   */
  @UseGuards(JwtAuthGuard)
  @Post('sessions')
  async createSession(
    @LoginedUser() user: User,
    @Body() request: CreateDivergentSessionRequest,
  ): Promise<DivergentSessionResponse> {
    return this.sessionService.createDivergentSession(user, request);
  }

  /**
   * Get a divergent session by ID
   */
  @UseGuards(JwtAuthGuard)
  @Get('sessions/:sessionId')
  async getSession(
    @LoginedUser() user: User,
    @Param('sessionId') sessionId: string,
  ): Promise<DivergentSessionData | null> {
    return this.sessionService.getDivergentSession(user, sessionId);
  }

  /**
   * Update a divergent session
   */
  @UseGuards(JwtAuthGuard)
  @Put('sessions/:sessionId')
  async updateSession(
    @LoginedUser() user: User,
    @Param('sessionId') sessionId: string,
    @Body() request: UpdateDivergentSessionRequest,
  ): Promise<DivergentSessionResponse> {
    const requestWithSessionId = { ...request, sessionId };
    return this.sessionService.updateDivergentSession(user, requestWithSessionId);
  }

  /**
   * List divergent sessions for the current user
   */
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async listSessions(
    @LoginedUser() user: User,
    @Query() options?: { limit?: number; offset?: number; status?: DivergentSessionStatus },
  ): Promise<DivergentSessionData[]> {
    return this.sessionService.listDivergentSessions(user, options);
  }

  /**
   * Delete a divergent session
   */
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:sessionId')
  async deleteSession(
    @LoginedUser() user: User,
    @Param('sessionId') sessionId: string,
  ): Promise<DivergentSessionResponse> {
    return this.sessionService.deleteDivergentSession(user, sessionId);
  }
}
