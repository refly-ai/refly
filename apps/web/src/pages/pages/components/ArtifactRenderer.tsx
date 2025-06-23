import { memo, useMemo, useCallback } from 'react';
import { message } from 'antd';
import {
  useGetCodeArtifactDetail,
  useGetDocumentDetail,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import Renderer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/render';
import { useTranslation } from 'react-i18next';

// Interface definitions
interface NodeData {
  title?: string;
  content?: string;
  metadata?: {
    [key: string]: any;
    url?: string;
    content?: string;
    status?: string;
  };
  entityId?: string;
  [key: string]: any;
}

interface NodeRelation {
  relationId: string;
  pageId?: string;
  nodeId: string;
  nodeType: string;
  entityId: string;
  orderIndex: number;
  nodeData: NodeData;
}

// Unified artifact renderer component
const ArtifactRenderer = memo(
  ({
    node,
    type: rendererType,
    isFullscreen = false,
    isMinimap = false,
  }: {
    node: NodeRelation;
    type: 'document' | 'code';
    isFullscreen?: boolean;
    isMinimap?: boolean;
  }) => {
    const { t } = useTranslation();
    const artifactId = node.nodeData?.entityId || '';
    const {
      title = rendererType === 'document'
        ? t('pages.components.documentComponent')
        : t('pages.components.codeComponent'),
      status,
      shareId,
      type = 'text/html', // Default type
      language,
    } = node.nodeData?.metadata || {};

    // Choose different data fetching hook based on type
    const { data: remoteData, isLoading: isRemoteLoading } =
      rendererType === 'document'
        ? useGetDocumentDetail(
            {
              query: {
                docId: artifactId,
              },
            },
            [artifactId],
            {
              enabled: Boolean(!shareId && artifactId),
            },
          )
        : useGetCodeArtifactDetail(
            {
              query: {
                artifactId,
              },
            },
            [artifactId],
            {
              enabled: Boolean(!shareId && artifactId && status?.startsWith('finish')),
            },
          );

    const { data: shareData, loading: isShareLoading } = useFetchShareData(shareId);

    const isLoading = isRemoteLoading || isShareLoading;

    // Merge data sources
    const artifactData = useMemo(
      () => shareData || remoteData?.data || null,
      [shareData, remoteData],
    );

    // Get content
    const content = artifactData?.content || node.nodeData?.metadata?.content || '';

    // Determine current rendering type
    const currentType = rendererType === 'document' ? 'text/markdown' : artifactData?.type || type;

    const handleRequestFix = useCallback(() => {
      message.info(t('pages.components.artifact.fixNotAvailable'));
    }, [t]);

    if (!artifactId) {
      return (
        <div className="h-full flex items-center justify-center bg-white rounded p-3">
          <span className="text-gray-500">
            {t('pages.components.artifact.notSelected', {
              type:
                rendererType === 'document'
                  ? t('common.document').toLowerCase()
                  : t('pages.components.artifact.code').toLowerCase(),
            })}
          </span>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex h-full w-full grow items-center justify-center">
          <div className="text-gray-500">
            {t('pages.components.artifact.loading', {
              type:
                rendererType === 'document'
                  ? t('common.document').toLowerCase()
                  : t('pages.components.artifact.code').toLowerCase(),
            })}
          </div>
        </div>
      );
    }

    return (
      <div
        className={`h-full bg-white dark:bg-gray-900 ${!isFullscreen ? 'rounded px-4 pb-4' : 'w-full'} ${isMinimap ? 'p-1' : ''}`}
      >
        <div className="h-full w-full overflow-hidden flex flex-col">
          {isMinimap ? (
            <div className="flex-1 bg-white dark:bg-gray-900 overflow-hidden">
              {status === 'generating' ? (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="text-xs text-gray-500">
                    {t('pages.components.artifact.generating', { type: '' })}
                  </div>
                </div>
              ) : (
                <div className="transform scale-[0.5] origin-top-left w-[200%] h-[200%] overflow-hidden bg-white dark:bg-gray-900 rounded shadow-sm">
                  <Renderer
                    content={content}
                    type={currentType}
                    title={title}
                    language={artifactData?.language || language}
                    readonly
                    onRequestFix={handleRequestFix}
                    width="100%"
                    height="100%"
                  />
                </div>
              )}
            </div>
          ) : (
            <div
              className={`flex-1 ${isFullscreen ? 'h-[calc(100vh-100px)]' : ''} overflow-${rendererType === 'document' ? 'auto' : 'hidden'}`}
            >
              {status === 'generating' ? (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="text-gray-500">
                    {t('pages.components.artifact.generating', {
                      type:
                        rendererType === 'document'
                          ? t('common.document').toLowerCase()
                          : t('pages.components.artifact.code').toLowerCase(),
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex-grow">
                    <Renderer
                      content={content}
                      type={currentType}
                      title={title}
                      language={artifactData?.language || language}
                      readonly
                      onRequestFix={handleRequestFix}
                      width="100%"
                      height="100%"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Only skip re-rendering when node ID, type, and key metadata haven't changed
    const prevMetadata = prevProps.node.nodeData?.metadata || {};
    const nextMetadata = nextProps.node.nodeData?.metadata || {};

    return (
      prevProps.type === nextProps.type &&
      prevProps.node.entityId === nextProps.node.entityId &&
      prevMetadata.content === nextMetadata.content &&
      prevMetadata.status === nextMetadata.status &&
      prevMetadata.type === nextMetadata.type
    );
  },
);

export { ArtifactRenderer, type NodeRelation, type NodeData };
