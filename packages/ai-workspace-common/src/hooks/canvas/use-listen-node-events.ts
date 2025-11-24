import { useCallback, useEffect } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  nodeOperationsEmitter,
  Events,
} from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useAddNode } from './use-add-node';
import {
  CanvasNode,
  convertContextItemsToNodeFilters,
  MediaSkillResponseNodeMeta,
} from '@refly/canvas-common';
import { CodeArtifactNodeMeta } from '@refly/canvas-common';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-preview-control';
import { CanvasNodeType } from '@refly-packages/ai-workspace-common/requests';
import { useReactFlow } from '@xyflow/react';
import { genMediaSkillResponseID, genMediaSkillID } from '@refly/utils/id';
import { useChatStore, useChatStoreShallow, useActionResultStore } from '@refly/stores';
import { useFindImages } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-images';

import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { omit } from '@refly/utils/typesafe';

export const useListenNodeOperationEvents = () => {
  const { readonly, canvasId } = useCanvasContext();
  const { addNode } = useAddNode();
  const { getNodes, getEdges, getNode, deleteElements } = useReactFlow();
  const { t } = useTranslation();

  // Only use canvas store if in interactive mode and not readonly
  const { previewNode } = useNodePreviewControl({ canvasId });

  // Get mediaSelectedModel from store for new mediaSkill nodes
  const { mediaSelectedModel } = useChatStoreShallow((state) => ({
    mediaSelectedModel: state.mediaSelectedModel,
  }));

  const findImages = useFindImages();

  const queryCodeArtifactByResultId = useCallback(
    async (params: { resultId: string; resultVersion: number }) => {
      const { resultId, resultVersion } = params;
      const response = await getClient().listCodeArtifacts({
        query: {
          resultId,
          resultVersion,
          needContent: true,
          page: 1,
          pageSize: 1,
        },
      });

      return response?.data?.data?.[0];
    },
    [],
  );

  const jumpToDescendantNode = useCallback(
    async (entityId: string, descendantNodeType: CanvasNodeType, shouldPreview?: boolean) => {
      const nodes = getNodes() as CanvasNode[];
      const thisNode = nodes.find((node) => node.data?.entityId === entityId);

      if (!thisNode) return [false, null];

      // Find the descendant nodes that are code artifacts and pick the latest one
      const edges = getEdges();
      const descendantNodeIds = edges
        .filter((edge) => edge.source === thisNode.id)
        .map((edge) => edge.target);
      const descendantNodes = nodes
        .filter((node) => descendantNodeIds.includes(node.id))
        .filter((node) => node.type === descendantNodeType)
        .sort(
          (a, b) =>
            new Date(b.data.createdAt ?? '').getTime() - new Date(a.data.createdAt ?? '').getTime(),
        );
      let artifactNode: CanvasNode<CodeArtifactNodeMeta> | null = descendantNodes[0] || null;

      // If artifactNode doesn't exist, try to fetch it from API
      if (!artifactNode && descendantNodeType === 'codeArtifact') {
        message.open({
          type: 'loading',
          content: t('artifact.loading'),
        });

        try {
          const artifactData = await queryCodeArtifactByResultId({
            resultId: entityId,
            resultVersion: Number(thisNode.data?.metadata?.version ?? 0),
          });
          message.destroy();

          if (artifactData) {
            // Create a new codeArtifact node with the fetched data
            const newNodeData = {
              type: 'codeArtifact' as const,
              data: {
                title: artifactData.title || t('canvas.nodeTypes.codeArtifact', 'Code Artifact'),
                entityId: artifactData.artifactId,
                contentPreview: artifactData.content,
                metadata: {
                  status: 'finish' as const,
                  language: artifactData.language || 'typescript',
                  type: artifactData.type || 'text/html',
                  activeTab: 'preview' as const,
                },
              },
            };

            // Add the node to canvas and connect to the parent node
            addNode(
              newNodeData,
              [{ type: thisNode.type as CanvasNodeType, entityId: thisNode.data.entityId }],
              false,
              false,
            );

            // Find the newly created node
            const updatedNodes = getNodes() as CanvasNode[];
            artifactNode = updatedNodes.find(
              (node) =>
                node.data?.entityId === artifactData.artifactId && node.type === 'codeArtifact',
            ) as CanvasNode<CodeArtifactNodeMeta> | null;
          } else {
            // API call succeeded but no data returned
            message.error(t('artifact.componentNotFound', 'Current component does not exist'));
            return [false, null];
          }
        } catch (error) {
          // API call failed
          console.error('Failed to fetch code artifact detail:', error);
          message.error(t('artifact.componentNotFound', 'Current component does not exist'));
          return [false, null];
        }
      }

      if (artifactNode && shouldPreview) {
        // Use the existing node's information for the preview
        previewNode(artifactNode as unknown as CanvasNode);
      }
    },
    [getNodes, getEdges, previewNode, canvasId, addNode, t],
  );

  const handleGenerateMedia = useCallback(
    async ({
      providerItemId,
      mediaType,
      query,
      modelInfo,
      nodeId,
      targetType,
      targetId,
      contextItems,
    }: Events['generateMedia']) => {
      if (readonly) return;

      let targetNodeId = nodeId;
      const { mediaSelectedModel } = useChatStore.getState();

      // Extract the first image storageKey from contextItems
      const storageKeys = contextItems
        ?.filter((item) => item.type === 'image' || item.type === 'video' || item.type === 'audio')
        .flatMap((item) => findImages({ resultId: item.entityId }))
        .map((img) => img.storageKey)
        .filter(Boolean);

      // Get skill response content and append to prompt
      let enhancedQuery = query;
      const skillResponseItems =
        contextItems?.filter((item) => item.type === 'skillResponse') ?? [];

      const documentItems = contextItems?.filter((item) => item.type === 'document') ?? [];

      // Process skill response items
      if (skillResponseItems.length > 0) {
        const { resultMap } = useActionResultStore.getState();
        const skillResponseContents: string[] = [];

        for (const item of skillResponseItems) {
          const result = resultMap[item.entityId];
          if (result?.steps) {
            const stepContents = result.steps?.map((step) => step?.content || '').filter(Boolean);
            if (stepContents.length > 0) {
              skillResponseContents.push(...stepContents);
            }
          }
        }

        if (skillResponseContents.length > 0) {
          // Remove the "Previous responses:" label as per requirements
          enhancedQuery = `${query}\n\n${skillResponseContents.join('\n\n')}`;
        }
      }

      // Process document items and append their content
      if (documentItems.length > 0) {
        const documentContents: string[] = [];

        for (const item of documentItems) {
          try {
            const { data, error } = await getClient().getDocumentDetail({
              query: { docId: item.entityId },
            });
            if (!error && data?.data?.content) {
              documentContents.push(data.data.content);
            }
          } catch (error) {
            console.error('Error fetching document content:', error);
          }
        }

        if (documentContents.length > 0) {
          enhancedQuery = `${enhancedQuery}\n\n${documentContents.join('\n\n')}`;
        }
      }

      try {
        // If nodeId is empty, create a mediaSkill node first
        if (!targetNodeId) {
          const mediaSkillEntityId = genMediaSkillID();

          const mediaSkillNode = {
            type: 'skill' as const,
            data: {
              title: query,
              entityId: mediaSkillEntityId,
              metadata: {
                query,
                selectedModel: omit(mediaSelectedModel, ['creditBilling', 'provider']),
                contextItems,
              },
            },
          };

          // Add the mediaSkill node to canvas
          addNode(mediaSkillNode, convertContextItemsToNodeFilters(contextItems), false, true);

          // Get the created node ID
          const nodes = getNodes();
          const createdNode = nodes?.find((node) => node.data?.entityId === mediaSkillEntityId);
          if (createdNode) {
            targetNodeId = createdNode.id;
          }
        }

        // Process inputParameters to fill in enhancedQuery and storageKeys
        let imageStorageKeyIndex = 0;

        const processedInputParameters = (modelInfo?.inputParameters ?? []).map((param) => {
          if (param.type === 'text') {
            // Fill text type parameter with enhancedQuery
            return {
              ...param,
              value: enhancedQuery,
            };
          } else if (param.type === 'url') {
            // Check if there are multiple url parameters
            const urlParameters = modelInfo?.inputParameters?.filter((p) => p.type === 'url') ?? [];

            if (urlParameters.length === 1) {
              // Single url parameter - use original logic
              if (storageKeys?.length === 1 && !Array.isArray(param.value)) {
                // Single URL as string
                return {
                  ...param,
                  value: storageKeys[0],
                };
              } else {
                // Multiple URLs as array
                return {
                  ...param,
                  value: storageKeys,
                };
              }
            } else if (urlParameters.length > 1) {
              // Multiple url parameters - fill sequentially
              if (storageKeys?.length > 0 && imageStorageKeyIndex < storageKeys.length) {
                const value = storageKeys[imageStorageKeyIndex];
                imageStorageKeyIndex++;
                return {
                  ...param,
                  value: value,
                };
              }
            }
          }
          return param;
        });

        const { data } = await getClient().generateMedia({
          body: {
            prompt: enhancedQuery,
            mediaType,
            model: modelInfo?.name,
            providerItemId,
            targetType,
            targetId,
            inputParameters: processedInputParameters,
          },
        });

        if (data?.success && data?.data?.resultId) {
          // Create MediaSkillResponse node
          const resultId = data.data.resultId;
          const entityId = genMediaSkillResponseID();

          const currentNode = getNode(targetNodeId);

          const newNode: Partial<CanvasNode<MediaSkillResponseNodeMeta>> = {
            type: 'mediaSkillResponse' as const,
            data: {
              title: query,
              entityId,
              metadata: {
                status: 'waiting' as const,
                mediaType,
                prompt: enhancedQuery,
                resultId,
                contextItems,
                modelInfo,
                selectedModel: omit(mediaSelectedModel, ['creditBilling', 'provider']),
                inputParameters: processedInputParameters,
              },
            },
          };
          // Set the new node position to the current node's position
          if (currentNode?.position) {
            newNode.position = { ...currentNode.position };
          }

          // Add the new node without connecting to the current node
          addNode(newNode, convertContextItemsToNodeFilters(contextItems), false, true);

          // Delete the skill node after emitting the event
          deleteElements({ nodes: [currentNode] });

          // Emit completion event to notify mediaSkill node
          nodeOperationsEmitter.emit('mediaGenerationComplete', {
            nodeId: targetNodeId,
            success: true,
          });
        } else {
          console.error('Failed to generate media', data);

          // Emit completion event with error
          nodeOperationsEmitter.emit('mediaGenerationComplete', {
            nodeId: targetNodeId,
            success: false,
            error: 'Failed to generate media',
          });
        }
      } catch (error) {
        console.error('Failed to generate media', error);

        // Emit completion event with error
        nodeOperationsEmitter.emit('mediaGenerationComplete', {
          nodeId: targetNodeId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    [readonly, getNode, addNode, getNodes, mediaSelectedModel, findImages],
  );

  useEffect(() => {
    const handleAddNode = (event: Events['addNode']) => {
      if (readonly) return;

      // Add the node and get the calculated position
      const position = addNode(
        event.node,
        event.connectTo,
        event.shouldPreview,
        event.needSetCenter,
      );

      // If a position callback was provided and we have a position, call it
      if (event.positionCallback && typeof event.positionCallback === 'function' && position) {
        event.positionCallback(position);
      }
    };

    const handleJumpToNode = (event: Events['jumpToDescendantNode']) => {
      if (readonly) return;
      jumpToDescendantNode(event.entityId, event.descendantNodeType, event.shouldPreview);
    };

    nodeOperationsEmitter.on('addNode', handleAddNode);
    nodeOperationsEmitter.on('jumpToDescendantNode', handleJumpToNode);
    nodeOperationsEmitter.on('generateMedia', handleGenerateMedia);

    return () => {
      nodeOperationsEmitter.off('addNode', handleAddNode);
      nodeOperationsEmitter.off('jumpToDescendantNode', handleJumpToNode);
      nodeOperationsEmitter.off('generateMedia', handleGenerateMedia);
    };
  }, [addNode, readonly, previewNode, jumpToDescendantNode, handleGenerateMedia]);
};
