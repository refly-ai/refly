import { Inject, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  DuplicateCodeArtifactRequest,
  ListCodeArtifactsData,
  UpsertCodeArtifactRequest,
  User,
  CanvasNode,
} from '@refly/openapi-schema';
import { streamToString } from '../../utils';
import {
  ActionResultNotFoundError,
  CanvasNotFoundError,
  CodeArtifactNotFoundError,
  ParamsError,
} from '@refly/errors';
import { genCodeArtifactID, safeParseJSON } from '@refly/utils';
import { OSS_INTERNAL, ObjectStorageService } from '../common/object-storage';
import { CodeArtifact as CodeArtifactModel } from '../../generated/client';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';

@Injectable()
export class CodeArtifactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly canvasSyncService: CanvasSyncService,
    @Inject(OSS_INTERNAL) private oss: ObjectStorageService,
  ) {}

  private async doCreateCodeArtifact(user: User, param: UpsertCodeArtifactRequest) {
    const { uid } = user;
    const { title, type, language, content, previewStorageKey, resultId, canvasId, resultVersion } =
      param;

    if (canvasId) {
      const canvas = await this.prisma.canvas.findUnique({
        select: { pk: true },
        where: { canvasId, uid, deletedAt: null },
      });
      if (!canvas) {
        throw new CanvasNotFoundError();
      }
    }

    if (param.artifactId) {
      const existingArtifact = await this.prisma.codeArtifact.findUnique({
        where: { artifactId: param.artifactId },
        select: { uid: true, deletedAt: true },
      });
      if (existingArtifact && existingArtifact.uid !== uid && !existingArtifact.deletedAt) {
        throw new ParamsError(`Code artifact ${param.artifactId} already exists for another user`);
      }
    }

    const artifactId = param.artifactId ?? genCodeArtifactID();
    const storageKey = `code-artifact/${artifactId}`;

    const codeArtifact = await this.prisma.codeArtifact.upsert({
      where: { artifactId },
      create: {
        artifactId,
        title,
        type,
        language,
        storageKey,
        previewStorageKey,
        uid,
        canvasId,
        resultId,
        resultVersion,
      },
      update: {
        title,
        type,
        language,
      },
    });

    if (content) {
      await this.oss.putObject(storageKey, content);
    }

    if (resultId && canvasId) {
      await this.canvasSyncService.addNodesToCanvas(
        user,
        canvasId,
        [
          {
            node: {
              type: 'codeArtifact',
              data: {
                title,
                entityId: codeArtifact.artifactId,
                metadata: {
                  status: 'finish',
                  parentResultId: param.resultId,
                },
                // Use the first 10 lines of content for preview
                contentPreview: (content?.split(/\r?\n/) ?? []).slice(0, 10).join('\n'),
              },
            },
            connectTo: [{ type: 'skillResponse', entityId: param.resultId }],
          },
        ],
        { autoLayout: true },
      );
    }

    return codeArtifact;
  }

  async createCodeArtifact(user: User, param: UpsertCodeArtifactRequest) {
    // Store workflow node execution to update status at the end
    let nodeExecutionToUpdate: { nodeExecutionId: string; nodeData: CanvasNode } | null = null;

    // Check if this code artifact is created by a workflow node execution
    if (param.resultId) {
      const result = await this.prisma.actionResult.findFirst({
        where: { resultId: param.resultId, uid: user.uid },
        orderBy: { version: 'desc' },
      });
      if (!result) {
        throw new ActionResultNotFoundError(`Action result ${param.resultId} not found`);
      }

      param.resultVersion = result.version;
      if (result.targetType === 'canvas') {
        if (param.canvasId && param.canvasId !== result.targetId) {
          throw new ParamsError('resultId target canvasId mismatch');
        }
        param.canvasId = result.targetId;
      }

      if (result.workflowNodeExecutionId) {
        const nodeExecution = await this.prisma.workflowNodeExecution.findUnique({
          where: {
            nodeExecutionId: result.workflowNodeExecutionId,
          },
        });
        if (nodeExecution?.childNodeIds) {
          const childNodeIds = safeParseJSON(nodeExecution.childNodeIds) as string[];
          const docNodeExecution = await this.prisma.workflowNodeExecution.findFirst({
            where: {
              nodeId: { in: childNodeIds },
              status: 'waiting',
              nodeType: 'codeArtifact',
              executionId: nodeExecution.executionId,
            },
            orderBy: {
              createdAt: 'asc',
            },
          });
          if (docNodeExecution?.entityId) {
            param.artifactId = docNodeExecution.entityId;
            const nodeData: CanvasNode = safeParseJSON(docNodeExecution.nodeData);
            nodeExecutionToUpdate = {
              nodeExecutionId: docNodeExecution.nodeExecutionId,
              nodeData,
            };
          }
        }
      }
    }

    try {
      const codeArtifact = await this.doCreateCodeArtifact(user, param);

      // Update workflow node execution status to finish if exists
      if (nodeExecutionToUpdate) {
        await this.prisma.workflowNodeExecution.update({
          where: {
            nodeExecutionId: nodeExecutionToUpdate.nodeExecutionId,
          },
          data: {
            title: param.title,
            entityId: param.artifactId,
            status: 'finish',
            nodeData: JSON.stringify({
              ...nodeExecutionToUpdate.nodeData,
              data: {
                ...nodeExecutionToUpdate.nodeData.data,
                title: param.title,
                entityId: param.artifactId,
              },
            }),
          },
        });
      }

      return codeArtifact;
    } catch (error) {
      // Update workflow node execution status to failed if exists
      if (nodeExecutionToUpdate) {
        try {
          await this.prisma.workflowNodeExecution.update({
            where: {
              nodeExecutionId: nodeExecutionToUpdate.nodeExecutionId,
            },
            data: {
              status: 'failed',
            },
          });
        } catch (updateError) {
          console.error(
            `Failed to update workflow node execution status to failed: ${updateError.message}`,
          );
        }
      }
      throw error;
    }
  }

  async updateCodeArtifact(user: User, body: UpsertCodeArtifactRequest) {
    const { uid } = user;
    const {
      artifactId,
      title,
      type,
      language,
      content,
      previewStorageKey,
      createIfNotExists,
      resultId,
      resultVersion,
      canvasId,
    } = body;

    if (!artifactId) {
      throw new ParamsError('ArtifactId is required for updating a code artifact');
    }

    let existingArtifact = await this.prisma.codeArtifact.findUnique({
      where: { artifactId, deletedAt: null },
    });
    if (existingArtifact && existingArtifact.uid !== uid) {
      throw new ForbiddenException();
    }

    if (!existingArtifact) {
      if (!createIfNotExists) {
        throw new CodeArtifactNotFoundError();
      }
      const storageKey = `code-artifact/${artifactId}`;
      existingArtifact = await this.prisma.codeArtifact.create({
        data: {
          artifactId,
          title,
          type,
          language,
          storageKey,
          previewStorageKey,
          resultId,
          resultVersion,
          uid,
          canvasId,
        },
      });
    } else {
      existingArtifact = await this.prisma.codeArtifact.update({
        where: { artifactId },
        data: {
          title,
          type,
          language,
          previewStorageKey,
          resultId,
          resultVersion,
          canvasId,
        },
      });
    }

    if (content) {
      await this.oss.putObject(existingArtifact.storageKey, content);
    }

    return existingArtifact;
  }

  async getCodeArtifactDetail(user: User, artifactId: string) {
    const { uid } = user;
    const artifact = await this.prisma.codeArtifact.findUnique({
      where: { artifactId, uid, deletedAt: null },
    });

    if (!artifact) {
      throw new CodeArtifactNotFoundError();
    }

    const contentStream = await this.oss.getObject(artifact.storageKey);
    const content = await streamToString(contentStream);

    return {
      ...artifact,
      content,
    };
  }

  async listCodeArtifacts(user: User, query: ListCodeArtifactsData['query']) {
    const { uid } = user;
    const { resultId, resultVersion, needContent, canvasId, page = 1, pageSize = 10 } = query;

    let artifacts: (CodeArtifactModel & { content?: string })[] = [];

    artifacts = await this.prisma.codeArtifact.findMany({
      where: { uid, resultId, resultVersion, deletedAt: null, canvasId },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    if (needContent) {
      for (const artifact of artifacts) {
        const contentStream = await this.oss.getObject(artifact.storageKey);
        const content = await streamToString(contentStream);
        artifact.content = content;
      }
    }

    return artifacts;
  }

  async duplicateCodeArtifact(user: User, param: DuplicateCodeArtifactRequest) {
    const { uid } = user;
    const { artifactId, canvasId: targetCanvasId } = param;
    const artifact = await this.prisma.codeArtifact.findUnique({
      where: { artifactId, uid, deletedAt: null },
    });

    const newArtifactId = genCodeArtifactID();
    const newStorageKey = `code-artifact/${newArtifactId}`;

    const newArtifact = await this.prisma.codeArtifact.create({
      data: {
        artifactId: newArtifactId,
        title: artifact.title,
        type: artifact.type,
        language: artifact.language,
        storageKey: newStorageKey,
        uid,
        canvasId: targetCanvasId || artifact.canvasId,
      },
    });

    const contentStream = await this.oss.getObject(artifact.storageKey);
    if (contentStream) {
      await this.oss.putObject(newStorageKey, contentStream);
    }

    return newArtifact;
  }
}
