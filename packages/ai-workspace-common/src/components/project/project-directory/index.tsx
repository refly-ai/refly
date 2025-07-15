import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { Divider, Layout } from 'antd';
import { useState, useEffect, useCallback } from 'react';
import { useGetProjectDetail } from '@refly-packages/ai-workspace-common/queries';
import { Document, Resource } from '@refly/openapi-schema';
import { CanvasMenu } from '@refly-packages/ai-workspace-common/components/project/canvas-menu';
import { SourcesMenu } from '@refly-packages/ai-workspace-common/components/project/source-menu';
import { ProjectSettings } from '@refly-packages/ai-workspace-common/components/project/project-settings';
import cn from 'classnames';
import './index.scss';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useNavigate } from 'react-router-dom';
import { ProjectKnowledgeToggle } from '@refly-packages/ai-workspace-common/components/project/project-knowledge-toggle';
import { useProjectSelectorStoreShallow } from '@refly-packages/ai-workspace-common/stores/project-selector';
import {
  useCanvasStore,
  useCanvasStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/canvas';
import { IconHome } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';

export const iconClassName =
  'w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center hover:text-gray-700';

export type sourceObject =
  | ({
      entityType: 'document';
      entityId: string;
    } & Document)
  | ({
      entityType: 'resource';
      entityId: string;
    } & Resource);

interface ProjectDirectoryProps {
  projectId: string;
  source: 'sider' | 'popover';
}

export const ProjectDirectory = ({ projectId, source }: ProjectDirectoryProps) => {
  const {
    getCanvasList,
    updateCanvasList,
    isLoadingCanvas,
    sourceList,
    loadingSource,
    getSourceList,
  } = useHandleSiderData(true);
  const { t } = useTranslation();
  const { canvasId } = useGetProjectCanvasId();
  const navigate = useNavigate();
  const { collapse, setCollapse, canvasList } = useSiderStoreShallow((state) => ({
    canvasList: state.canvasList,
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  const { setShowLinearThread } = useCanvasStoreShallow((state) => ({
    setShowLinearThread: state.setShowLinearThread,
  }));

  const { data: projectDetail } = useGetProjectDetail({ query: { projectId } }, null, {
    enabled: !!projectId,
  });
  const data = projectDetail?.data;
  const [projectData, setProjectData] = useState(data);

  // Update global store when project ID changes
  const { setSelectedProjectId } = useProjectSelectorStoreShallow((state) => ({
    setSelectedProjectId: state.setSelectedProjectId,
  }));

  // Internal project ID state - initialized from props
  const [internalProjectId, setInternalProjectId] = useState(projectId);

  const handleRemoveCanvases = useCallback(
    async (canvasIds: string[]) => {
      const newCanvasList = canvasList.filter((item) => !canvasIds.includes(item.id));
      updateCanvasList(newCanvasList);
      if (canvasIds.includes(canvasId)) {
        const newCanvasId = newCanvasList.length > 0 ? newCanvasList[0].id : 'empty';
        navigate(`/project/${projectId}?canvasId=${newCanvasId}`);
      }
    },
    [updateCanvasList, canvasId, canvasList, navigate, projectId],
  );

  const handleAddCanvases = useCallback(
    async (canvasIds: string[]) => {
      getCanvasList(true);
      if (canvasIds?.[0]) {
        navigate(`/project/${projectId}?canvasId=${canvasIds[0]}`);
      }
    },
    [getCanvasList, navigate, projectId],
  );

  useEffect(() => {
    setProjectData(data);
  }, [data]);

  useEffect(() => {
    getCanvasList(true);
    getSourceList();
  }, [projectId]);

  // Update internal state when prop changes
  useEffect(() => {
    if (projectId !== internalProjectId) {
      setInternalProjectId(projectId);
    }
  }, [projectId]);

  // Update global store when project ID changes
  useEffect(() => {
    if (internalProjectId) {
      setSelectedProjectId(internalProjectId);
    }
  }, [internalProjectId, setSelectedProjectId]);

  // Handle project change from knowledge toggle
  const handleProjectChange = useCallback(
    (newProjectId: string) => {
      if (newProjectId === internalProjectId) return;

      setInternalProjectId(newProjectId);
      navigate(`/project/${newProjectId}`);
    },
    [internalProjectId, navigate],
  );

  const handleSwitchChange = useCallback(
    (checked: boolean) => {
      const { config, showLinearThread } = useCanvasStore.getState();
      const hasNodePreviews =
        config?.[canvasId]?.nodePreviews?.filter((item) => item?.type === 'skillResponse')?.length >
        0;

      if (checked) {
        if (!showLinearThread && !hasNodePreviews) {
          setShowLinearThread(true);
        }
      }
    },
    [canvasId],
  );

  return (
    <Layout.Sider
      width={source === 'sider' ? (collapse ? 0 : 248) : 248}
      className={cn(
        'border border-solid border-gray-100 bg-white shadow-sm relative dark:border-gray-800 dark:bg-gray-900',
        source === 'sider' ? 'h-[calc(100vh)]' : 'h-[calc(100vh-100px)] rounded-r-lg',
      )}
    >
      <div className="project-directory flex h-full flex-col py-3 pb-0 overflow-y-auto overflow-x-hidden">
        <ProjectSettings
          source={source}
          setCollapse={setCollapse}
          data={projectData}
          onUpdate={(data) => {
            setProjectData({ ...projectData, ...data });
          }}
        />

        <Divider className="my-2" />
        <div
          className={cn(
            'h-[38px] py-2 px-3 flex items-center justify-between text-gray-600 hover:bg-gray-50 cursor-pointer dark:hover:bg-gray-800 dark:text-gray-300',
            {
              'bg-gray-100 font-medium dark:bg-gray-800': !canvasId || canvasId === 'empty',
            },
          )}
          onClick={() => navigate(`/project/${projectId}`)}
        >
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2">
              <IconHome key="home" style={{ fontSize: 20 }} />
              <span>{t('loggedHomePage.siderMenu.home')}</span>
            </div>
          </div>
        </div>

        <CanvasMenu
          isFetching={isLoadingCanvas}
          canvasList={canvasList}
          projectId={projectId}
          onAddCanvasesSuccess={handleAddCanvases}
          onRemoveCanvases={handleRemoveCanvases}
        />
        <SourcesMenu
          isFetching={loadingSource}
          sourceList={sourceList}
          projectId={projectId}
          documentCount={sourceList.filter((item) => item.entityType === 'document').length || 0}
          resourceCount={sourceList.filter((item) => item.entityType === 'resource').length || 0}
          onUpdatedItems={() => {
            getSourceList();
          }}
        />

        {/* Combined Project Knowledge Base Toggle */}
        {internalProjectId ? (
          <ProjectKnowledgeToggle
            currentProjectId={internalProjectId}
            projectSelectorClassName="max-w-[80px]"
            enableSelectProject={false}
            className="px-3"
            enableProjectSelector={false}
            onProjectChange={handleProjectChange}
            onSwitchChange={handleSwitchChange}
          />
        ) : null}
      </div>
    </Layout.Sider>
  );
};
