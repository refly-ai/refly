import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFrontPageStoreShallow } from '../stores/front-page';
import { genActionResultID } from '@refly/utils/id';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { useCanvasContext } from '../context/canvas';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { usePilotStoreShallow } from '@refly-packages/ai-workspace-common/stores/pilot';
import {
  CreatePilotSessionRequest,
  ModelInfo,
  Skill,
  SkillRuntimeConfig,
  SkillTemplateConfig,
} from '@refly/openapi-schema';
import { message } from 'antd';

export const useCanvasInitialActions = (canvasId: string) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addNode } = useAddNode();
  const { invokeAction } = useInvokeAction();
  const { query, selectedSkill, runtimeConfig, tplConfig, reset } = useFrontPageStoreShallow(
    (state) => ({
      query: state.query,
      selectedSkill: state.selectedSkill,
      runtimeConfig: state.runtimeConfig,
      tplConfig: state.tplConfig,
      reset: state.reset,
    }),
  );

  const { skillSelectedModel } = useChatStoreShallow((state) => ({
    skillSelectedModel: state.skillSelectedModel,
  }));
  const { setActiveSessionId, setIsPilotOpen } = usePilotStoreShallow((state) => ({
    setActiveSessionId: state.setActiveSessionId,
    setIsPilotOpen: state.setIsPilotOpen,
  }));

  // Get canvas provider to check connection status
  const { provider } = useCanvasContext();
  const [isConnected, setIsConnected] = useState(false);

  // Store the required data to execute actions after connection
  const pendingActionRef = useRef<{
    source: string | null;
    query: string;
    selectedSkill: Skill;
    modelInfo: ModelInfo;
    tplConfig: SkillTemplateConfig;
    runtimeConfig: SkillRuntimeConfig;
    isPilotActivated?: boolean;
  } | null>(null);

  // Update connection status when provider status changes
  useEffect(() => {
    if (!provider) return;

    const handleStatus = ({ status }: { status: string }) => {
      setIsConnected(status === 'connected');
    };

    // Check initial status
    setIsConnected(provider.status === 'connected');

    // Listen for status changes
    provider.on('status', handleStatus);

    return () => {
      provider.off('status', handleStatus);
    };
  }, [provider]);

  // Store parameters needed for actions when URL parameters are processed
  useEffect(() => {
    const source = searchParams.get('source');
    const isPilotActivated = Boolean(searchParams.get('isPilotActivated'));
    const newParams = new URLSearchParams();

    // Copy all params except 'source'
    for (const [key, value] of searchParams.entries()) {
      if (!['source', 'isPilotActivated'].includes(key)) {
        newParams.append(key, value);
      }
    }
    setSearchParams(newParams);

    // Store the data if we need to execute actions
    if (source === 'front-page' && query?.trim() && canvasId) {
      pendingActionRef.current = {
        source,
        query,
        selectedSkill,
        modelInfo: skillSelectedModel,
        tplConfig,
        runtimeConfig,
        isPilotActivated,
      };
    }
  }, [canvasId, query, selectedSkill, searchParams, skillSelectedModel, tplConfig, runtimeConfig]);

  const handleCreatePilotSession = useCallback(async (param: CreatePilotSessionRequest) => {
    const { data, error } = await getClient().createPilotSession({
      body: param,
    });
    if (error) {
      message.error('Failed to create pilot session');
      return;
    }

    if (data.data?.sessionId) {
      setActiveSessionId(data.data?.sessionId);
      setIsPilotOpen(true);
    } else {
      message.error('Failed to create pilot session');
    }
  }, []);

  // Execute the actions once connected
  useEffect(() => {
    // Only proceed if we're connected and have pending actions
    if (isConnected && pendingActionRef.current && canvasId) {
      const { query, selectedSkill, modelInfo, tplConfig, runtimeConfig, isPilotActivated } =
        pendingActionRef.current;

      if (isPilotActivated) {
        handleCreatePilotSession({
          targetId: canvasId,
          targetType: 'canvas',
          title: query,
          input: { query },
          maxEpoch: 3,
          // providerItemId: modelInfo.providerItemId,
        });
        pendingActionRef.current = null;

        return;
      }

      const resultId = genActionResultID();
      invokeAction(
        {
          query,
          resultId,
          selectedSkill,
          modelInfo,
          tplConfig,
          runtimeConfig,
        },
        {
          entityId: canvasId,
          entityType: 'canvas',
        },
      );
      addNode({
        type: 'skillResponse',
        data: {
          title: query,
          entityId: resultId,
          metadata: {
            status: 'executing',
            selectedSkill,
            modelInfo,
            runtimeConfig,
            tplConfig,
            structuredData: {
              query,
            },
          },
        },
      });

      reset();

      // Clear pending action
      pendingActionRef.current = null;
    }
  }, [canvasId, isConnected, invokeAction, addNode, reset]);
};
