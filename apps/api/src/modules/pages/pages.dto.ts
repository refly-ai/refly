import { Page as PageModel, PageNodeRelation as PageNodeRelationModel } from '@prisma/client';
import { Page, PageDetail, PageNodeRelation } from '@refly/openapi-schema';
import { safeParseJSON } from '@refly/utils';
import { pick } from 'lodash';

// User resolution response type
export interface ResolveUserResponse {
  uid: string;
  userInfo?: {
    name?: string;
  };
}

// Node info type for canvas operations
export interface NodeInfo {
  nodeId: string;
  nodeType: string;
  entityId: string;
  nodeData: Record<string, unknown>;
  orderIndex?: number;
  isNew: boolean;
}

// Define NodeData type for canvas nodes
export interface CanvasNode {
  type?: string;
  data?: {
    entityId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Canvas data type
export interface CanvasData {
  nodes?: CanvasNode[];
  [key: string]: unknown;
}

export function pagePO2DTO(page: PageModel): Page {
  return {
    ...pick(page, ['pageId', 'title', 'description']),
    status: page.status === 'draft' || page.status === 'published' ? page.status : 'draft',
    canvasId: page.canvasId,
    coverUrl: page.coverStorageKey,
    createdAt: page.createdAt.toJSON(),
    updatedAt: page.updatedAt.toJSON(),
  };
}

export function pageNodeRelationPO2DTO(relation: PageNodeRelationModel): PageNodeRelation {
  return {
    ...pick(relation, ['relationId', 'pageId', 'nodeId', 'nodeType', 'entityId', 'orderIndex']),
    nodeData: relation.nodeData ? safeParseJSON(relation.nodeData) : {},
  };
}

export interface UpdatePageDto {
  title?: string;
  description?: string;
  nodeRelations?: {
    nodeId: string;
    nodeType?: string;
    entityId?: string;
    nodeData?: unknown;
    orderIndex?: number;
  }[];
  nodeRelationOrders?: {
    relationId: string;
    orderIndex: number;
  }[];
  pageConfig?: Record<string, unknown>;
}

export interface AddPageNodesDto {
  nodeIds: string[];
}

export function pageDetailPO2DTO(pageDetail: {
  page: PageModel;
  nodeRelations: PageNodeRelationModel[];
}): PageDetail {
  return {
    ...pagePO2DTO(pageDetail.page),
    nodeRelations: pageDetail.nodeRelations?.map(pageNodeRelationPO2DTO) || [],
    pageConfig: {},
  };
}
