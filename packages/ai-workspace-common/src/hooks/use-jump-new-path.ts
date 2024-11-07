import { useNavigationContextStoreShallow } from '@refly-packages/ai-workspace-common/stores/navigation-context';
import { NavigationContext } from '@refly-packages/ai-workspace-common/types/copilot';
import { useNavigate, useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';
import { useConversationStoreShallow } from '@refly-packages/ai-workspace-common/stores/conversation';

export const useJumpNewPath = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setNavigationContext } = useNavigationContextStoreShallow((state) => ({
    setNavigationContext: state.setNavigationContext,
  }));

  const conversationStore = useConversationStoreShallow((state) => ({
    resetState: state.resetState,
  }));

  const jumpToCanvas = ({
    canvasId,
    projectId,
    baseUrl = '',
    openNewTab = false,
  }: {
    canvasId: string;
    projectId: string;
    baseUrl?: string;
    openNewTab?: boolean;
  }) => {
    for (const key of Array.from(searchParams.keys())) {
      if (['resId', 'canvasId'].includes(key)) {
        searchParams.delete(key);
      }
    }
    searchParams.set('canvasId', canvasId);
    setSearchParams(searchParams);
    const url = `${baseUrl}/project/${projectId}?${searchParams.toString()}`;

    if (openNewTab) {
      window.open(url, '_blank');
    } else {
      navigate(url);
    }
  };

  const jumpToProject = (
    {
      projectId,
      baseUrl = '',
      openNewTab = false,
      onlySetParams = false,
    }: {
      projectId: string;
      baseUrl?: string;
      openNewTab?: boolean;
      onlySetParams?: boolean;
    },
    extraQuery?: Record<string, string>,
  ) => {
    for (const key of Array.from(searchParams.keys())) {
      if (['resId', 'canvasId'].includes(key)) {
        searchParams.delete(key);
      }
    }

    if (extraQuery) {
      Object.entries(extraQuery).forEach(([key, value]) => {
        if (!['canvasId', 'resId', 'convId'].includes(key)) {
          return;
        }
        searchParams.set(key, value);
      });
    }

    setSearchParams(searchParams);

    if (onlySetParams) {
      return;
    }

    const url = `${baseUrl}/project/${projectId}?${searchParams.toString()}`;

    if (openNewTab) {
      window.open(url, '_blank');
    } else {
      navigate(url);
    }
  };

  const jumpToProjectResource = ({
    projectId,
    resId = '',
    baseUrl = '',
    openNewTab = false,
  }: {
    projectId: string;
    resId: string;
    baseUrl?: string;
    openNewTab?: boolean;
  }) => {
    searchParams.set('resId', resId);
    searchParams.delete('canvasId'); // either resId or canvasId can be displayed
    setSearchParams(searchParams);
    const url = `${baseUrl}/project/${projectId}?${searchParams.toString()}`;

    if (openNewTab) {
      window.open(url, '_blank');
    } else {
      navigate(url);
    }
  };

  const jumpToSoloResource = ({
    resId,
    baseUrl = '',
    openNewTab = false,
  }: {
    resId: string;
    baseUrl?: string;
    openNewTab?: boolean;
  }) => {
    const url = `${baseUrl}/resource/${resId}?${searchParams.toString()}`;

    if (openNewTab) {
      window.open(url, '_blank');
    } else {
      navigate(url);
    }
  };

  const jumpToResource = ({
    resId,
    projectId,
    baseUrl = '',
    openNewTab = false,
  }: {
    resId: string;
    projectId?: string;
    baseUrl?: string;
    openNewTab?: boolean;
  }) => {
    if (projectId) {
      jumpToProjectResource({ projectId, resId, baseUrl, openNewTab });
    } else {
      jumpToSoloResource({ resId, baseUrl, openNewTab });
    }
  };

  const jumpToConv = ({
    convId,
    projectId,
    canvasId,
    resourceId,
    baseUrl = '',
    openNewTab = false,
    state,
  }: {
    convId: string;
    projectId?: string;
    canvasId?: string;
    resourceId?: string;
    baseUrl?: string;
    openNewTab?: boolean;
    state: { navigationContext?: NavigationContext };
  }) => {
    if (state.navigationContext?.clearSearchParams) {
      for (const key of Array.from(searchParams.keys())) {
        searchParams.delete(key);
      }
    }

    let url: string;

    if (projectId) {
      convId ? searchParams.set('convId', convId) : searchParams.delete('convId');
      if (canvasId) {
        searchParams.set('canvasId', canvasId);
      }
      setSearchParams(searchParams);
      url = `${baseUrl}/project/${projectId}?${searchParams.toString()}`;
    } else if (resourceId) {
      convId ? searchParams.set('convId', convId) : searchParams.delete('convId');
      setSearchParams(searchParams);
      url = `${baseUrl}/resource/${resourceId}?${searchParams.toString()}`;
    } else {
      url = `${baseUrl}/thread/${convId}`;
    }

    if (!convId) {
      conversationStore.resetState();
    }

    if (openNewTab) {
      window.open(url, '_blank');
    } else {
      navigate(url);
      setNavigationContext(state.navigationContext);
    }
  };

  return {
    jumpToCanvas,
    jumpToProject,
    jumpToResource,
    jumpToConv,
  };
};
