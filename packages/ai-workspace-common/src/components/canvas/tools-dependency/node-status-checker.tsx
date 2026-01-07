import React, { useMemo, useEffect } from 'react';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { useReactFlow } from '@xyflow/react';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';

interface FailedNode {
  id: string;
  entityId: string;
  title: string;
  status: 'failed' | 'init' | 'unknown';
}

interface NodeStatusCheckerProps {
  canvasId: string;
  onFailedNodesCountChange?: (count: number) => void;
}

/**
 * Node status checker component - display nodes that are not running or failed
 * Inspired by the validation logic of publish-template-button.tsx
 */
export const NodeStatusChecker: React.FC<NodeStatusCheckerProps> = ({
  canvasId,
  onFailedNodesCountChange,
}) => {
  const { t } = useTranslation();
  const { nodes } = useRealtimeCanvasData();
  const { setNodeCenter } = useNodePosition();
  const { getNodes } = useReactFlow();

  // filter out skillResponse nodes
  const skillResponseNodes = useMemo(() => {
    return nodes.filter((node) => node.type === 'skillResponse');
  }, [nodes]);

  // find nodes that are not running or failed
  const failedOrUnrunNodes = useMemo((): FailedNode[] => {
    return skillResponseNodes
      .map((node) => {
        const status = (node.data?.metadata as any)?.status;
        const title = node.data?.title || `Agent ${node.id}`;
        const entityId = node.data?.entityId || node.id;

        // check status: failed, init, or any status that's not running/success are considered nodes to process
        // This should match the logic in useFailedNodesCount
        if (
          status === 'failed' ||
          status === 'init' ||
          (status !== 'running' && status !== 'success')
        ) {
          return {
            id: node.id,
            entityId,
            title,
            status: status === 'failed' ? 'failed' : status === 'init' ? 'init' : 'unknown',
          };
        }
        return null;
      })
      .filter(Boolean) as FailedNode[];
  }, [skillResponseNodes]);

  // locate to specific node function
  const handleLocateNode = (entityId: string) => {
    const allNodes = getNodes();
    const foundNode = allNodes.find((n) => n.data?.entityId === entityId || n.id === entityId);
    if (foundNode) {
      setNodeCenter(foundNode.id, true);

      // trigger node highlight event (same as publish-template-button.tsx)
      window.dispatchEvent(
        new CustomEvent('refly:canvas:fitViewAndHighlight', {
          detail: {
            canvasId,
            nodeIds: [foundNode.id],
          },
        }),
      );
    }
  };

  // get status icon and color
  const getStatusConfig = (status: FailedNode['status']) => {
    switch (status) {
      case 'failed':
        return {
          color: 'var(--refly-func-danger-default)',
          text: t('canvas.workflow.run.nodeStatus.failed') || 'Failed',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
        };
      case 'init':
        return {
          color: 'var(--refly-func-warning-default)',
          text: t('canvas.workflow.run.nodeStatus.notRun') || 'Not Run',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
        };
      default:
        return {
          color: 'var(--refly-func-warning-default)',
          text: t('canvas.workflow.run.nodeStatus.unknown') || 'Unknown',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          borderColor: 'border-gray-200 dark:border-gray-800',
        };
    }
  };

  // notify parent component of failed node count change
  useEffect(() => {
    onFailedNodesCountChange?.(failedOrUnrunNodes.length);
  }, [failedOrUnrunNodes.length, onFailedNodesCountChange]);

  // if there are no problem nodes, do not display the component
  if (failedOrUnrunNodes.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2 md:space-y-3">
      {failedOrUnrunNodes.map((node) => {
        const statusConfig = getStatusConfig(node.status);

        return (
          <div
            key={node.id}
            className="border-solid border-[1px] border-refly-Card-Border rounded-xl p-2 md:p-3 transition-colors"
          >
            {/* Node Header */}
            <div className="py-1 px-1 md:px-2 flex items-center justify-between gap-2 md:gap-3">
              <div className="flex-shrink-0">
                <NodeIcon type="skillResponse" small />
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center gap-1 min-w-0">
                  <div className="min-w-0 max-w-[150px] text-refly-text-0 text-xs md:text-sm font-semibold leading-5 truncate">
                    {node.title}
                  </div>

                  <div
                    className="flex-shrink-0 whitespace-nowrap text-[10px] leading-[16px] font-semibold rounded-[4px] px-1"
                    style={{
                      color: statusConfig.color,
                      backgroundColor: statusConfig.color.replace('default', 'light'),
                    }}
                  >
                    {statusConfig.text}
                  </div>
                </div>
              </div>

              <Button
                type="text"
                size="small"
                className="text-refly-primary-default hover:!text-refly-primary-hover flex-shrink-0 text-xs md:text-sm"
                onClick={() => handleLocateNode(node.entityId)}
              >
                {t('canvas.workflow.run.nodeStatus.locate') || 'Go to locate'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
