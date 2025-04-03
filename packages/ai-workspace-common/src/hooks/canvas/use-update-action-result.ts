import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { ActionResult, SkillEvent } from '@refly/openapi-schema';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { useActionResultStoreShallow } from '@refly-packages/ai-workspace-common/stores/action-result';
import {
  CanvasNodeData,
  ResponseNodeMeta,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { aggregateTokenUsage } from '@refly-packages/utils/models';
import { useSetNodeDataByEntity } from './use-set-node-data-by-entity';
import { processContentPreview } from '../../utils/content';

const generateFullNodeDataUpdates = (
  payload: ActionResult,
): Partial<CanvasNodeData<ResponseNodeMeta>> => {
  return {
    title: payload.title,
    entityId: payload.resultId,
    contentPreview: processContentPreview(payload.steps.map((s) => s?.content || '')),
    metadata: {
      status: payload.status,
      errors: payload.errors,
      actionMeta: payload.actionMeta,
      modelInfo: payload.modelInfo,
      version: payload.version,
      artifacts: payload.steps.flatMap((s) => s.artifacts),
      structuredData: payload.steps.reduce(
        (acc, step) => Object.assign(acc, step.structuredData),
        {},
      ),
      tokenUsage: aggregateTokenUsage(payload.steps.flatMap((s) => s.tokenUsage).filter(Boolean)),
      reasoningContent: processContentPreview(payload.steps.map((s) => s?.reasoningContent || '')),
    },
  };
};

const generatePartialNodeDataUpdates = (payload: ActionResult, event?: SkillEvent) => {
  const { resultId, title, steps = [] } = payload ?? {};
  const nodeData: Partial<CanvasNodeData<ResponseNodeMeta>> = {
    title,
    entityId: resultId,
    metadata: {
      status: payload.status,
      actionMeta: payload.actionMeta,
      modelInfo: payload.modelInfo,
      version: event?.version ?? payload.version,
    },
  };

  const { event: eventType, log } = event ?? {};

  if (eventType === 'stream') {
    nodeData.contentPreview = processContentPreview(steps.map((s) => s?.content || ''));
    nodeData.metadata = {
      ...nodeData.metadata,
      reasoningContent: processContentPreview(steps.map((s) => s?.reasoningContent || '')),
    };
  } else if (eventType === 'artifact') {
    nodeData.metadata = {
      status: payload.status,
      artifacts: steps.flatMap((s) => s.artifacts),
    };
  } else if (eventType === 'log') {
    nodeData.metadata = {
      status: payload.status,
      currentLog: log,
    };
  } else if (eventType === 'structured_data') {
    const structuredData = steps.reduce((acc, step) => Object.assign(acc, step.structuredData), {});
    nodeData.metadata = {
      status: payload.status,
      structuredData: structuredData,
    };
  } else if (eventType === 'token_usage') {
    nodeData.metadata = {
      status: payload.status,
      tokenUsage: aggregateTokenUsage(steps.flatMap((s) => s.tokenUsage).filter(Boolean)),
    };
  } else if (eventType === 'error') {
    nodeData.metadata = {
      status: payload.status,
      errors: payload.errors,
    };
  }

  return nodeData;
};

const isNodeDataEqual = (
  oldData: CanvasNodeData<ResponseNodeMeta>,
  newData: Partial<CanvasNodeData<ResponseNodeMeta>>,
): boolean => {
  // Compare basic properties
  if (oldData.title !== newData.title || oldData.entityId !== newData.entityId) {
    return false;
  }

  // Compare contentPreview
  if (oldData.contentPreview !== newData.contentPreview) {
    return false;
  }

  // Compare metadata
  const oldMetadata = oldData.metadata ?? {};
  const newMetadata = newData.metadata ?? {};

  // Compare all metadata properties
  const allMetadataKeys = new Set([...Object.keys(oldMetadata), ...Object.keys(newMetadata)]);
  for (const key of allMetadataKeys) {
    if (JSON.stringify(oldMetadata[key]) !== JSON.stringify(newMetadata[key])) {
      return false;
    }
  }

  return true;
};

export const useUpdateActionResult = () => {
  const { updateActionResult } = useActionResultStoreShallow((state) => ({
    updateActionResult: state.updateActionResult,
  }));
  const { getNodes } = useReactFlow();
  const setNodeDataByEntity = useSetNodeDataByEntity();

  return useCallback(
    (resultId: string, payload: ActionResult, event?: SkillEvent) => {
      actionEmitter.emit('updateResult', { resultId, payload });
      updateActionResult(resultId, payload);

      // Update canvas node data
      if (payload.targetType === 'canvas') {
        let nodeData = generateFullNodeDataUpdates(payload);
        if (event) {
          nodeData = generatePartialNodeDataUpdates(payload, event);
        }

        // Get current node data from the store
        const nodes = getNodes();
        const currentNode = nodes.find(
          (n) => n.type === 'skillResponse' && n.data?.entityId === resultId,
        );

        // Only update if the data has changed
        if (
          !currentNode?.data ||
          !isNodeDataEqual(currentNode.data as CanvasNodeData<ResponseNodeMeta>, nodeData)
        ) {
          setNodeDataByEntity({ type: 'skillResponse', entityId: resultId }, nodeData);
        }
      }
    },
    [updateActionResult, setNodeDataByEntity],
  );
};
