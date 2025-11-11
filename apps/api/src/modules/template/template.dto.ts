import {
  CanvasTemplateCategory as CanvasTemplateCategoryModel,
  CanvasTemplate as CanvasTemplateModel,
} from '../../generated/client';
import { CanvasTemplate, CanvasTemplateCategory } from '@refly/openapi-schema';
import { pick } from '../../utils';
import { safeParseJSON } from '@refly/utils';

export function canvasTemplatePO2DTO(
  template: CanvasTemplateModel & {
    category?: CanvasTemplateCategoryModel;
    coverUrl?: string;
    appShareId?: string;
  },
): CanvasTemplate {
  return {
    ...pick(template, [
      'title',
      'uid',
      'version',
      'templateId',
      'categoryId',
      'shareId',
      'appId',
      'templateId',
      'shareUser',
      'description',
      'language',
    ]),
    createdAt: template.createdAt.toJSON(),
    updatedAt: template.updatedAt.toJSON(),
    shareUser: safeParseJSON(template.shareUser || '{}'),
    category: template.category ? canvasTemplateCategoryPO2DTO(template.category) : undefined,
    featured: template.priority > 0 ? true : undefined,
    coverUrl: template.coverUrl,
    appShareId: template.appShareId,
  };
}

export function canvasTemplateCategoryPO2DTO(
  category: CanvasTemplateCategoryModel,
): CanvasTemplateCategory {
  return {
    ...pick(category, ['categoryId', 'name', 'labelDict', 'descriptionDict']),
    labelDict: safeParseJSON(category.labelDict || '{}'),
    descriptionDict: safeParseJSON(category.descriptionDict || '{}'),
  };
}
