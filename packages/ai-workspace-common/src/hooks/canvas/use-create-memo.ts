import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genMemoID } from '@refly/utils/id';
import { XYPosition } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { CanvasNodeType } from '@refly/openapi-schema';
import { CanvasNodeFilter } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';

export const useCreateMemo = () => {
  const { t } = useTranslation();
  const { addNode } = useAddNode();

  const createMemo = (options: {
    content: string;
    position?: XYPosition;
    sourceNode?: {
      type: CanvasNodeType;
      entityId: string;
    };
    targetNode?: {
      type: CanvasNodeType;
      entityId: string;
    };
  }) => {
    const memoId = genMemoID();
    const { sourceNode, targetNode } = options;

    let connectTo: CanvasNodeFilter[] | undefined;

    if (sourceNode) {
      connectTo = [{ type: sourceNode.type, entityId: sourceNode.entityId, handleType: 'source' }];
    } else if (targetNode) {
      connectTo = [{ type: targetNode.type, entityId: targetNode.entityId, handleType: 'target' }];
    }

    addNode(
      {
        type: 'memo',
        data: {
          title: t('canvas.nodeTypes.memo'),
          contentPreview: options.content,
          entityId: memoId,
        },
        position: options.position,
      },
      connectTo,
      false,
      true,
    );
  };

  return { createMemo };
};
