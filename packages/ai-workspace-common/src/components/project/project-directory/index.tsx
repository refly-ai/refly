import { useSiderStoreShallow } from '@refly/stores';
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

  const { data: projectDetail } = useGetProjectDetail({ query: { projectId } }, undefined, {
    enabled: !!projectId,
  });
  const data = projectDetail?.data;
  const [projectData, setProjectData] = useState(data);

  const handleRemoveCanvases = useCallback(
    async (canvasIds: string[]) => {
      if (!canvasId) return;

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

  return (
    <Layout.Sider
      width={source === 'sider' ? (collapse ? 0 : 248) : 248}
      className={cn(
        'border border-solid border-gray-100 bg-white shadow-sm relative dark:border-gray-800 dark:bg-gray-900',
        source === 'sider' ? '' : 'rounded-r-lg',
      )}
      style={{
        height: source === 'sider' ? 'var(--screen-height)' : 'calc(var(--screen-height) - 16px)',
      }}
    >
      <div className="project-directory flex h-full flex-col py-3 pb-0 overflow-y-auto overflow-x-hidden">
        {projectData && (
          <ProjectSettings
            source={source}
            setCollapse={setCollapse}
            data={projectData}
            onUpdate={(data) => {
              setProjectData({ ...projectData, ...data });
            }}
          />
        )}

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
          onAddCanvasesSuccess={handleAddCanvases as any}
          onRemoveCanvases={handleRemoveCanvases}
        />
        <SourcesMenu
          isFetching={loadingSource}
          sourceList={sourceList as any}
          projectId={projectId}
          documentCount={
            sourceList.filter((item: any) => item.entityType === 'document').length || 0
          }
          resourceCount={
            sourceList.filter((item: any) => item.entityType === 'resource').length || 0
          }
          onUpdatedItems={() => {
            getSourceList();
          }}
        />
      </div>
    </Layout.Sider>
  );
};
