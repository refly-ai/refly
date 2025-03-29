import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { Divider, Layout } from 'antd';
import { useState, useMemo, useEffect } from 'react';
import { useGetProjectDetail } from '@refly-packages/ai-workspace-common/queries';
import { Document, Resource } from '@refly/openapi-schema';
import { CanvasMenu } from '@refly-packages/ai-workspace-common/components/project/canvas-menu';
import { SourcesMenu } from '@refly-packages/ai-workspace-common/components/project/source-menu';
import { ProjectSettings } from '@refly-packages/ai-workspace-common/components/project/project-settings';
import cn from 'classnames';
import './index.scss';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';

export const iconClassName = 'w-4 h-4 flex items-center justify-center';
export interface sourceObject extends Document, Resource {
  entityType: 'document' | 'resource';
  entityId: string;
}

interface ProjectDirectoryProps {
  projectId: string;
  source: 'sider' | 'popover';
}

export const ProjectDirectory = ({ projectId, source }: ProjectDirectoryProps) => {
  const { getCanvasList } = useHandleSiderData(true);
  const { collapse, setCollapse, canvasList } = useSiderStoreShallow((state) => ({
    canvasList: state.canvasList,
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  const {
    data: projectDetail,
    refetch,
    isFetching,
  } = useGetProjectDetail({ query: { projectId } }, null, {
    enabled: !!projectId,
  });
  const data = projectDetail?.data;
  const [projectData, setProjectData] = useState(data);

  const documents = data?.documents || [];
  const resources = data?.resources || [];

  const mergedSources = useMemo(() => {
    const docs = (documents || []).map((item) => ({
      ...item,
      entityId: item.docId,
      entityType: 'document',
    }));
    const res = (resources || []).map((item) => ({
      ...item,
      entityId: item.resourceId,
      entityType: 'resource',
    }));

    const merged = [...docs, ...res];

    return merged.sort((a, b) => {
      const dateA = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [documents, resources]);

  useEffect(() => {
    setProjectData(data);
  }, [data]);

  return (
    <Layout.Sider
      width={source === 'sider' ? (collapse ? 0 : 220) : 220}
      className={cn(
        'border border-solid border-gray-100 bg-white shadow-sm',
        source === 'sider' ? 'h-[calc(100vh)]' : 'h-[calc(100vh-100px)] rounded-r-lg',
      )}
    >
      <div className="project-directory flex h-full flex-col py-3 overflow-y-auto">
        <ProjectSettings
          source={source}
          setCollapse={setCollapse}
          data={projectData}
          onUpdate={(data) => {
            console.log('data', data);
            setProjectData({ ...projectData, ...data });
          }}
        />

        <Divider className="my-2" />

        <CanvasMenu
          canvasList={canvasList}
          projectId={projectId}
          onUpdatedCanvasList={() => {
            getCanvasList();
          }}
        />
        <SourcesMenu
          isFetching={isFetching}
          sourceList={mergedSources as sourceObject[]}
          projectId={projectId}
          documentCount={documents?.length || 0}
          resourceCount={resources?.length || 0}
          onUpdatedItems={() => {
            refetch();
          }}
        />
      </div>
    </Layout.Sider>
  );
};
