import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import {
  DeleteProjectRequest,
  UpdateProjectItemsRequest,
  UpsertProjectRequest,
  User,
} from '@refly-packages/openapi-schema';
import { ParamsError, ProjectNotFoundError } from '@refly-packages/errors';
import { genProjectID } from '@refly-packages/utils';
import { MiscService } from '@/misc/misc.service';

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private miscService: MiscService,
  ) {}

  async listProjects(user: User) {
    const projects = await this.prisma.project.findMany({
      where: {
        uid: user.uid,
        deletedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
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
      include: {
        canvases: true,
        documents: true,
        resources: true,
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
      this.prisma.document.updateMany({
        where: {
          docId: { in: documentIds },
        },
        data: projectIdUpdate,
      }),
      this.prisma.resource.updateMany({
        where: {
          resourceId: { in: resourceIds },
        },
        data: projectIdUpdate,
      }),
      this.prisma.canvas.updateMany({
        where: {
          canvasId: { in: canvasIds },
        },
        data: projectIdUpdate,
      }),
    ]);
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
}
