import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { DivergentOrchestrator } from './divergent-orchestrator';
import { User, CreatePilotSessionRequest } from '@refly/openapi-schema';
import { genPilotSessionID } from '@refly/utils';
import { ProviderService } from '../provider/provider.service';
import { ProviderItemNotFoundError } from '@refly/errors';
import { DivergentSessionStatus, DivergentSessionListItem } from './types/divergent.types';

/**
 * Service for managing divergent pilot sessions
 * Integrates with existing pilot infrastructure
 */
@Injectable()
export class PilotDivergentService {
  private logger = new Logger(PilotDivergentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly divergentOrchestrator: DivergentOrchestrator,
    private readonly providerService: ProviderService,
  ) {}

  /**
   * Create a divergent pilot session
   */
  async createDivergentSession(
    user: User,
    request: CreatePilotSessionRequest & {
      mode?: 'divergent';
      prompt?: string;
      maxDivergence?: number;
      maxDepth?: number;
    },
  ) {
    const sessionId = genPilotSessionID();

    const providerItem = await this.providerService.findDefaultProviderItem(user, 'agent');

    if (!providerItem) {
      throw new ProviderItemNotFoundError(`No valid provider item found for user ${user.uid}`);
    }

    // Create session with divergent parameters
    const session = await this.prisma.pilotSession.create({
      data: {
        sessionId,
        uid: user.uid,
        title: request.title || request.prompt || 'New Divergent Pilot Session',
        input: JSON.stringify({ query: request.prompt }),
        targetType: request.targetType,
        targetId: request.targetId,
        providerItemId: providerItem.itemId,
        status: 'executing',
        // Divergent specific fields
        mode: 'divergent',
        maxDivergence: request.maxDivergence || 8,
        maxDepth: request.maxDepth || 5,
        currentDepth: 0,
      },
    });

    this.logger.log(`Created divergent session ${sessionId} for user ${user.uid}`);

    // Start divergent execution asynchronously
    this.executeDivergentSessionAsync(sessionId, user);

    return {
      sessionId: session.sessionId,
      status: session.status,
      mode: 'divergent',
    };
  }

  /**
   * Execute divergent session asynchronously
   */
  private async executeDivergentSessionAsync(sessionId: string, user: User) {
    try {
      this.logger.log(`Starting divergent execution for session ${sessionId}`);
      await this.divergentOrchestrator.executeSession(sessionId, user);
      this.logger.log(`Completed divergent execution for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error in divergent execution for session ${sessionId}:`, error);
    }
  }

  /**
   * Get divergent session status
   */
  async getDivergentSessionStatus(sessionId: string): Promise<DivergentSessionStatus> {
    const session = await this.prisma.pilotSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // TODO: Get steps separately - simplified for now
    const executionSteps: unknown[] = [];
    const summarySteps: unknown[] = [];

    return {
      sessionId: session.sessionId,
      status: session.status,
      mode: session.mode,
      currentDepth: session.currentDepth,
      maxDepth: session.maxDepth,
      maxDivergence: session.maxDivergence,
      progress: {
        totalSteps: 0,
        executionSteps: executionSteps.length,
        summarySteps: summarySteps.length,
        completedSteps: 0,
      },
      title: session.title,
      createdAt: session.createdAt?.toISOString() || '',
      updatedAt: session.updatedAt?.toISOString() || '',
    };
  }

  /**
   * List user's divergent sessions
   */
  async listDivergentSessions(user: User, limit = 10): Promise<DivergentSessionListItem[]> {
    const sessions = await this.prisma.pilotSession.findMany({
      where: {
        uid: user.uid,
        mode: 'divergent',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return sessions.map((session) => ({
      sessionId: session.sessionId,
      title: session.title,
      status: session.status,
      mode: session.mode,
      currentDepth: session.currentDepth,
      maxDepth: session.maxDepth,
      stepCount: 0, // TODO: get actual step count
      createdAt: session.createdAt?.toISOString() || '',
      updatedAt: session.updatedAt?.toISOString() || '',
    }));
  }
}
