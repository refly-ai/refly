import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { DivergentService } from './divergent.service';
import { DivergentSessionService } from './divergent-session.service';
import { User } from '@refly/openapi-schema';
import {
  CreateDivergentSessionRequest,
  UpdateDivergentSessionRequest,
  DivergentSessionResponse,
} from './divergent.dto';
import { DivergentSessionData, DivergentSessionStatus } from './models/divergent-session.model';

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
  @Post('sessions')
  async createSession(
    user: User,
    @Body() request: CreateDivergentSessionRequest,
  ): Promise<DivergentSessionResponse> {
    return this.sessionService.createDivergentSession(user, request);
  }

  /**
   * Get a divergent session by ID
   */
  @Get('sessions/:sessionId')
  async getSession(
    user: User,
    @Param('sessionId') sessionId: string,
  ): Promise<DivergentSessionData | null> {
    return this.sessionService.getDivergentSession(user, sessionId);
  }

  /**
   * Update a divergent session
   */
  @Put('sessions/:sessionId')
  async updateSession(
    user: User,
    @Body() request: UpdateDivergentSessionRequest,
  ): Promise<DivergentSessionResponse> {
    return this.sessionService.updateDivergentSession(user, request);
  }

  /**
   * List divergent sessions for the current user
   */
  @Get('sessions')
  async listSessions(
    user: User,
    @Query() options?: { limit?: number; offset?: number; status?: DivergentSessionStatus },
  ): Promise<DivergentSessionData[]> {
    return this.sessionService.listDivergentSessions(user, options);
  }

  /**
   * Delete a divergent session
   */
  @Delete('sessions/:sessionId')
  async deleteSession(
    user: User,
    @Param('sessionId') sessionId: string,
  ): Promise<DivergentSessionResponse> {
    return this.sessionService.deleteDivergentSession(user, sessionId);
  }
}
