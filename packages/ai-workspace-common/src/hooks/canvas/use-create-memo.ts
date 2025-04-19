import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genMemoID } from '@refly/utils/id';
import { XYPosition } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { CanvasNodeType } from '@refly/openapi-schema';

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
  }) => {
    const memoId = genMemoID();

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
      options.sourceNode
        ? [{ type: options.sourceNode.type, entityId: options.sourceNode.entityId }]
        : undefined,
      false,
      true,
    );
  };

  return { createMemo };
};
