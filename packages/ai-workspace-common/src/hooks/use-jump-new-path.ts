import { useNavigationContextStoreShallow } from '@refly-packages/ai-workspace-common/stores/navigation-context';
import { NavigationContext } from '@refly-packages/ai-workspace-common/types/copilot';
import { useNavigate, useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';

export const useJumpNewPath = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setNavigationContext } = useNavigationContextStoreShallow((state) => ({
    setNavigationContext: state.setNavigationContext,
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
    searchParams.set('canvasId', canvasId);
    searchParams.delete('resId'); // either canvasId or resId can be displayed
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
    if (extraQuery) {
      for (const [key, value] of Object.entries(extraQuery)) {
        if (!['canvasId', 'resId', 'convId'].includes(key)) {
          continue;
        }
        searchParams.set(key, value);
      }
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
    const url = `${baseUrl}/resource/${resId}`;

    if (openNewTab) {
      window.open(url, '_blank');
    } else {
      navigate(url);
      // if (!knowledgeBaseStore.resourcePanelVisible) {
      //   knowledgeBaseStore.updateResourcePanelVisible(true);
      // }
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

  const removeKbAndResId = ({ baseUrl = '' }: { baseUrl?: string }) => {
    searchParams.delete('kbId');
    searchParams.delete('resId');
    setSearchParams(searchParams);
    navigate(`${baseUrl}/knowledge-base?${searchParams.toString()}`);
  };

  const removeNoteId = ({ baseUrl = '' }: { baseUrl?: string }) => {
    searchParams.delete('noteId');
    setSearchParams(searchParams);
    navigate(`${baseUrl}/knowledge-base?${searchParams.toString()}`);
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
    let url: string;

    if (projectId) {
      searchParams.set('convId', convId);
      if (canvasId) {
        searchParams.set('canvasId', canvasId);
      }
      setSearchParams(searchParams);
      url = `${baseUrl}/project/${projectId}?${searchParams.toString()}`;
    } else if (resourceId) {
      searchParams.set('convId', convId);
      setSearchParams(searchParams);
      url = `${baseUrl}/resource/${resourceId}?${searchParams.toString()}`;
    } else {
      url = `${baseUrl}/thread/${convId}`;
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
    removeKbAndResId,
    removeNoteId,
  };
};
