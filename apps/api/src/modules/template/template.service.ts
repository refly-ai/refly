import { Injectable, Logger } from '@nestjs/common';
import {
  ListCanvasTemplatesData,
  User,
  ShareUser,
  CreateCanvasTemplateRequest,
  UpdateCanvasTemplateRequest,
} from '@refly/openapi-schema';
import { genCanvasTemplateID } from '@refly/utils';
import { PrismaService } from '../common/prisma.service';
import { ShareCreationService } from '../share/share-creation.service';
import { MiscService } from '../misc/misc.service';
import { SingleFlightCache } from '../../utils/cache';

import type { CanvasTemplateCategory, Prisma } from '@prisma/client';

const TEMPLATE_CATEGORY_CACHE_TTL = 60 * 1000;

@Injectable()
export class TemplateService {
  private logger = new Logger(TemplateService.name);
  private readonly canvasTemplateCategoryCache: SingleFlightCache<CanvasTemplateCategory[]>;

  constructor(
    private prisma: PrismaService,
    private shareCreationService: ShareCreationService,
    private miscService: MiscService,
  ) {
    this.canvasTemplateCategoryCache = new SingleFlightCache<CanvasTemplateCategory[]>(
      this.loadCanvasTemplateCategories.bind(this),
      {
        ttl: TEMPLATE_CATEGORY_CACHE_TTL,
      },
    );
  }

  async listCanvasTemplates(user: User | null, param: ListCanvasTemplatesData['query']) {
    const { categoryId, scope, language, page, pageSize } = param;

    const where: Prisma.CanvasTemplateWhereInput = {
      deletedAt: null,
    };

    // If categoryId is provided, filter via relation table
    if (categoryId) {
      const relations = await this.prisma.canvasTemplateCategoryRelation.findMany({
        where: { categoryId, deletedAt: null },
        select: { templateId: true },
      });

      const templateIds =
        relations?.map((r) => r?.templateId).filter((id): id is string => !!id) ?? [];

      // If no templates found for this category, return empty array
      if (templateIds.length === 0) {
        return [];
      }

      where.templateId = { in: templateIds };
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

    // Convert cover storage keys to accessible image URLs
    const templatesWithCoverUrls = await Promise.all(
      templates.map(async (template) => {
        const coverUrl: string | undefined = template.coverStorageKey
          ? this.miscService.generateFileURL({
              storageKey: template.coverStorageKey,
              visibility: 'public',
            })
          : undefined;

        return {
          ...template,
          coverUrl,
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
    return this.canvasTemplateCategoryCache.get();
  }

  private async loadCanvasTemplateCategories(): Promise<CanvasTemplateCategory[]> {
    // Get all categories that are not deleted
    const categories = await this.prisma.canvasTemplateCategory.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });

    if (categories.length === 0) {
      return [];
    }

    // Get all category IDs
    const categoryIds = categories.map((cat) => cat.categoryId);

    // Get all public, not-deleted template IDs
    const publicTemplates = await this.prisma.canvasTemplate.findMany({
      where: {
        deletedAt: null,
        isPublic: true,
      },
      select: { templateId: true },
    });

    const publicTemplateIds = publicTemplates.map((t) => t.templateId);

    if (publicTemplateIds.length === 0) {
      return [];
    }

    // Count templates for each category using groupBy
    // Only count public templates that are not deleted
    const counts = await this.prisma.canvasTemplateCategoryRelation.groupBy({
      by: ['categoryId'],
      where: {
        categoryId: { in: categoryIds },
        deletedAt: null,
        templateId: { in: publicTemplateIds },
      },
      _count: {
        templateId: true,
      },
    });

    // Create a map for quick lookup
    const countMap = new Map(counts.map((item) => [item.categoryId, item._count.templateId]));

    // Filter categories that have at least one template
    const categoriesWithTemplates = categories.filter(
      (category) => (countMap.get(category.categoryId) ?? 0) > 0,
    );

    return categoriesWithTemplates;
  }
}
