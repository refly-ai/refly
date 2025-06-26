import { Injectable, Logger } from '@nestjs/common';
import {
  ListCanvasTemplatesData,
  User,
  ShareUser,
  CreateCanvasTemplateRequest,
  UpdateCanvasTemplateRequest,
} from '@refly/openapi-schema';
import { Prisma } from '../../generated/client';
import { PrismaService } from '../common/prisma.service';
import { genCanvasTemplateID } from '@refly/utils';
import { ShareService } from '../share/share.service';
import { MiscService } from '../misc/misc.service';

@Injectable()
export class TemplateService {
  private logger = new Logger(TemplateService.name);

  constructor(
    private prisma: PrismaService,
    private shareService: ShareService,
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
      take: pageSize,
      include: { category: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return templates;
  }

  async createCanvasTemplate(user: User, param: CreateCanvasTemplateRequest) {
    const { categoryId, canvasId, title, description, language, coverStorageKey } = param;
    const userPo = await this.prisma.user.findFirst({ where: { uid: user.uid } });
    if (!userPo) {
      this.logger.warn(`user not found for uid ${user.uid} when creating canvas template`);
      return;
    }

    const { shareRecord } = await this.shareService.createShareForCanvas(user, {
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
      await this.miscService.duplicateFile({
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
