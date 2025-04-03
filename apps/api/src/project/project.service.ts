import { Injectable } from '@nestjs/common';
import pLimit from 'p-limit';
import { PrismaService } from '@/common/prisma.service';
import {
  DeleteProjectRequest,
  DeleteProjectItemsRequest,
  UpdateProjectItemsRequest,
  UpsertProjectRequest,
  User,
  ListProjectsData,
} from '@refly-packages/openapi-schema';
import { ParamsError, ProjectNotFoundError } from '@refly-packages/errors';
import { genProjectID } from '@refly-packages/utils';
import { MiscService } from '@/misc/misc.service';
import { KnowledgeService } from '@/knowledge/knowledge.service';
import { RAGService } from '@/rag/rag.service';
import { CanvasService } from '@/canvas/canvas.service';

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RAGService,
    private readonly knowledgeService: KnowledgeService,
    private readonly canvasService: CanvasService,
    private readonly miscService: MiscService,
  ) {}

  async listProjects(user: User, params: ListProjectsData['query']) {
    const { page = 1, pageSize = 10, order = 'creationDesc' } = params;

    const projects = await this.prisma.project.findMany({
      where: {
        uid: user.uid,
        deletedAt: null,
      },
      orderBy: {
        pk: order === 'creationDesc' ? 'desc' : 'asc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return projects.map((project) => ({
      ...project,
      coverUrl: project.coverStorageKey
        ? this.miscService.generateFileURL({ storageKey: project.coverStorageKey })
        : undefined,
    }));
  }

  async getProjectDetail(user: User, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: {
        projectId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!project) {
      throw new ProjectNotFoundError();
    }

    return {
      ...project,
      coverUrl: project.coverStorageKey
        ? this.miscService.generateFileURL({ storageKey: project.coverStorageKey })
        : undefined,
    };
  }

  async createProject(user: User, body: UpsertProjectRequest) {
    const projectId = genProjectID();

    // Check if the given cover static file exists
    if (body.coverStorageKey) {
      const staticFile = await this.prisma.staticFile.findFirst({
        where: {
          storageKey: body.coverStorageKey,
          uid: user.uid,
          deletedAt: null,
        },
      });
      if (!staticFile) {
        throw new ParamsError('coverStorageKey is invalid');
      }
    }

    const project = await this.prisma.project.create({
      data: {
        projectId,
        name: body.name,
        uid: user.uid,
        description: body.description,
        coverStorageKey: body.coverStorageKey,
        customInstructions: body.customInstructions,
      },
    });

    // Bind the cover static file to the project
    if (project.coverStorageKey) {
      await this.prisma.staticFile.updateMany({
        where: {
          storageKey: project.coverStorageKey,
          uid: user.uid,
          deletedAt: null,
        },
        data: {
          entityId: project.projectId,
          entityType: 'project',
        },
      });
    }

    return project;
  }

  async updateProject(user: User, body: UpsertProjectRequest) {
    if (!body.projectId) {
      throw new ParamsError('projectId is required');
    }

    // Check if project exists and belongs to user
    const existingProject = await this.prisma.project.findFirst({
      where: {
        projectId: body.projectId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!existingProject) {
      throw new ProjectNotFoundError();
    }

    // Update the project
    return this.prisma.project.update({
      where: {
        pk: existingProject.pk,
      },
      data: {
        name: body.name,
        description: body.description ?? undefined,
        coverStorageKey: body.coverStorageKey ?? undefined,
        customInstructions: body.customInstructions ?? undefined,
      },
    });
  }

  async updateProjectItems(user: User, body: UpdateProjectItemsRequest) {
    const { projectId, items, operation } = body;

    const project = await this.prisma.project.findUnique({
      where: {
        projectId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!project) {
      throw new ProjectNotFoundError();
    }

    if (items.length === 0) {
      return;
    }

    const documentIds = items
      .filter((item) => item.entityType === 'document')
      .map((item) => item.entityId);
    const resourceIds = items
      .filter((item) => item.entityType === 'resource')
      .map((item) => item.entityId);
    const canvasIds = items
      .filter((item) => item.entityType === 'canvas')
      .map((item) => item.entityId);

    const projectIdUpdate = { projectId: operation === 'add' ? projectId : null };

    await this.prisma.$transaction([
      ...(documentIds.length > 0
        ? [
            this.prisma.document.updateMany({
              where: {
                docId: { in: documentIds },
              },
              data: projectIdUpdate,
            }),
          ]
        : []),
      ...(resourceIds.length > 0
        ? [
            this.prisma.resource.updateMany({
              where: {
                resourceId: { in: resourceIds },
              },
              data: projectIdUpdate,
            }),
          ]
        : []),
      ...(canvasIds.length > 0
        ? [
            this.prisma.canvas.updateMany({
              where: {
                canvasId: { in: canvasIds },
              },
              data: projectIdUpdate,
            }),
          ]
        : []),
    ]);

    if (documentIds.length > 0) {
      await this.ragService.updateDocumentPayload(user, {
        docId: documentIds,
        metadata: { projectId },
      });
    }

    if (resourceIds.length > 0) {
      await this.ragService.updateDocumentPayload(user, {
        resourceId: resourceIds,
        metadata: { projectId },
      });
    }
  }

  async deleteProject(user: User, body: DeleteProjectRequest) {
    // Check if project exists and belongs to user
    const existingProject = await this.prisma.project.findFirst({
      where: {
        projectId: body.projectId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!existingProject) {
      throw new ProjectNotFoundError();
    }

    // Soft delete the project
    await this.prisma.project.update({
      where: {
        projectId: body.projectId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async deleteProjectItems(user: User, body: DeleteProjectItemsRequest) {
    const { items } = body;

    const limit = pLimit(5);
    await Promise.all(
      items.map((item) =>
        limit(async () => {
          switch (item.entityType) {
            case 'canvas':
              await this.canvasService.deleteCanvas(user, { canvasId: item.entityId });
              break;
            case 'document':
              await this.knowledgeService.deleteDocument(user, { docId: item.entityId });
              break;
            case 'resource':
              await this.knowledgeService.deleteResource(user, item.entityId);
              break;
          }
        }),
      ),
    );
  }
}
