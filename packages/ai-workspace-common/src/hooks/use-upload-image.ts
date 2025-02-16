import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useReactFlow } from '@xyflow/react';
import { genImageID } from '@refly-packages/utils/id';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';

export const useUploadImage = () => {
  const reactFlowInstance = useReactFlow();
  const { addNode } = useAddNode();

  const uploadImage = async (image: File, canvasId: string) => {
    const response = await getClient().upload({
      body: {
        file: image,
        entityId: canvasId,
        entityType: 'canvas',
      },
    });
    return response.data;
  };

  const handleUploadImage = async (imageFile: File, canvasId: string, event?: React.MouseEvent) => {
    const { data, success } = await uploadImage(imageFile, canvasId);
    if (success) {
      const flowPosition = event
        ? reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          })
        : null;
      const nodeData = {
        title: imageFile.name,
        entityId: genImageID(),
        metadata: {
          imageUrl: data.url,
          storageKey: data.storageKey,
        },
      };
      addNode({
        type: 'image',
        data: { ...nodeData },
        position: flowPosition,
      });
      return nodeData;
    }
    return null;
  };

  return {
    handleUploadImage,
  };
};
