import { WorkflowApp } from '@refly/openapi-schema';
import { WorkflowApp as WorkflowAppPO, User } from '../../generated/client';
import { safeParseJSON } from '@refly/utils';

export function workflowAppPO2DTO(
  app: WorkflowAppPO & { owner: Pick<User, 'name' | 'nickname' | 'avatar'> | null },
): WorkflowApp | null {
  if (!app) {
    return null;
  }

  return {
    appId: app.appId,
    // IMPORTANT: Include shareId in response for frontend URL generation
    // This allows frontend to use shareId for direct static file access
    shareId: app.shareId ?? undefined,
    title: app.title ?? undefined,
    description: app.description ?? undefined,
    owner: app.owner
      ? {
          uid: app.uid,
          name: app.owner.name,
          nickname: app.owner.nickname,
          avatar: app.owner.avatar,
        }
      : undefined,
    canvasId: app.canvasId ?? '',
    query: app.query ?? undefined,
    variables: safeParseJSON(app.variables),
    resultNodeIds: app.resultNodeIds ?? [],
    coverUrl: (app as any).coverStorageKey
      ? generateCoverUrl((app as any).coverStorageKey)
      : undefined,
    remixEnabled: app.remixEnabled ?? false,
    publishToCommunity: (app as any).publishToCommunity ?? false,
    templateContent: app.templateContent ?? undefined,
    createdAt: app.createdAt?.toISOString(),
    updatedAt: app.updatedAt?.toISOString(),
  } as any;
}

export function generateCoverUrl(storageKey: string): string {
  // Generate public URL for cover image
  // This should match the pattern used in MiscService
  const baseUrl = process.env.STATIC_PUBLIC_ENDPOINT || 'http://localhost:5800/v1/misc/public';
  return `${baseUrl}/${storageKey}`;
}
