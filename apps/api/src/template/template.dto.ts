import {
  CanvasTemplateCategory as CanvasTemplateCategoryModel,
  CanvasTemplate as CanvasTemplateModel,
} from '@prisma/client';
import { CanvasTemplate, CanvasTemplateCategory } from '@refly-packages/openapi-schema';
import { pick } from '@/utils';

export function canvasTemplatePO2DTO(
  template: CanvasTemplateModel & { category?: CanvasTemplateCategoryModel },
): CanvasTemplate {
  return {
    ...pick(template, [
      'title',
      'uid',
      'version',
      'templateId',
      'categoryId',
      'shareId',
      'templateId',
      'shareUser',
      'description',
      'language',
    ]),
    createdAt: template.createdAt.toJSON(),
    updatedAt: template.updatedAt.toJSON(),
    shareUser: JSON.parse(template.shareUser || '{}'),
    category: template.category ? canvasTemplateCategoryPO2DTO(template.category) : undefined,
  };
}

export function canvasTemplateCategoryPO2DTO(
  category: CanvasTemplateCategoryModel,
): CanvasTemplateCategory {
  return {
    ...pick(category, ['categoryId', 'name', 'labelDict', 'descriptionDict']),
    labelDict: JSON.parse(category.labelDict || '{}'),
    descriptionDict: JSON.parse(category.descriptionDict || '{}'),
  };
}
