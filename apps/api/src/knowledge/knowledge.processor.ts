import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { KnowledgeService } from './knowledge.service';
import {
  QUEUE_DELETE_KNOWLEDGE_ENTITY,
  QUEUE_POST_DELETE_KNOWLEDGE_ENTITY,
  QUEUE_RESOURCE,
} from '../utils/const';
import {
  DeleteKnowledgeEntityJobData,
  FinalizeResourceParam,
  PostDeleteKnowledgeEntityJobData,
} from './knowledge.dto';

@Processor(QUEUE_RESOURCE)
export class ResourceProcessor extends WorkerHost {
  private readonly logger = new Logger(ResourceProcessor.name);

  constructor(private knowledgeService: KnowledgeService) {
    super();
  }

  async process(job: Job<FinalizeResourceParam>) {
    this.logger.log(`[${QUEUE_RESOURCE}] job: ${JSON.stringify(job)}`);

    try {
      await this.knowledgeService.finalizeResource(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_RESOURCE}] error: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_DELETE_KNOWLEDGE_ENTITY)
export class DeleteKnowledgeEntityProcessor extends WorkerHost {
  private readonly logger = new Logger(DeleteKnowledgeEntityProcessor.name);

  constructor(private knowledgeService: KnowledgeService) {
    super();
  }

  async process(job: Job<DeleteKnowledgeEntityJobData>) {
    this.logger.log(`[${QUEUE_DELETE_KNOWLEDGE_ENTITY}] job: ${JSON.stringify(job.data)}`);

    const { uid, entityId, entityType } = job.data;

    try {
      if (entityType === 'resource') {
        await this.knowledgeService.deleteResource({ uid }, entityId);
      } else if (entityType === 'document') {
        await this.knowledgeService.deleteDocument({ uid }, { docId: entityId });
      }
    } catch (error) {
      this.logger.error(`[${QUEUE_DELETE_KNOWLEDGE_ENTITY}] error: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_POST_DELETE_KNOWLEDGE_ENTITY)
export class PostDeleteKnowledgeEntityProcessor extends WorkerHost {
  private readonly logger = new Logger(PostDeleteKnowledgeEntityProcessor.name);

  constructor(private knowledgeService: KnowledgeService) {
    super();
  }

  async process(job: Job<PostDeleteKnowledgeEntityJobData>) {
    this.logger.log(`[${QUEUE_POST_DELETE_KNOWLEDGE_ENTITY}] job: ${JSON.stringify(job.data)}`);

    const { uid, entityId, entityType } = job.data;

    try {
      if (entityType === 'resource') {
        await this.knowledgeService.postDeleteResource({ uid }, entityId);
      } else if (entityType === 'document') {
        await this.knowledgeService.postDeleteDocument({ uid }, entityId);
      }
    } catch (error) {
      this.logger.error(`[${QUEUE_POST_DELETE_KNOWLEDGE_ENTITY}] error: ${error?.stack}`);
      throw error;
    }
  }
}
