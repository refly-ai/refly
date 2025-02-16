import { useCallback } from 'react';
import { ActionResult, SkillEvent } from '@refly/openapi-schema';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { useActionResultStoreShallow } from '@refly-packages/ai-workspace-common/stores/action-result';
import {
  CanvasNodeData,
  ResponseNodeMeta,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { aggregateTokenUsage } from '@refly-packages/utils/models';
import { useSetNodeDataByEntity } from './use-set-node-data-by-entity';
import { getWholeParsedContent } from '@refly-packages/utils/content-parser';

const generateFullNodeDataUpdates = (
  payload: ActionResult,
): Partial<CanvasNodeData<ResponseNodeMeta>> => {
  return {
    title: payload.title,
    entityId: payload.resultId,
    contentPreview: payload.steps
      .map((s) => getWholeParsedContent(s?.reasoningContent, s?.content))
      ?.filter(Boolean)
      ?.join('\n'),
    metadata: {
      status: payload.status,
      actionMeta: payload.actionMeta,
      modelInfo: payload.modelInfo,
      version: payload.version,
      artifacts: payload.steps.flatMap((s) => s.artifacts),
      structuredData: payload.steps.reduce(
        (acc, step) => Object.assign(acc, step.structuredData),
        {},
      ),
      tokenUsage: aggregateTokenUsage(payload.steps.flatMap((s) => s.tokenUsage).filter(Boolean)),
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
    nodeData.contentPreview = steps
      .map((s) => getWholeParsedContent(s?.reasoningContent, s?.content))
      ?.filter(Boolean)
      ?.join('\n');
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
  }

  return nodeData;
};

export const useUpdateActionResult = () => {
  const { updateActionResult } = useActionResultStoreShallow((state) => ({
    updateActionResult: state.updateActionResult,
  }));
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
        setNodeDataByEntity<ResponseNodeMeta>(
          { type: 'skillResponse', entityId: resultId },
          nodeData,
        );
      }
    },
    [updateActionResult, setNodeDataByEntity],
  );
};
