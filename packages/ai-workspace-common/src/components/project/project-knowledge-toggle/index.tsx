import React, { useState, useEffect } from 'react';
import { Switch, Tooltip, Select, Spin, Avatar, Button } from 'antd';
import { LuBrain, LuCheck, LuPlus } from 'react-icons/lu';
import { FiHelpCircle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { IconDown, IconProject } from '@refly-packages/ai-workspace-common/components/common/icon';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Project } from '@refly/openapi-schema';
import { useContextPanelStoreShallow } from '@refly/stores';
import { CreateProjectModal } from '@refly-packages/ai-workspace-common/components/project/project-create';
import './index.scss';
import { useUserStore } from '@refly/stores';

// Custom styles for switch component
const switchStyles = {
  backgroundColor: '#00968F',
};

interface ProjectKnowledgeToggleProps {
  currentProjectId?: string;
  className?: string;
  projectSelectorClassName?: string;
  enableSelectProject?: boolean;
  onProjectChange?: (projectId: string) => void;
  onSwitchChange?: (checked: boolean) => void;
  enableProjectSelector?: boolean;
}

export const ProjectKnowledgeToggle: React.FC<ProjectKnowledgeToggleProps> = ({
  currentProjectId,
  className = '',
  projectSelectorClassName = '',
  enableSelectProject = true,
  onProjectChange,
  onSwitchChange,
  enableProjectSelector = true,
}) => {
  const { t } = useTranslation();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);
  const [createProjectModalVisible, setCreateProjectModalVisible] = useState(false);

  const { setRuntimeConfig, enabledKnowledgeBase } = useContextPanelStoreShallow((state) => ({
    setRuntimeConfig: state.setRuntimeConfig,
    enabledKnowledgeBase: state?.runtimeConfig?.enabledKnowledgeBase,
  }));

  // Fetch project list
  const fetchProjects = async () => {
    const { isLogin } = useUserStore.getState();
    if (!isLogin) return;

    setLoading(true);
    try {
      const res = await getClient().listProjects({
        query: { pageSize: 100 },
      });

      if (res?.data?.data) {
        setProjects(res.data.data);

        // Set current project
        const current = res.data.data.find((p) => p.projectId === currentProjectId);
        if (current) {
          setCurrentProject(current);
        }
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [currentProjectId]);

  const handleProjectChange = async (projectId: string) => {
    if (projectId === currentProjectId) return;

    if (onProjectChange) {
      onProjectChange(projectId);
    }
  };

  const projectName = currentProject?.name || t('common.untitled');

  return (
    <div className={`project-kb-toggle mt-autopt-2 pb-2 ${className}`}>
      <div className="rounded-lg flex items-center justify-between bg-gray-50 p-2 pt-0 pb-0 border border-solid border-refly-Card-Border hover:border-[#00968F]/30 transition-all cursor-pointer">
        <div className="flex items-center gap-2 flex-shrink overflow-hidden">
          <LuBrain
            className={`transition-colors duration-300 flex-shrink-0 ${enabledKnowledgeBase ? 'text-[#00968F]' : 'text-gray-500'}`}
            size={16}
          />

          {/* Project Selector Dropdown */}
          {enableProjectSelector ? (
            <Select
              onDropdownVisibleChange={(visible) => setSelectOpen(visible)}
              open={selectOpen}
              loading={loading}
              className={`project-selector transition-all overflow-hidden ${projectSelectorClassName}`}
              placeholder={t('project.selectProject')}
              value={currentProjectId}
              onChange={handleProjectChange}
              variant="borderless"
              dropdownStyle={{ minWidth: '250px' }}
              optionLabelProp="label"
              suffixIcon={!enableSelectProject ? null : <IconDown size={12} />}
              disabled={!enableSelectProject}
              style={{
                padding: 0,
              }}
              dropdownRender={(menu) => (
                <div className="rounded-md overflow-hidden shadow-lg">
                  <div className="px-3 py-2 text-xs text-gray-600 border-b border-gray-100 bg-gray-50 dark:text-gray-300 dark:border-gray-800 dark:bg-gray-950">
                    {t('project.switchProject')}
                  </div>
                  {loading ? (
                    <div className="flex justify-center items-center py-4">
                      <Spin size="small" />
                    </div>
                  ) : projects.length > 0 ? (
                    menu
                  ) : (
                    <div className="py-4 px-3 flex flex-col items-center justify-center">
                      <div className="text-sm text-gray-500 mb-2">{t('project.noProjects')}</div>
                      <Button
                        type="primary"
                        size="small"
                        className="bg-[#00968F] hover:bg-[#007F7A] flex items-center"
                        icon={<LuPlus size={14} />}
                        onClick={() => setCreateProjectModalVisible(true)}
                      >
                        {t('project.create')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            >
              {projects.map((project) => (
                <Select.Option
                  key={project.projectId}
                  value={project.projectId}
                  label={
                    <span className="w-full text-sm text-gray-600 truncate inline-block dark:text-gray-300">
                      {project.name || t('common.untitled')}
                    </span>
                  }
                >
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      {project.coverUrl ? (
                        <Avatar size={20} src={project.coverUrl} className="flex-shrink-0" />
                      ) : (
                        <IconProject size={20} className="text-gray-500 flex-shrink-0" />
                      )}
                      <span className="truncate max-w-[150px] text-sm">
                        {project.name || t('common.untitled')}
                      </span>
                    </div>
                    {project.projectId === currentProjectId && (
                      <LuCheck className="text-[#00968F]" size={16} />
                    )}
                  </div>
                </Select.Option>
              ))}
            </Select>
          ) : (
            <div className="text-sm text-gray-600 truncate inline-block h-[32px] flex items-center dark:text-gray-300">
              <span>{t('project.askProject')}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-1">
          <Switch
            size="small"
            checked={enabledKnowledgeBase}
            onChange={(checked) => {
              setRuntimeConfig({
                enabledKnowledgeBase: checked,
              });

              if (onSwitchChange) {
                onSwitchChange(checked);
              }
            }}
            className="shadow-sm"
            style={{ ...(enabledKnowledgeBase ? switchStyles : {}) }}
          />
          <Tooltip
            title={
              <div className="p-1 max-w-xs">
                <div className="font-medium mb-1 text-[#00968F]">{t('project.askProject')}</div>
                <div className="text-xs text-gray-400">
                  <span className="mt-1 block">
                    {enabledKnowledgeBase
                      ? t('project.knowledgeToggle.enabledDesc', { projectName })
                      : t('project.knowledgeToggle.disabledDesc', { projectName })}
                  </span>
                </div>
              </div>
            }
            open={tooltipVisible}
            onOpenChange={setTooltipVisible}
            placement="top"
            overlayInnerStyle={{ padding: '8px', borderRadius: '6px' }}
          >
            <div className="cursor-pointer flex items-center">
              <FiHelpCircle
                className="text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300"
                size={16}
              />
            </div>
          </Tooltip>
        </div>
      </div>

      <CreateProjectModal
        mode="create"
        visible={createProjectModalVisible}
        setVisible={setCreateProjectModalVisible}
        onSuccess={() => {
          fetchProjects();
        }}
      />
    </div>
  );
};
