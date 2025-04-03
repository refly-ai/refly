import { Project } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Tooltip, Typography } from 'antd';
import { IconLeft, IconEdit } from '@refly-packages/ai-workspace-common/components/common/icon';
import { iconClassName } from '@refly-packages/ai-workspace-common/components/project/project-directory';
import cn from 'classnames';
import { useState } from 'react';
import { AiOutlineMenuFold } from 'react-icons/ai';
import { CreateProjectModal } from '@refly-packages/ai-workspace-common/components/project/project-create';
import { ActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/project-list';
import { IconRight } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { SlPicture } from 'react-icons/sl';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';

const { Paragraph } = Typography;
export const ProjectSettings = ({
  source,
  setCollapse,
  data,
  onUpdate,
}: {
  source: 'sider' | 'popover';
  setCollapse: (collapse: boolean) => void;
  data: Project;
  onUpdate: (data: Project) => void;
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [createProjectModalVisible, setCreateProjectModalVisible] = useState(false);
  const { setShowLibraryModal } = useSiderStoreShallow((state) => ({
    setShowLibraryModal: state.setShowLibraryModal,
  }));
  const { projectId, canvasId } = useGetProjectCanvasId();

  const { debouncedCreateCanvas } = useCreateCanvas({
    projectId: projectId,
    afterCreateSuccess: () => {
      setShowLibraryModal(true);
    },
  });

  const handleEditSettings = () => {
    setCreateProjectModalVisible(true);
  };

  return (
    <div className="px-3">
      <div className="flex justify-between items-center">
        <Button
          className="px-1 gap-1 text-sm text-gray-500"
          size="small"
          type="text"
          icon={<IconLeft className={iconClassName} />}
          onClick={() => navigate('/')}
        >
          {t('common.goBack')}
        </Button>
        <div className="flex items-center gap-2">
          <ActionDropdown
            project={data}
            afterDelete={() => {
              navigate('/', { replace: true });
            }}
            setEditProjectModalVisible={setCreateProjectModalVisible}
          />
          {source === 'sider' && (
            <Button
              type="text"
              size="small"
              icon={<AiOutlineMenuFold className={cn(iconClassName, 'text-gray-500')} />}
              onClick={() => setCollapse(true)}
            />
          )}
        </div>
      </div>

      <div className="pt-5 cursor-pointer" onClick={handleEditSettings}>
        <div className="flex items-center gap-3">
          {data?.coverUrl ? (
            <img src={data?.coverUrl} alt="Refly" className="w-10 h-10 rounded-md" />
          ) : (
            <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center">
              <SlPicture size={24} className="text-gray-500" />
            </div>
          )}

          <div className="flex flex-col">
            <span className="text-sm">{data?.name || t('common.untitled')}</span>
          </div>
          <Tooltip title={t('project.viewAllProjects')}>
            <Button
              type="text"
              size="small"
              icon={<IconRight className={cn(iconClassName, 'text-gray-500')} />}
              onClick={(e) => {
                e.stopPropagation();
                if (canvasId && canvasId !== 'empty') {
                  setShowLibraryModal(true);
                } else {
                  debouncedCreateCanvas();
                }
              }}
            />
          </Tooltip>
        </div>

        <Paragraph
          className="text-xs p-1 !my-2 bg-gray-50 text-gray-400 rounded-md"
          ellipsis={{ rows: 1, tooltip: { placement: 'right' } }}
        >
          {data?.description || t('project.noDescription')}
        </Paragraph>

        <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
          <span>{t('project.customInstructions')}</span>
          <Button
            type="text"
            size="small"
            icon={<IconEdit className={cn(iconClassName, 'text-gray-500')} />}
          />
        </div>
        {data?.customInstructions && (
          <Paragraph
            className="text-xs p-1 mt-1 !mb-0 bg-gray-50 text-gray-400 rounded-md"
            ellipsis={{ rows: 1, tooltip: { placement: 'right' } }}
          >
            {data?.customInstructions}
          </Paragraph>
        )}
      </div>

      <CreateProjectModal
        mode="edit"
        projectId={data?.projectId}
        title={data?.name}
        description={data?.description}
        coverPicture={data?.coverUrl}
        instructions={data?.customInstructions}
        visible={createProjectModalVisible}
        setVisible={setCreateProjectModalVisible}
        onSuccess={(data) => {
          onUpdate(data);
        }}
      />
    </div>
  );
};
