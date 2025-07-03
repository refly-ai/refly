import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma.service';
import { ProviderService } from '../provider/provider.service';
import {
  User,
  GenerateMediaRequest,
  MediaType,
  ActionStatus,
  GetActionResultData,
} from '@refly/openapi-schema';
import { genActionResultID } from '@refly/utils';
import { ActionResultNotFoundError } from '@refly/errors';
import { QUEUE_MEDIA } from '../../utils';
import { ActionDetail } from '../action/action.dto';
import { providerItem2ModelInfo } from '../provider/provider.dto';

export interface GenerateMediaJobData {
  userId: string;
  resultId: string;
  version: number;
  mediaType: MediaType;
  prompt: string;
  config: Record<string, any>;
  genId?: string;
}

@Injectable()
export class MediaService {
  private logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: ProviderService,
    @InjectQueue(QUEUE_MEDIA) private mediaQueue: Queue<GenerateMediaJobData>,
  ) {}

  async generateMedia(user: User, request: GenerateMediaRequest): Promise<{ resultId: string }> {
    const resultId = genActionResultID();
    const version = 1;

    // 创建 action result 记录
    await this.prisma.actionResult.create({
      data: {
        resultId,
        version,
        type: 'media',
        uid: user.uid,
        title: `${request.mediaType} generation: ${request.prompt.substring(0, 50)}...`,
        status: 'waiting' as ActionStatus,
        input: JSON.stringify({
          mediaType: request.mediaType,
          prompt: request.prompt,
          config: request.config,
          genId: request.genId,
        }),
        actionMeta: JSON.stringify({
          mediaType: request.mediaType,
        }),
        targetType: request.targetType,
        targetId: request.targetId,
        projectId: request.projectId,
        locale: request.locale || 'zh-CN',
      },
    });

    // 添加到队列
    await this.mediaQueue.add(
      'generateMedia',
      {
        userId: user.uid,
        resultId,
        version,
        mediaType: request.mediaType,
        prompt: request.prompt,
        config: request.config || {},
        genId: request.genId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    return { resultId };
  }

  async getMediaResult(user: User, param: GetActionResultData['query']): Promise<ActionDetail> {
    const { resultId, version } = param;

    const result = await this.prisma.actionResult.findFirst({
      where: {
        resultId,
        version,
        uid: user.uid,
        type: 'media',
      },
      orderBy: { version: 'desc' },
    });

    if (!result) {
      throw new ActionResultNotFoundError();
    }

    const item = await this.providerService.findLLMProviderItemByModelID(user, result.modelName);
    const modelInfo = item ? providerItem2ModelInfo(item) : null;

    const steps = await this.prisma.actionStep.findMany({
      where: {
        resultId: result.resultId,
        version: result.version,
        deletedAt: null,
      },
      orderBy: { order: 'asc' },
    });

    return { ...result, steps, modelInfo };
  }
}
