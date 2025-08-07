import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { User } from '@refly/openapi-schema';
import { genActionResultID } from '@refly/utils';
import { DivergentSessionData, DivergentSessionStatus } from './models/divergent-session.model';
import {
  CreateDivergentSessionRequest,
  UpdateDivergentSessionRequest,
  DivergentSessionResponse,
  divergentSessionPO2DTO,
} from './divergent.dto';

/**
 * Service for managing DivergentSession database operations
 * Handles CRUD operations for divergent session lifecycle
 */
@Injectable()
export class DivergentSessionService {
  private readonly logger = new Logger(DivergentSessionService.name);

  constructor(private readonly prisma: PrismaService) {
    this.logger.log('DivergentSessionService initialized');
  }

  /**
   * Create a new divergent session
   */
  async createDivergentSession(
    user: User,
    request: CreateDivergentSessionRequest,
  ): Promise<DivergentSessionResponse> {
    try {
      this.logger.log(`Creating divergent session for user ${user.uid}`);

      // Validate input
      if (!request.userIntent?.trim()) {
        throw new Error('User intent cannot be empty');
      }
      if (!request.rootResultId?.trim()) {
        throw new Error('Root result ID cannot be empty');
      }
      if (!request.targetId?.trim()) {
        throw new Error('Target ID cannot be empty');
      }

      const sessionId = genActionResultID(); // Reuse the same ID generation logic

      const session = await this.prisma.divergentSession.create({
        data: {
          sessionId,
          uid: user.uid,
          userIntent: request.userIntent,
          rootResultId: request.rootResultId,
          targetId: request.targetId,
          currentLevel: 0,
          globalCompletionScore: 0,
          status: 'executing',
        },
      });

      this.logger.log(`Created divergent session ${sessionId} for user ${user.uid}`);

      return {
        session: divergentSessionPO2DTO(session),
        success: true,
        message: 'Session created successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to create divergent session: ${error?.message}`, error);
      throw error;
    }
  }

  /**
   * Get a divergent session by ID
   */
  async getDivergentSession(user: User, sessionId: string): Promise<DivergentSessionData | null> {
    try {
      const session = await this.prisma.divergentSession.findFirst({
        where: {
          sessionId,
          uid: user.uid, // Ensure user can only access their own sessions
        },
      });

      if (!session) {
        return null;
      }

      return divergentSessionPO2DTO(session);
    } catch (error) {
      this.logger.error(`Failed to get divergent session ${sessionId}: ${error?.message}`, error);
      throw error;
    }
  }

  /**
   * Update a divergent session
   */
  async updateDivergentSession(
    user: User,
    request: UpdateDivergentSessionRequest,
  ): Promise<DivergentSessionResponse> {
    try {
      // Validate level constraints
      if (request.currentLevel !== undefined) {
        if (request.currentLevel < 0 || request.currentLevel > 5) {
          throw new Error('Current level must be between 0 and 5');
        }
      }

      // Validate completion score constraints
      if (request.globalCompletionScore !== undefined) {
        if (request.globalCompletionScore < 0 || request.globalCompletionScore > 1) {
          throw new Error('Global completion score must be between 0 and 1');
        }
      }

      const updateData: any = {};
      if (request.currentLevel !== undefined) updateData.currentLevel = request.currentLevel;
      if (request.globalCompletionScore !== undefined)
        updateData.globalCompletionScore = request.globalCompletionScore;
      if (request.status !== undefined) updateData.status = request.status;
      if (request.finalOutputResultId !== undefined)
        updateData.finalOutputResultId = request.finalOutputResultId;

      const session = await this.prisma.divergentSession.update({
        where: {
          sessionId: request.sessionId,
          uid: user.uid, // Ensure user can only update their own sessions
        },
        data: updateData,
      });

      this.logger.log(`Updated divergent session ${request.sessionId}`);

      return {
        session: divergentSessionPO2DTO(session),
        success: true,
        message: 'Session updated successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to update divergent session ${request.sessionId}: ${error?.message}`,
        error,
      );
      throw error;
    }
  }

  /**
   * List divergent sessions for a user
   */
  async listDivergentSessions(
    user: User,
    options: { limit?: number; offset?: number; status?: DivergentSessionStatus } = {},
  ): Promise<DivergentSessionData[]> {
    try {
      const { limit = 10, offset = 0, status } = options;

      const where: any = { uid: user.uid };
      if (status) {
        where.status = status;
      }

      const sessions = await this.prisma.divergentSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100), // Cap at 100 for performance
        skip: offset,
      });

      return sessions.map(divergentSessionPO2DTO);
    } catch (error) {
      this.logger.error(
        `Failed to list divergent sessions for user ${user.uid}: ${error?.message}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete a divergent session (soft delete by updating status)
   */
  async deleteDivergentSession(user: User, sessionId: string): Promise<DivergentSessionResponse> {
    try {
      const session = await this.prisma.divergentSession.update({
        where: {
          sessionId,
          uid: user.uid,
        },
        data: {
          status: 'failed', // Use 'failed' status to mark as deleted
        },
      });

      this.logger.log(`Deleted divergent session ${sessionId}`);

      return {
        session: divergentSessionPO2DTO(session),
        success: true,
        message: 'Session deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete divergent session ${sessionId}: ${error?.message}`,
        error,
      );
      throw error;
    }
  }
}
