import { useCallback } from 'react';
import {
  ActionStep,
  ActionStepMeta,
  Artifact,
  CodeArtifactType,
  Entity,
  InvokeSkillRequest,
  SkillEvent,
} from '@refly/openapi-schema';
import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { ssePost } from '@refly-packages/ai-workspace-common/utils/sse-post';
import { LOCALE } from '@refly/common-types';
import { getRuntime } from '@refly/utils/env';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { showErrorNotification } from '@refly-packages/ai-workspace-common/utils/notification';
import { useActionResultStore } from '@refly-packages/ai-workspace-common/stores/action-result';
import { aggregateTokenUsage, genActionResultID } from '@refly-packages/utils/index';
import {
  CanvasNodeData,
  SkillNodeMeta,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { convertContextItemsToInvokeParams } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { useFindThreadHistory } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-thread-history';
import { useActionPolling } from './use-action-polling';
import { useFindMemo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-memo';
import { useUpdateActionResult } from './use-update-action-result';
import { useSubscriptionUsage } from '../use-subscription-usage';
import { useCanvasStore } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useFindCodeArtifact } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-code-artifact';
import { useFindImages } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-images';
import { ARTIFACT_TAG_CLOSED_REGEX, getArtifactContentAndAttributes } from '@refly/utils/artifact';
import { useFindWebsite } from './use-find-website';
import { codeArtifactEmitter } from '@refly-packages/ai-workspace-common/events/codeArtifact';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

export const useInvokeAction = () => {
  const { addNode } = useAddNode();
  const setNodeDataByEntity = useSetNodeDataByEntity();

  const globalAbortControllerRef = { current: null as AbortController | null };
  const globalIsAbortedRef = { current: false as boolean };

  const { refetchUsage } = useSubscriptionUsage();

  const { createTimeoutHandler } = useActionPolling();
  const onUpdateResult = useUpdateActionResult();

  const onSkillStart = (_skillEvent: SkillEvent) => {};

  const onSkillLog = (skillEvent: SkillEvent) => {
    const { resultId, step, log } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.logs = [...(updatedStep.logs || []), log];

    const updatedResult = {
      ...result,
      status: 'executing' as const,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };
    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);
  };

  const onSkillTokenUsage = (skillEvent: SkillEvent) => {
    const { resultId, step, tokenUsage } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.tokenUsage = aggregateTokenUsage([...(updatedStep.tokenUsage ?? []), tokenUsage]);

    onUpdateResult(
      resultId,
      {
        ...result,
        steps: getUpdatedSteps(result.steps ?? [], updatedStep),
      },
      skillEvent,
    );
  };

  const findOrCreateStep = (steps: ActionStep[], stepMeta: ActionStepMeta) => {
    const existingStep = steps?.find((s) => s.name === stepMeta?.name);
    return existingStep
      ? { ...existingStep }
      : {
          ...stepMeta,
          content: '',
          reasoningContent: '',
          artifacts: [],
          structuredData: {},
        };
  };

  const getUpdatedSteps = (steps: ActionStep[], updatedStep: ActionStep) => {
    if (!steps?.find((step) => step.name === updatedStep.name)) {
      return [...steps, updatedStep];
    }
    return steps.map((step) => (step.name === updatedStep.name ? updatedStep : step));
  };

  const onSkillStreamArtifact = (resultId: string, artifact: Artifact, content: string) => {
    // Handle code artifact content if this is a code artifact stream
    if (artifact && artifact.type === 'codeArtifact') {
      // Get the code content and attributes as an object
      const {
        content: codeContent,
        title,
        language,
        type,
      } = getArtifactContentAndAttributes(content);

      // Check if the node exists and create it if not
      const canvasState = useCanvasStore.getState();
      const currentCanvasId = canvasState.currentCanvasId;

      // Skip if no active canvas
      if (!currentCanvasId) return;

      const canvasData = canvasState.data[currentCanvasId];
      const existingNode = canvasData?.nodes?.find(
        (node) => node.data?.entityId === artifact.entityId && node.type === artifact.type,
      );

      // Check if artifact is closed using the ARTIFACT_TAG_CLOSED_REGEX
      const isArtifactClosed = ARTIFACT_TAG_CLOSED_REGEX.test(content);

      // Force status to 'finish' if artifact is closed
      const artifactStatus = isArtifactClosed ? 'finish' : 'generating';

      // If node doesn't exist, create it
      if (!existingNode) {
        addNode(
          {
            type: artifact.type,
            data: {
              // Use extracted title if available, fallback to artifact.title
              title: title || artifact.title,
              entityId: artifact.entityId,
              contentPreview: codeContent, // Set content preview for code artifact
              metadata: {
                status: artifactStatus,
                language: language || 'typescript', // Use extracted language or default
                type: type || '', // Use extracted type if available
                title: title || artifact?.title || '',
                activeTab: isArtifactClosed ? 'preview' : 'code',
              },
            },
          },
          [
            {
              type: 'skillResponse',
              entityId: resultId,
            },
          ],
        );
      } else {
        // Get existing node metadata to check current status
        const currentStatus = existingNode.data?.metadata?.status;

        // Only update if:
        // 1. We're moving from generating -> finish (when artifact is closed)
        // 2. Status is currently undefined
        // 3. We're still in generating state (don't revert from finish to generating)
        const shouldUpdateStatus =
          (isArtifactClosed && currentStatus !== 'finish') ||
          !currentStatus ||
          (currentStatus === 'generating' && artifactStatus === 'finish');

        // Update existing node with new content and attributes
        setNodeDataByEntity(
          {
            type: artifact.type,
            entityId: artifact.entityId,
          },
          {
            // Update title if available from extracted attributes
            ...(title && { title }),
            contentPreview: codeContent, // Always update content preview to keep in sync
            metadata: {
              // Only update status if appropriate based on our logic above
              ...(shouldUpdateStatus && { status: artifactStatus }),
              // Update language and type if available from extracted attributes
              ...(language && { language }),
              ...(type && { type }),
              title: title || artifact?.title || '',
              // Set activeTab to preview if artifact is closed
              ...(isArtifactClosed && { activeTab: 'preview' }),
            },
          },
        );
      }

      // Emit status update event for subscribers (like the CodeArtifactNodePreview component)
      // Only emit if artifact is closed or if it's a new node
      if (isArtifactClosed || !existingNode) {
        codeArtifactEmitter.emit('statusUpdate', {
          artifactId: artifact.entityId,
          status: artifactStatus,
          type: type as CodeArtifactType,
        });
      }

      // Always emit content update
      codeArtifactEmitter.emit('contentUpdate', {
        artifactId: artifact.entityId,
        content: codeContent,
      });
    }
  };

  const onSkillStream = (skillEvent: SkillEvent) => {
    const { resultId, content, reasoningContent = '', step, artifact } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    // Regular stream content handling (non-code artifact)
    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.content += content;

    if (!updatedStep.reasoningContent) {
      updatedStep.reasoningContent = reasoningContent;
    } else {
      updatedStep.reasoningContent += reasoningContent;
    }

    // Handle code artifact content if this is a code artifact stream
    onSkillStreamArtifact(resultId, artifact, updatedStep.content);

    onUpdateResult(
      resultId,
      {
        ...result,
        status: 'executing' as const,
        steps: getUpdatedSteps(result.steps ?? [], updatedStep),
      },
      skillEvent,
    );
  };

  const onSkillStructedData = (skillEvent: SkillEvent) => {
    const { step, resultId, structuredData = {} } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !structuredData || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);

    // Handle chunked sources data
    if (structuredData.sources && Array.isArray(structuredData.sources)) {
      const existingData = updatedStep.structuredData || {};
      const existingSources = (existingData.sources || []) as any[];

      // If this is a chunk of sources, merge it with existing sources
      if (structuredData.isPartial !== undefined) {
        updatedStep.structuredData = {
          ...existingData,
          sources: [...existingSources, ...structuredData.sources],
          isPartial: structuredData.isPartial,
          chunkIndex: structuredData.chunkIndex,
          totalChunks: structuredData.totalChunks,
        };
      } else {
        // Handle non-chunked data as before
        updatedStep.structuredData = {
          ...existingData,
          ...structuredData,
        };
      }
    } else {
      // Handle non-sources structured data
      updatedStep.structuredData = {
        ...updatedStep.structuredData,
        ...structuredData,
      };
    }

    const updatedResult = {
      ...result,
      status: 'executing' as const,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };
    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);
  };

  const onSkillArtifact = (skillEvent: SkillEvent) => {
    const { resultId, artifact, step } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    const existingArtifacts = Array.isArray(updatedStep.artifacts)
      ? [...updatedStep.artifacts]
      : [];
    const artifactIndex = existingArtifacts.findIndex(
      (item) => item?.entityId === artifact?.entityId,
    );

    updatedStep.artifacts =
      artifactIndex !== -1
        ? existingArtifacts.map((item, index) => (index === artifactIndex ? artifact : item))
        : [...existingArtifacts, artifact];

    const updatedResult = {
      ...result,
      status: 'executing' as const,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };

    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);
  };

  const onSkillCreateNode = (skillEvent: SkillEvent) => {
    const { node, resultId } = skillEvent;
    addNode(
      {
        type: node.type,
        data: {
          ...node.data,
          metadata: {
            status: 'executing',
            ...node.data?.metadata,
          },
        } as CanvasNodeData,
      },
      [
        {
          type: 'skillResponse',
          entityId: resultId,
        },
      ],
    );
  };

  const onSkillEnd = (skillEvent: SkillEvent) => {
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[skillEvent.resultId];

    if (!result) {
      return;
    }

    const updatedResult = {
      ...result,
      status: 'finish' as const,
    };
    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);

    // Get all artifacts from all steps
    const artifacts = result.steps?.flatMap((s) => s.artifacts) || [];

    // Force all code artifacts to finish state
    // This is crucial to ensure artifacts don't get stuck in 'generating' state
    for (const artifact of artifacts) {
      if (artifact?.type === 'codeArtifact' && artifact.entityId) {
        // Get canvas state
        const canvasState = useCanvasStore.getState();
        const currentCanvasId = canvasState.currentCanvasId;

        if (currentCanvasId) {
          // Find the node in canvas
          const canvasData = canvasState.data[currentCanvasId];
          const node = canvasData?.nodes?.find(
            (n) => n.data?.entityId === artifact.entityId && n.type === 'codeArtifact',
          );

          // Update node metadata if found
          if (node) {
            // Current node metadata
            const metadata = node.data?.metadata || {};
            const contentPreview = node.data?.contentPreview;
            const currentType = metadata.type || 'application/refly.artifacts.code';

            // Always update to finished status
            setNodeDataByEntity(
              { type: artifact.type, entityId: artifact.entityId },
              {
                metadata: {
                  ...metadata,
                  status: 'finish',
                  activeTab: 'preview',
                },
                // Preserve content preview
                ...(contentPreview && { contentPreview }),
              },
            );

            // Always emit status update
            codeArtifactEmitter.emit('statusUpdate', {
              artifactId: artifact.entityId,
              status: 'finish',
              type: currentType as CodeArtifactType,
            });

            // Update remote artifact
            if (contentPreview) {
              getClient()
                .updateCodeArtifact({
                  body: {
                    artifactId: artifact.entityId,
                    content: contentPreview,
                    type: currentType as CodeArtifactType,
                  },
                })
                .catch((error) => {
                  console.error('Failed to update remote artifact:', error);
                });
            }
          } else {
            // Node not found - just emit finish status with default type
            codeArtifactEmitter.emit('statusUpdate', {
              artifactId: artifact.entityId,
              status: 'finish',
              type: 'application/refly.artifacts.code' as CodeArtifactType,
            });
          }
        }
      }
    }

    refetchUsage();
  };

  const onSkillError = (skillEvent: SkillEvent) => {
    const runtime = getRuntime();
    const { localSettings } = useUserStore.getState();
    const locale = localSettings?.uiLocale as LOCALE;

    const { error, resultId } = skillEvent;
    showErrorNotification(error, locale);

    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) {
      return;
    }

    const updatedResult = {
      ...result,
      status: 'failed' as const,
      errors: [error?.errMsg],
    };
    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);

    if (runtime?.includes('extension')) {
      if (globalIsAbortedRef.current) {
        return;
      }
    } else {
      // if it is aborted, do nothing
      if (globalAbortControllerRef.current?.signal?.aborted) {
        return;
      }
    }

    abortAction(error?.errMsg);
  };

  const abortAction = useCallback(
    (_msg?: string) => {
      try {
        globalAbortControllerRef.current?.abort();
        globalIsAbortedRef.current = true;
      } catch (err) {
        console.log('shutdown error', err);
      }
    },
    [globalAbortControllerRef, globalIsAbortedRef],
  );

  const onCompleted = () => {};
  const onStart = () => {};
  const findThreadHistory = useFindThreadHistory();
  const findMemo = useFindMemo();
  const findWebsite = useFindWebsite();
  const findCodeArtifact = useFindCodeArtifact();
  const findImages = useFindImages();

  const invokeAction = (payload: SkillNodeMeta, target: Entity) => {
    payload.resultId ||= genActionResultID();
    payload.selectedSkill ||= { name: 'commonQnA' };

    const {
      query,
      modelInfo,
      contextItems,
      selectedSkill,
      resultId,
      version = 0,
      tplConfig = {},
      runtimeConfig = {},
    } = payload;
    const { context, resultHistory, images } = convertContextItemsToInvokeParams(
      contextItems,
      (item) =>
        findThreadHistory({ resultId: item.entityId }).map((node) => ({
          title: node.data?.title,
          resultId: node.data?.entityId,
        })),
      (item) => {
        if (item.type === 'memo') {
          return findMemo({ resultId: item.entityId }).map((node) => ({
            content: node.data?.contentPreview ?? '',
            title: node.data?.title ?? 'Memo',
          }));
        }
        return [];
      },
      (item) => {
        if (item.type === 'codeArtifact') {
          return findCodeArtifact({ resultId: item.entityId }).map((node) => ({
            content: node.data?.contentPreview ?? '',
            title: node.data?.title ?? 'Code',
          }));
        }
        return [];
      },
      (item) => {
        if (item.type === 'image') {
          return findImages({ resultId: item.entityId });
        }
        return [];
      },
      (item) => {
        if (item.type === 'website') {
          return findWebsite({ resultId: item.entityId }).map((node) => ({
            url: node.data?.metadata?.url ?? '',
            title: node.data?.title ?? 'Website',
          }));
        }
        return [];
      },
    );

    const param: InvokeSkillRequest = {
      resultId,
      input: {
        query,
        images,
      },
      target,
      modelName: modelInfo?.name,
      context,
      resultHistory,
      skillName: selectedSkill?.name,
      tplConfig,
      runtimeConfig,
    };

    onUpdateResult(resultId, {
      resultId,
      version,
      type: 'skill',
      actionMeta: selectedSkill,
      modelInfo,
      title: query,
      targetId: target?.entityId,
      targetType: target?.entityType,
      context,
      history: resultHistory,
      tplConfig,
      runtimeConfig,
      status: 'waiting',
      steps: [],
      errors: [],
    });

    globalAbortControllerRef.current = new AbortController();

    // Create timeout handler for this action
    const { resetTimeout, cleanup } = createTimeoutHandler(resultId, version);

    // Wrap event handlers to reset timeout
    const wrapEventHandler =
      (handler: (...args: any[]) => void) =>
      (...args: any[]) => {
        resetTimeout();
        handler(...args);
      };

    resetTimeout();

    ssePost({
      controller: globalAbortControllerRef.current,
      payload: param,
      onStart: wrapEventHandler(onStart),
      onSkillStart: wrapEventHandler(onSkillStart),
      onSkillStream: wrapEventHandler(onSkillStream),
      onSkillLog: wrapEventHandler(onSkillLog),
      onSkillArtifact: wrapEventHandler(onSkillArtifact),
      onSkillStructedData: wrapEventHandler(onSkillStructedData),
      onSkillCreateNode: wrapEventHandler(onSkillCreateNode),
      onSkillEnd: wrapEventHandler(onSkillEnd),
      onCompleted: wrapEventHandler(onCompleted),
      onSkillError: wrapEventHandler(onSkillError),
      onSkillTokenUsage: wrapEventHandler(onSkillTokenUsage),
    });

    return cleanup;
  };

  return { invokeAction, abortAction };
};
