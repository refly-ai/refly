import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { genImageID } from '@refly-packages/utils/id';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';

export const useUploadImage = () => {
  const { addNode } = useAddNode();

  const uploadImage = async (image: File, canvasId: string) => {
    const response = await getClient().upload({
      body: {
        file: image,
        entityId: canvasId,
        entityType: 'canvas',
      },
    });
    return response?.data;
  };

  const handleUploadImage = async (imageFile: File, canvasId: string) => {
    const result = await uploadImage(imageFile, canvasId);
    const { data, success } = result ?? {};
    if (success && data) {
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
      });
      return nodeData;
    }
    return null;
  };

  return {
    handleUploadImage,
  };
};
