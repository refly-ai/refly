import { useMatch, useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';
import { useKnowledgeBaseStore } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useEffect, useRef } from 'react';
import {
  onMessage,
  sendMessage,
} from '@refly-packages/ai-workspace-common/utils/extension/messaging';
import { useJumpNewPath } from '@refly-packages/ai-workspace-common/hooks/use-jump-new-path';
import { getRuntime } from '@refly/utils/env';
import { BackgroundMessage } from '@refly/common-types';
import { useCopilotStore } from '@refly-packages/ai-workspace-common/stores/copilot';

export const useMockInAppResource = () => {
  const messageListenerEventRef = useRef<any>();
  const copilotStore = useCopilotStore((state) => ({
    isCopilotOpen: state.isCopilotOpen,
  }));
  const knowledgeBaseStore = useKnowledgeBaseStore((state) => ({
    updateResource: state.updateResource,
    currentResource: state.currentResource,
  }));
  const [searchParams, _setSearchParams] = useSearchParams();
  const { jumpToResource } = useJumpNewPath();

  const kbId = searchParams.get('kbId');
  const resId = searchParams.get('resId');
  const _isKbPage = useMatch('/knowledge-base');
  const isHomepage = useMatch('/');
  /**
   * 在这之前，已经在初始
   */
  const _handleFakeKBRouteJump = () => {
    jumpToResource({
      resId: 'tempResId',
    });
  };

  const onMessageHandler = (event: MessageEvent<any>) => {
    const data = event as any as BackgroundMessage;
    const { name } = data || {};

    if (name === 'currentMockResource' && data?.type === 'syncInfo') {
      const { currentMockResource } = data.body;
      if (currentMockResource) {
        knowledgeBaseStore.updateResource(currentMockResource);
      }
    }
  };

  // 初始状态，直接构造虚构的 kbId 和 resId
  useEffect(() => {
    if (!resId && !kbId && isHomepage && knowledgeBaseStore?.currentResource) {
      // handleFakeKBRouteJump();
    }
  }, [resId, kbId, knowledgeBaseStore.currentResource]);

  const initMessageListener = () => {
    onMessage(onMessageHandler, getRuntime()).then((clearEvent) => {
      messageListenerEventRef.current = clearEvent;
    });

    return () => {
      messageListenerEventRef.current?.();
    };
  };

  // after every copilot status change, send reflyStatusCheck message
  useEffect(() => {
    if (copilotStore.isCopilotOpen) {
      sendMessage({
        name: 'reflyStatusCheck',
        type: 'others',
        source: getRuntime(),
      });
    }
  }, [copilotStore.isCopilotOpen]);
  // when init, send reflyStatusCheck message
  useEffect(() => {
    sendMessage({
      name: 'reflyStatusCheck',
      type: 'others',
      source: getRuntime(),
    });
  }, []);

  return {
    initMessageListener,
  };
};
