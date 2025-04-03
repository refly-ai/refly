import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Collapse,
  Button,
  List,
  Empty,
  Typography,
  Dropdown,
  Checkbox,
  message,
  Skeleton,
} from 'antd';
import { IconCanvas, IconPlus } from '@refly-packages/ai-workspace-common/components/common/icon';
import { iconClassName } from '@refly-packages/ai-workspace-common/components/project/project-directory';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import cn from 'classnames';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SiderData } from '@refly-packages/ai-workspace-common/stores/sider';
import { CanvasActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import HeaderActions from '@refly-packages/ai-workspace-common/components/common/header-actions';
import { AddSources } from '@refly-packages/ai-workspace-common/components/project/add-sources';

const { Text } = Typography;

interface AddCanvasDropdownProps {
  debouncedCreateCanvas: () => void;
  children?: React.ReactNode;
  projectId: string;
  onAddCanvasesSuccess?: (canvasIds?: string[]) => void;
  canvasList: SiderData[];
}
const AddCanvasDropdown = ({
  debouncedCreateCanvas,
  children,
  projectId,
  onAddCanvasesSuccess,
  canvasList,
}: AddCanvasDropdownProps) => {
  const { t } = useTranslation();
  const [addSourcesVisible, setAddSourcesVisible] = useState(false);

  const items = [
    {
      key: 'createCanvas',
      label: t('project.action.createCanvas'),
      onClick: () => {
        debouncedCreateCanvas();
      },
    },
    {
      key: 'addExistingCanvas',
      label: t('project.action.addExistingCanvas'),
      onClick: () => {
        setAddSourcesVisible(true);
      },
    },
  ];

  return (
    <>
      <Dropdown menu={{ items }} trigger={['click']}>
        {children || (
          <Button
            type="default"
            size="small"
            className="text-xs text-gray-600"
            icon={<IconPlus size={12} className="flex items-center justify-center" />}
          >
            {t('project.action.addCanvas')}
          </Button>
        )}
      </Dropdown>
      <AddSources
        domain="canvas"
        visible={addSourcesVisible}
        setVisible={setAddSourcesVisible}
        projectId={projectId}
        existingItems={canvasList?.map((canvas) => canvas.id) || []}
        onSuccess={(canvasIds) => {
          onAddCanvasesSuccess?.(canvasIds);
        }}
        defaultActiveKey="canvas"
      />
    </>
  );
};

export const CanvasMenu = ({
  canvasList,
  projectId,
  onAddCanvasesSuccess,
  onRemoveCanvases,
  isFetching,
}: {
  canvasList: SiderData[];
  projectId: string;
  onAddCanvasesSuccess?: (canvasIds?: string[]) => void;
  onRemoveCanvases?: (canvasIds: string[]) => void;
  isFetching: boolean;
}) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const canvasId = searchParams.get('canvasId');
  const navigate = useNavigate();
  const { debouncedCreateCanvas } = useCreateCanvas({
    projectId,
    afterCreateSuccess: onAddCanvasesSuccess,
  });

  const [hoveredCanvasId, setHoveredCanvasId] = useState<string | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedCanvases, setSelectedCanvases] = useState<SiderData[]>([]);

  const handleCanvasHover = useCallback(
    (id: string | null) => {
      if (!isMultiSelectMode) {
        setHoveredCanvasId(id);
      }
    },
    [isMultiSelectMode],
  );

  const toggleSearchMode = useCallback(() => {
    setIsSearchMode((prev) => !prev);
    if (isSearchMode) {
      setSearchValue('');
    }
  }, [isSearchMode]);

  const filteredCanvasList = useMemo(() => {
    if (!searchValue) return canvasList;
    return canvasList.filter((item) => item.name.toLowerCase().includes(searchValue.toLowerCase()));
  }, [searchValue, canvasList]);

  const toggleCanvasSelection = useCallback((canvas: SiderData) => {
    setSelectedCanvases((prev) => {
      if (prev.some((item) => item.id === canvas.id)) {
        return prev.filter((item) => item.id !== canvas.id);
      }
      setIsMultiSelectMode(true);
      return [...prev, canvas];
    });
  }, []);

  const exitMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(false);
    setSelectedCanvases([]);
    setHoveredCanvasId(null);
  }, []);

  const deleteSelectedCanvases = useCallback(async () => {
    const { data } = await getClient().deleteProjectItems({
      body: {
        projectId,
        items: selectedCanvases.map((item) => ({
          entityType: 'canvas',
          entityId: item.id,
        })),
      },
    });
    if (data?.success) {
      onRemoveCanvases?.(selectedCanvases.map((item) => item.id));
      setSelectedCanvases([]);
      setHoveredCanvasId(null);
      message.success(t('project.action.deleteItemsSuccess'));
    }
  }, [selectedCanvases, exitMultiSelectMode, onRemoveCanvases]);

  const removeSelectedCanvasesFromProject = useCallback(async () => {
    const res = await getClient().updateProjectItems({
      body: {
        projectId,
        items: selectedCanvases.map((item) => ({
          entityType: 'canvas',
          entityId: item.id,
        })),
      },
    });
    const { data } = res || {};
    if (data?.success) {
      onRemoveCanvases?.(selectedCanvases.map((item) => item.id));
      setSelectedCanvases([]);
      setHoveredCanvasId(null);
      message.success(t('project.action.removeItemsSuccess'));
    }
  }, [selectedCanvases, projectId, t, onRemoveCanvases]);

  const handleCanvasClick = useCallback(
    (canvasId: string, canvas: SiderData) => {
      if (isMultiSelectMode) {
        toggleCanvasSelection(canvas);
      } else {
        navigate(`/project/${projectId}?canvasId=${canvasId}`);
      }
    },
    [isMultiSelectMode, navigate, projectId, toggleCanvasSelection],
  );

  const addButtonNode = useMemo(
    () => (
      <AddCanvasDropdown
        debouncedCreateCanvas={debouncedCreateCanvas}
        projectId={projectId}
        onAddCanvasesSuccess={onAddCanvasesSuccess}
        canvasList={canvasList}
      >
        <Button
          type="text"
          size="small"
          icon={<IconPlus className={cn(iconClassName, 'text-gray-500')} />}
        />
      </AddCanvasDropdown>
    ),
    [debouncedCreateCanvas, projectId, onAddCanvasesSuccess, canvasList],
  );

  const itemCountText = useMemo(
    () => t('project.canvasCount', { canvasCount: canvasList.length }),
    [canvasList.length, t],
  );

  useEffect(() => {
    if (selectedCanvases?.length === 0) {
      setIsMultiSelectMode(false);
    }
  }, [selectedCanvases?.length]);

  return (
    <Collapse
      defaultActiveKey={['canvas']}
      ghost
      expandIconPosition="end"
      className="bg-white custom-collapse"
      items={[
        {
          key: 'canvas',
          label: (
            <div className="flex items-center gap-2 text-sm">
              <IconCanvas size={20} className="flex items-center justify-center text-gray-500" />
              {t('project.canvas')}
            </div>
          ),
          children: (
            <div className="flex flex-col">
              <HeaderActions
                isSearchMode={isSearchMode}
                isMultiSelectMode={isMultiSelectMode}
                searchValue={searchValue}
                selectedItems={selectedCanvases}
                onSearchChange={setSearchValue}
                onToggleSearchMode={toggleSearchMode}
                onExitMultiSelectMode={exitMultiSelectMode}
                onDeleteSelected={deleteSelectedCanvases}
                onRemoveSelected={removeSelectedCanvasesFromProject}
                addButtonNode={addButtonNode}
                itemCountText={itemCountText}
              />
              <div className="max-h-[20vh] overflow-y-auto px-3">
                {isFetching ? (
                  <div className="flex justify-center h-full pt-4">
                    <Skeleton active paragraph={{ rows: 8 }} title={false} />
                  </div>
                ) : (
                  <List
                    itemLayout="horizontal"
                    split={false}
                    dataSource={filteredCanvasList}
                    locale={{
                      emptyText: (
                        <Empty
                          className="text-xs my-2 "
                          image={null}
                          imageStyle={{
                            display: 'none',
                          }}
                          description={t('common.empty')}
                        >
                          <AddCanvasDropdown
                            debouncedCreateCanvas={debouncedCreateCanvas}
                            projectId={projectId}
                            onAddCanvasesSuccess={onAddCanvasesSuccess}
                            canvasList={canvasList}
                          />
                        </Empty>
                      ),
                    }}
                    renderItem={(item) => (
                      <List.Item
                        className={cn(
                          '!py-2 !px-1 rounded-md hover:bg-gray-50 cursor-pointer',
                          canvasId === item.id ? 'bg-gray-100' : '',
                          selectedCanvases.some((canvas) => canvas.id === item.id) && 'bg-gray-50',
                        )}
                        onMouseEnter={() => handleCanvasHover(item.id)}
                        onMouseLeave={() => handleCanvasHover(null)}
                        onClick={() => handleCanvasClick(item.id, item)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <IconCanvas className={cn(iconClassName, 'text-gray-500')} />
                            <Text className="w-[120px] text-[13px] text-gray-700 truncate">
                              {item.name || t('common.untitled')}
                            </Text>
                          </div>
                          <div
                            className={cn(
                              'flex items-center gap-1 transition-opacity duration-200',
                              isMultiSelectMode || hoveredCanvasId === item.id
                                ? 'opacity-100'
                                : 'opacity-0',
                            )}
                          >
                            <Checkbox
                              checked={selectedCanvases.some((canvas) => canvas.id === item.id)}
                              onChange={() => toggleCanvasSelection(item)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {!isMultiSelectMode && (
                              <CanvasActionDropdown canvasId={item.id} canvasName={item.name} />
                            )}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                )}
              </div>
            </div>
          ),
        },
      ]}
    />
  );
};
