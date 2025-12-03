import { memo, useMemo, useCallback } from 'react';
import { type NodeRelation } from './ArtifactRenderer';
import { NodeBlockHeader } from './NodeBlockHeader';
import { useTranslation } from 'react-i18next';
import { Tooltip, Button } from 'antd';
import { DownloadIcon } from 'lucide-react';
import {
  downloadNodeData,
  hasDownloadableData,
  shareNodeData,
  hasShareableData,
  type NodeData,
} from '@refly-packages/ai-workspace-common/utils/download-node-data';
import { Share } from 'refly-icons';
import { logEvent } from '@refly/telemetry-web';
import { CanvasNode } from '@refly/openapi-schema';
import { ResultItemPreview } from '@refly-packages/ai-workspace-common/components/workflow-app/ResultItemPreview';
import { usePublicFileUrlContext } from '@refly-packages/ai-workspace-common/context/public-file-url';

// Content renderer component
const NodeRenderer = memo(
  ({
    node,
    isFullscreen = false,
    isModal = false,
    isMinimap = false,
    fromProducts = false,
    onDelete,
    inModal = false,
  }: {
    node: NodeRelation;
    isFullscreen?: boolean;
    isModal?: boolean;
    isMinimap?: boolean;
    isFocused?: boolean;
    fromProducts?: boolean;
    onDelete?: (nodeId: string) => void;
    onStartSlideshow?: (nodeId: string) => void;
    onWideMode?: (nodeId: string) => void;
    inModal?: boolean;
  }) => {
    const { t } = useTranslation();
    const usePublicFileUrl = usePublicFileUrlContext();

    // Check if node has downloadable data
    const nodeData: NodeData = useMemo(
      () => ({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        entityId: node.entityId,
        title: node.nodeData?.title,
        metadata: node.nodeData?.metadata,
      }),
      [node],
    );

    const canDownload = useMemo(() => hasDownloadableData(nodeData), [nodeData]);
    const canShare = useMemo(() => hasShareableData(nodeData), [nodeData]);

    // Handle download for any node type
    const handleDownload = useCallback(async () => {
      if (fromProducts) {
        logEvent('download_template_result', null, {
          nodeId: nodeData.nodeId,
          nodeType: nodeData.nodeType,
          title: nodeData.title,
        });
      }
      await downloadNodeData(nodeData, t, { usePublicFileUrl });
    }, [nodeData, t, fromProducts, usePublicFileUrl]);

    // Handle share for any node type
    const handleShare = useCallback(async () => {
      if (fromProducts) {
        logEvent('share_template_result', null, {
          nodeId: nodeData.nodeId,
          nodeType: nodeData.nodeType,
          title: nodeData.title,
        });
      }
      await shareNodeData(nodeData, t);
    }, [nodeData, t, fromProducts]);

    // Generic node block header
    const renderNodeHeader =
      !isFullscreen && !isModal ? (
        <NodeBlockHeader
          isFullscreen={isFullscreen}
          isModal={isModal}
          node={node}
          isMinimap={isMinimap}
          onDelete={onDelete}
          nodeHeaderClassName={fromProducts ? 'bg-transparent' : undefined}
          rightActions={
            <div className="flex items-center gap-1">
              {canDownload && (
                <Tooltip title={t('canvas.nodeActions.download', 'Download')}>
                  <Button
                    type="text"
                    className="flex items-center justify-center border-none bg-[var(--refly-bg-float-z3)] hover:bg-[var(--refly-fill-hover)] text-[var(--refly-text-1)] hover:text-[var(--refly-primary-default)] transition"
                    icon={<DownloadIcon size={16} />}
                    onClick={handleDownload}
                  >
                    {/* <span className="sr-only" /> */}
                  </Button>
                </Tooltip>
              )}
              {canShare && (
                <Tooltip title={t('canvas.nodeActions.share', 'Share')}>
                  <Button
                    type="text"
                    className="flex items-center justify-center border-none bg-[var(--refly-bg-float-z3)] hover:bg-[var(--refly-fill-hover)] text-[var(--refly-text-1)] hover:text-[var(--refly-primary-default)] transition"
                    icon={<Share size={16} />}
                    onClick={handleShare}
                  >
                    {/* <span className="sr-only" /> */}
                  </Button>
                </Tooltip>
              )}
            </div>
          }
        />
      ) : null;

    return (
      <div className="flex flex-col h-full bg-[var(--refly-bg-content-z2)] text-[var(--refly-text-1)]">
        {renderNodeHeader}
        <div className="m-3 mt-0 h-full overflow-hidden rounded-lg cursor-pointer border border-[var(--refly-Card-Border)] bg-[var(--refly-bg-main-z1)] hover:bg-[var(--refly-bg-control-z0)]">
          <ResultItemPreview
            inModal={inModal}
            node={{ ...node, data: node.nodeData, type: node.nodeType } as unknown as CanvasNode}
          />
        </div>
      </div>
    );
  },
  // Custom comparison function, only re-render when key properties change
  (prevProps, nextProps) => {
    // Check if key properties have changed
    return (
      prevProps.node.nodeId === nextProps.node.nodeId &&
      prevProps.node.nodeType === nextProps.node.nodeType &&
      prevProps.isFullscreen === nextProps.isFullscreen &&
      prevProps.isModal === nextProps.isModal &&
      prevProps.isMinimap === nextProps.isMinimap &&
      prevProps.isFocused === nextProps.isFocused
    );
  },
);

export { NodeRenderer };
