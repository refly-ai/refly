import { Injectable, Logger } from '@nestjs/common';
import { throttle } from 'lodash';
import { User, UpsertDocumentRequest, CodeArtifactType } from '@refly/openapi-schema';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PrismaService } from '../common/prisma.service';
import { DocumentService } from '../knowledge/document.service';
import { CollabService } from '../collab/collab.service';
import { CollabContext } from '../collab/collab.dto';
import { ProviderService } from '../provider/provider.service';
import { CodeArtifactService } from '../code-artifact/code-artifact.service';
import { incrementalMarkdownUpdate, safeParseJSON } from '@refly/utils';
import { SkillRunnableConfig } from '@refly/skill-template/src/base';
import {
  SkillPromptModule,
  buildFinalRequestMessages,
  generateDocPromptModule,
  codeArtifactsPromptModule,
} from '@refly/skill-template';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';

@Injectable()
export class InternalToolService {
  private readonly logger = new Logger(InternalToolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentService: DocumentService,
    private readonly providerService: ProviderService,
    private readonly collabService: CollabService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly codeArtifactService: CodeArtifactService,
  ) {}

  /**
   * Generate a document based on user query with LLM streaming
   */
  async generateDoc(
    user: User,
    title: string,
    // outline: string,
    config: SkillRunnableConfig,
  ): Promise<{ docId: string; title: string }> {
    const { resultId } = config.configurable;

    this.logger.log(
      `Starting document generation for user ${user.uid} with title: ${title} and resultId: ${resultId}`,
    );

    try {
      const actionResult = await this.prisma.actionResult.findFirst({
        where: {
          resultId,
          uid: user.uid,
        },
        orderBy: { version: 'desc' },
        take: 1,
      });

      if (!actionResult) {
        throw new Error('Action result not found');
      }

      const { targetId, targetType, projectId, input, providerItemId } = actionResult;

      const canvasId: string | null = targetType === 'canvas' ? targetId : null;

      // Create document
      const documentRequest: UpsertDocumentRequest = {
        title,
        initialContent: '',
        projectId,
        canvasId,
      };

      const document = await this.documentService.createDocument(user, documentRequest);

      // Add node to canvas if canvasId is provided
      if (canvasId) {
        await this.canvasSyncService.addNodeToCanvas(
          user,
          canvasId,
          {
            type: 'document',
            data: {
              title: document.title,
              entityId: document.docId,
              metadata: {
                status: 'finish',
                parentResultId: resultId,
              },
            },
          },
          [{ type: 'skillResponse', entityId: resultId }],
        );
      }

      // Stream LLM response
      const chatModel = await this.providerService.prepareChatModel(user, providerItemId);

      const { requestMessages } = await this.commonPreprocess(
        safeParseJSON(input).query ?? title,
        config,
        generateDocPromptModule,
      );

      // Open direct connection to document for real-time updates
      const collabContext: CollabContext = {
        user: { uid: document.uid } as User,
        entity: document,
        entityType: 'document',
      };

      const connection = await this.collabService.openDirectConnection(
        document.docId,
        collabContext,
      );

      const contentUpdater = (content: string) => {
        incrementalMarkdownUpdate(connection.document, content);
      };

      try {
        await this.streamLLMResponse(chatModel, requestMessages, contentUpdater, 20);
      } finally {
        // Clean up connection
        if (connection) {
          connection.disconnect();
        }
      }

      return {
        docId: document.docId,
        title: document.title,
      };
    } catch (error) {
      this.logger.error(`Document generation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateCodeArtifact(
    user: User,
    title: string,
    type: CodeArtifactType,
    config: SkillRunnableConfig,
  ): Promise<{ artifactId: string; title: string }> {
    const { resultId } = config.configurable;

    this.logger.log(
      `Starting code artifact generation for user ${user.uid} with title: ${title} and resultId: ${resultId}`,
    );

    try {
      const actionResult = await this.prisma.actionResult.findFirst({
        where: {
          resultId,
          uid: user.uid,
        },
        orderBy: { version: 'desc' },
        take: 1,
      });

      if (!actionResult) {
        throw new Error('Action result not found');
      }

      const { targetId, targetType, input, providerItemId } = actionResult;

      const canvasId: string | null = targetType === 'canvas' ? targetId : null;

      // Create code artifact
      const codeArtifact = await this.codeArtifactService.createCodeArtifact(user, {
        title,
        type,
        language: 'text',
        content: '',
        canvasId,
      });

      // Add node to canvas if canvasId is provided
      if (canvasId) {
        await this.canvasSyncService.addNodeToCanvas(
          user,
          canvasId,
          {
            type: 'codeArtifact',
            data: {
              title: codeArtifact.title,
              entityId: codeArtifact.artifactId,
              metadata: {
                status: 'generating',
                parentResultId: resultId,
              },
            },
          },
          [{ type: 'skillResponse', entityId: resultId }],
        );
      }

      // Stream LLM response
      const chatModel = await this.providerService.prepareChatModel(user, providerItemId);

      const { requestMessages } = await this.commonPreprocess(
        safeParseJSON(input).query ?? title,
        config,
        codeArtifactsPromptModule,
      );

      const contentUpdater = async (content: string) => {
        await this.codeArtifactService.updateCodeArtifact(user, {
          artifactId: codeArtifact.artifactId,
          content,
          createIfNotExists: false,
          resultId: actionResult.resultId,
          resultVersion: actionResult.version,
        });
      };

      await this.streamLLMResponse(chatModel, requestMessages, contentUpdater, 1000);

      return {
        artifactId: codeArtifact.artifactId,
        title: codeArtifact.title,
      };
    } catch (error) {
      this.logger.error(`Code artifact generation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async commonPreprocess(
    query: string,
    config: SkillRunnableConfig,
    module: SkillPromptModule,
  ): Promise<{
    optimizedQuery: string;
    requestMessages: any[];
    context: string;
    sources: any[];
    usedChatHistory: any[];
    rewrittenQueries: any[];
  }> {
    // Handle case where preprocessResult might not exist
    const preprocessResult = (config as any).preprocessResult || {};
    const {
      optimizedQuery = '',
      rewrittenQueries = [],
      context = '',
      sources = [],
      usedChatHistory = [],
    } = preprocessResult;
    const { locale = 'en', modelConfigMap, project } = config.configurable;
    const modelInfo = modelConfigMap?.chat;

    // Extract customInstructions from project if available
    const customInstructions = project?.customInstructions;

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages: [],
      context,
      images: [],
      originalQuery: query,
      optimizedQuery,
      rewrittenQueries,
      modelInfo,
      customInstructions,
    });

    return { optimizedQuery, requestMessages, context, sources, usedChatHistory, rewrittenQueries };
  }

  /**
   * Generic method to stream LLM response and update content
   */
  private async streamLLMResponse(
    model: BaseChatModel,
    messages: any[],
    contentUpdater: (content: string) => Promise<void> | void,
    throttleDelay = 1000,
  ): Promise<void> {
    let lastUpdate: Promise<void> = Promise.resolve();
    const throttledUpdate = throttle(
      (content: string) => {
        const p = Promise.resolve(contentUpdater(content));
        lastUpdate = p;
      },
      throttleDelay,
      {
        leading: true,
        trailing: true,
      },
    );

    let accumulatedContent = '';

    try {
      // Stream the LLM response
      const stream = await model.stream(messages);

      for await (const chunk of stream) {
        if (chunk.content) {
          const content = chunk.content.toString();
          accumulatedContent += content;
          throttledUpdate(accumulatedContent);
        }
      }
    } finally {
      // Final update to ensure all content is saved
      if (accumulatedContent) {
        throttledUpdate.flush();
        await lastUpdate;
      }
    }
  }
}
