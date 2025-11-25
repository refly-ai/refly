import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { User, ListCopilotSessionsData, GetCopilotSessionDetailData } from '@refly/openapi-schema';
import { CopilotSession } from '@prisma/client';
import { CopilotSessionNotFoundError } from '@refly/errors';
import { ActionService } from '../action/action.service';
import { ActionDetail } from '../action/action.dto';

@Injectable()
export class CopilotService {
  private logger = new Logger(CopilotService.name);

  constructor(
    private prisma: PrismaService,
    private actionService: ActionService,
  ) {}

  async listCopilotSessions(
    user: User,
    params: ListCopilotSessionsData['query'],
  ): Promise<CopilotSession[]> {
    const { canvasId } = params;

    const sessions = await this.prisma.copilotSession.findMany({
      where: {
        uid: user.uid,
        ...(canvasId && { canvasId }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sessions;
  }

  async getCopilotSessionDetail(
    user: User,
    params: GetCopilotSessionDetailData['query'],
  ): Promise<CopilotSession & { results: ActionDetail[] }> {
    const { sessionId } = params;

    const session = await this.prisma.copilotSession.findFirst({
      where: {
        sessionId,
        uid: user.uid,
      },
    });

    if (!session) {
      throw new CopilotSessionNotFoundError();
    }

    const results = await this.prisma.actionResult.findMany({
      where: {
        copilotSessionId: sessionId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    const actionDetails = await this.actionService.batchProcessActionResults(user, results);

    return {
      ...session,
      results: actionDetails,
    };
  }
}
