import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { Dropdown, Button, Popconfirm, message, Empty, Divider, Typography, Image } from 'antd';
import InfiniteScroll from 'react-infinite-scroll-component';
import {
  Spinner,
  EndMessage,
} from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import type { MenuProps, DropdownProps } from 'antd';
import {
  IconMoreHorizontal,
  IconDelete,
  IconProject,
  IconPlus,
  IconEdit,
} from '@refly-packages/ai-workspace-common/components/common/icon';

import { useEffect, useState, useMemo, useCallback } from 'react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { LOCALE } from '@refly/common-types';
import { useTranslation } from 'react-i18next';

import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { Project } from '@refly/openapi-schema';
import { CreateProjectModal } from '@refly-packages/ai-workspace-common/components/project/project-create';
import { useNavigate } from 'react-router-dom';

const ActionDropdown = ({
  project,
  afterDelete,
  setEditProjectModalVisible,
}: {
  project: Project;
  afterDelete: () => void;
  setEditProjectModalVisible: (visible: boolean) => void;
}) => {
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await getClient().deleteProject({
      body: {
        projectId: project.projectId,
      },
    });
    if (res?.data?.success) {
      message.success(t('project.action.deleteSuccess'));
      afterDelete?.();
    }
  };

  const handleEdit = () => {
    console.log('handleEdit');
    setEditProjectModalVisible(true);
  };

  const items: MenuProps['items'] = [
    {
      label: (
        <div className="flex items-center flex-grow">
          <IconEdit size={16} className="mr-2" />
          {t('workspace.deleteDropdownMenu.edit')}
        </div>
      ),
      key: 'edit',
      onClick: handleEdit,
    },
    {
      label: (
        <Popconfirm
          placement="bottomLeft"
          title={t('project.action.deleteConfirm', {
            name: project.name || t('common.untitled'),
          })}
          onConfirm={handleDelete}
          onCancel={(e?: React.MouseEvent) => {
            e?.stopPropagation();
            setPopupVisible(false);
          }}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          overlayStyle={{ maxWidth: '300px' }}
        >
          <div
            className="flex items-center text-red-600 flex-grow"
            onClick={(e) => e.stopPropagation()}
          >
            <IconDelete size={16} className="mr-2" />
            {t('workspace.deleteDropdownMenu.delete')}
          </div>
        </Popconfirm>
      ),
      key: 'delete',
    },
  ];

  const handleOpenChange: DropdownProps['onOpenChange'] = (open: boolean, info: any) => {
    if (info.source === 'trigger') {
      setPopupVisible(open);
    }
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <Dropdown
        trigger={['click']}
        open={popupVisible}
        onOpenChange={handleOpenChange}
        menu={{ items }}
      >
        <Button
          type="text"
          icon={<IconMoreHorizontal />}
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      </Dropdown>
    </div>
  );
};

const ProjectCard = ({
  project,
  onDelete,
  reload,
  handleClick,
}: {
  project: Project;
  onDelete: () => void;
  reload: () => void;
  handleClick: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n.languages?.[0];
  const [editProjectModalVisible, setEditProjectModalVisible] = useState(false);

  return (
    <div
      className="bg-white rounded-lg overflow-hidden border border-solid cursor-pointer border-gray-200 hover:border-green-500 transition-colors duration-200"
      onClick={handleClick}
    >
      <div className="h-36 px-4 py-3 overflow-hidden">
        {project.coverUrl && (
          <Image src={project.coverUrl} alt={project.name || t('common.untitled')} />
        )}
      </div>
      <Divider className="m-0 text-gray-200" />
      <div className="px-3 pt-2 pb-1 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-3 mb-2">
          <IconProject color="#6172F3" size={22} />
          <div className="flex-1 min-w-0">
            <Typography.Text className="text-sm font-medium w-48" ellipsis={{ tooltip: true }}>
              {project.name || t('common.untitled')}
            </Typography.Text>
            <p className="text-xs text-gray-500">
              {time(project.updatedAt, language as LOCALE)
                .utc()
                .fromNow()}
            </p>
          </div>
        </div>

        <ActionDropdown
          project={project}
          afterDelete={onDelete}
          setEditProjectModalVisible={setEditProjectModalVisible}
        />
      </div>

      <CreateProjectModal
        mode="edit"
        projectId={project.projectId}
        title={project.name}
        description={project.description}
        instructions={project.customInstructions}
        coverPicture={project.coverUrl}
        visible={editProjectModalVisible}
        setVisible={setEditProjectModalVisible}
        onSuccess={() => {
          reload();
        }}
      />
    </div>
  );
};

const ProjectList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [createProjectModalVisible, setCreateProjectModalVisible] = useState(false);
  const { showLibraryModal, setShowLibraryModal } = useSiderStoreShallow((state) => ({
    showLibraryModal: state.showLibraryModal,
    setShowLibraryModal: state.setShowLibraryModal,
  }));

  const { dataList, loadMore, reload, hasMore, isRequesting, setDataList } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listProjects({
        query: queryPayload,
      });
      return res?.data;
    },
    pageSize: 12,
  });

  const getProjectDetail = async (projectId: string) => {
    const res = await getClient().getProjectDetail({
      query: { projectId },
    });
    return res?.data?.data;
  };

  const handleCardClick = async (project: Project) => {
    const projectDetail = await getProjectDetail(project.projectId);
    const canvasId = projectDetail?.canvases?.[0]?.canvasId || 'empty';
    setShowLibraryModal(false);
    navigate(`/project/${project.projectId}?canvasId=${canvasId}`);
  };

  const projectCards = useMemo(() => {
    return dataList?.map((item) => (
      <ProjectCard
        key={item.projectId}
        project={item}
        onDelete={() => setDataList(dataList.filter((n) => n.projectId !== item.projectId))}
        reload={reload}
        handleClick={() => handleCardClick(item)}
      />
    ));
  }, [dataList, setDataList]);

  const handleLoadMore = useCallback(() => {
    if (!isRequesting && hasMore) {
      loadMore();
    }
  }, [isRequesting, hasMore, loadMore]);

  useEffect(() => {
    if (showLibraryModal) {
      reload();
    } else {
      setDataList([]);
    }
  }, [showLibraryModal]);

  const emptyState = (
    <div className="h-full flex items-center justify-center">
      <Empty description={t('common.empty')}>
        <Button
          className="text-[#00968F]"
          icon={<IconPlus className="-mr-1 flex items-center justify-center" />}
          onClick={() => {
            setCreateProjectModalVisible(true);
          }}
        >
          {t('project.create')}
        </Button>
      </Empty>
      <CreateProjectModal
        visible={createProjectModalVisible}
        setVisible={setCreateProjectModalVisible}
        onSuccess={() => {
          reload();
        }}
      />
    </div>
  );

  return (
    <Spin className="w-full h-full" spinning={isRequesting && dataList.length === 0}>
      <div id="resourceScrollableDiv" className="w-full h-[calc(60vh-60px)] overflow-y-auto">
        {dataList.length > 0 ? (
          <InfiniteScroll
            dataLength={dataList.length}
            next={handleLoadMore}
            hasMore={hasMore}
            loader={<Spinner />}
            endMessage={<EndMessage />}
            scrollableTarget="resourceScrollableDiv"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {projectCards}
            </div>
          </InfiniteScroll>
        ) : (
          !isRequesting && emptyState
        )}
      </div>
    </Spin>
  );
};

export { ProjectList };
