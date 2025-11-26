import { Injectable, Logger } from '@nestjs/common';
import {
  ListCanvasTemplatesData,
  User,
  ShareUser,
  CreateCanvasTemplateRequest,
  UpdateCanvasTemplateRequest,
} from '@refly/openapi-schema';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { genCanvasTemplateID } from '@refly/utils';
import { ShareCreationService } from '../share/share-creation.service';
import { MiscService } from '../misc/misc.service';

@Injectable()
export class TemplateService {
  private logger = new Logger(TemplateService.name);

  constructor(
    private prisma: PrismaService,
    private shareCreationService: ShareCreationService,
    private miscService: MiscService,
  ) {}

  async listCanvasTemplates(user: User | null, param: ListCanvasTemplatesData['query']) {
    const { categoryId, scope, language, page, pageSize } = param;

    const where: Prisma.CanvasTemplateWhereInput = {
      deletedAt: null,
    };
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (language) {
      where.language = language;
    }

    // If user is null or scope is public, only show public templates
    if (!user || scope === 'public') {
      where.isPublic = true;
    } else if (scope === 'private' && user) {
      where.uid = user.uid;
    }

    const templates = await this.prisma.canvasTemplate.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: Math.min(pageSize, 12), // Limit to maximum 12 templates (3 rows)
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    // Get all appIds from templates to query WorkflowApp
    const appIds = templates
      .map((template) => template.appId)
      .filter((appId): appId is string => appId !== null);

    // Query WorkflowApp to get coverStorageKey
    const workflowApps =
      appIds.length > 0
        ? await this.prisma.workflowApp.findMany({
            where: { appId: { in: appIds }, deletedAt: null },
            select: { appId: true, coverStorageKey: true, shareId: true },
          })
        : [];

    // Create a map for quick lookup
    const workflowAppMap = new Map(workflowApps.map((app) => [app.appId, app]));

    // Convert cover storage keys to accessible image URLs
    const templatesWithCoverUrls = await Promise.all(
      templates.map(async (template) => {
        let coverUrl: string | undefined = '';

        // Get coverStorageKey from associated WorkflowApp
        let appShareId: string | undefined;
        if (template.appId) {
          const workflowApp = workflowAppMap.get(template.appId);
          appShareId = workflowApp?.shareId;

          if (workflowApp?.coverStorageKey) {
            try {
              // Generate a public URL for the cover image using WorkflowApp's coverStorageKey
              coverUrl = this.miscService.generateFileURL({
                storageKey: workflowApp.coverStorageKey,
                visibility: 'public',
              });
            } catch (error) {
              this.logger.warn(
                `Failed to generate cover URL for template ${template.templateId}: ${error.message}`,
              );
            }
          }
        }

        return {
          ...template,
          coverUrl,
          appShareId,
        };
      }),
    );

    return templatesWithCoverUrls;
  }

  async createCanvasTemplate(user: User, param: CreateCanvasTemplateRequest) {
    const { categoryId, canvasId, title, description, language, coverStorageKey } = param;
    const userPo = await this.prisma.user.findFirst({ where: { uid: user.uid } });
    if (!userPo) {
      this.logger.warn(`user not found for uid ${user.uid} when creating canvas template`);
      return;
    }

    const { shareRecord } = await this.shareCreationService.createShareForCanvas(user, {
      entityType: 'canvas',
      entityId: canvasId,
      title,
      allowDuplication: true,
    });

    const shareUser: ShareUser = {
      uid: userPo.uid,
      name: userPo.name,
      avatar: userPo.avatar,
    };
    const template = await this.prisma.canvasTemplate.create({
      data: {
        categoryId,
        templateId: genCanvasTemplateID(),
        shareId: shareRecord.shareId,
        uid: userPo.uid,
        shareUser: JSON.stringify(shareUser),
        title,
        description,
        language,
      },
    });
    await this.prisma.shareRecord.update({
      where: { shareId: shareRecord.shareId },
      data: { templateId: template.templateId },
    });

    if (coverStorageKey) {
      await this.miscService.duplicateFile(user, {
        sourceFile: { storageKey: coverStorageKey, visibility: 'public' },
        targetFile: {
          storageKey: `share-cover/${shareRecord.shareId}.png`,
          visibility: 'public',
        },
      });
    }

    return template;
  }

  async updateCanvasTemplate(user: User, param: UpdateCanvasTemplateRequest) {
    const { templateId, title, description, language } = param;
    const template = await this.prisma.canvasTemplate.update({
      where: { templateId, uid: user.uid },
      data: { title, description, language },
    });
    return template;
  }

  async listCanvasTemplateCategories() {
    return this.prisma.canvasTemplateCategory.findMany();
  }
}
