import { Button, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { memo, useCallback, useMemo, useState } from 'react';
import { SearchList } from '@refly-packages/ai-workspace-common/modules/entity-selector/components';
import { useImportResourceStoreShallow } from '@refly/stores';
import { CanvasNodeType, SearchDomain } from '@refly/openapi-schema';
import { ContextItem } from '@refly-packages/ai-workspace-common/types/context';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { SourceListModal } from '@refly-packages/ai-workspace-common/components/source-list/source-list-modal';
import { useKnowledgeBaseStoreShallow } from '@refly/stores';
import { getRuntime } from '@refly/utils/env';
import {
  IconAskAI,
  IconCreateDocument,
  IconDocument,
  IconImportResource,
  IconMemo,
  IconResource,
  IconTemplate,
  IconCodeArtifact,
  IconWebsite,
  IconMindMap,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import TooltipWrapper from '@refly-packages/ai-workspace-common/components/common/tooltip-button';
import { useCanvasStoreShallow } from '@refly/stores';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { useContextPanelStoreShallow } from '@refly/stores';
import { useEdgeVisible } from '@refly-packages/ai-workspace-common/hooks/canvas/use-edge-visible';
import { ToolButton, type ToolbarItem } from './tool-button';
import { genMemoID, genSkillID } from '@refly/utils/id';
import { useCreateCodeArtifact } from '@refly-packages/ai-workspace-common/hooks/use-create-code-artifact';
import { getDefaultContentForType } from '@refly/utils';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';

interface ToolbarProps {
  onToolSelect?: (tool: string) => void;
  nodeLength: number;
}

const useToolbarConfig = (nodeLength: number) => {
  const { t } = useTranslation();
  const { showLaunchpad, showEdges, showTemplates } = useCanvasStoreShallow((state) => ({
    showLaunchpad: state.showLaunchpad,
    showEdges: state.showEdges,
    showTemplates: state.showTemplates,
  }));

  const sourceListDrawerVisible = useKnowledgeBaseStoreShallow(
    (state) => state.sourceListDrawer.visible,
  );
  const runtime = getRuntime();
  const isWeb = runtime === 'web';

  const showTemplateConfig = {
    icon: IconTemplate,
    value: 'showTemplates',
    type: 'button',
    domain: 'template',
    tooltip: t(`canvas.toolbar.${showTemplates ? 'hideTemplates' : 'showTemplates'}`),
  };

  return useMemo(
    () => ({
      tools: [
        {
          icon: IconAskAI,
          value: 'askAI',
          type: 'button',
          isPrimary: true,
          domain: 'skill',
          tooltip: t('canvas.toolbar.askAI'),
          hoverContent: {
            title: t('canvas.toolbar.askAI'),
            description: t('canvas.toolbar.askAIDescription'),
            videoUrl: 'https://static.refly.ai/onboarding/menuPopper/menuPopper-askAI.webm',
          },
        },
        {
          icon: IconCodeArtifact,
          value: 'createCodeArtifact',
          type: 'button',
          domain: 'codeArtifact',
          tooltip: t('canvas.toolbar.createCodeArtifact', 'Create Code Artifact'),
          hoverContent: {
            title: t('canvas.toolbar.createCodeArtifact', 'Create Code Artifact'),
            description: t(
              'canvas.toolbar.createCodeArtifactDescription',
              'Create an empty code artifact to write your code',
            ),
            videoUrl:
              'https://static.refly.ai/onboarding/canvas-toolbar/canvas-toolbar-import-resource.webm',
          },
        },
        {
          icon: IconWebsite,
          value: 'createWebsite',
          type: 'button',
          domain: 'website',
          tooltip: t('canvas.toolbar.createWebsite', 'Create Website Node'),
          hoverContent: {
            title: t('canvas.toolbar.createWebsite', 'Create Website Node'),
            description: t(
              'canvas.toolbar.createWebsiteDescription',
              'Create a website node to embed a website in your canvas',
            ),
            videoUrl:
              'https://static.refly.ai/onboarding/canvas-toolbar/canvas-toolbar-import-resource.webm',
          },
        },
        {
          icon: IconMindMap,
          value: 'createMindMap',
          type: 'button',
          domain: 'mindMap',
          tooltip: t('canvas.toolbar.createMindMap', 'Create Mind Map'),
          hoverContent: {
            title: t('canvas.toolbar.createMindMap', 'Create Mind Map'),
            description: t(
              'canvas.toolbar.createMindMapDescription',
              'Create a mind map to visualize and organize ideas',
            ),
            videoUrl:
              'https://static.refly.ai/onboarding/canvas-toolbar/canvas-toolbar-import-resource.webm',
          },
        },
        {
          icon: IconMemo,
          value: 'createMemo',
          type: 'button',
          domain: 'memo',
          tooltip: t('canvas.toolbar.createMemo'),
          hoverContent: {
            title: t('canvas.toolbar.createMemo'),
            description: t('canvas.toolbar.createMemoDescription'),
            videoUrl: 'https://static.refly.ai/onboarding/menuPopper/menuPopper-createMemo.webm',
          },
        },
        {
          icon: IconImportResource,
          value: 'importResource',
          type: 'button',
          domain: 'resource',
          tooltip: t('canvas.toolbar.importResource'),
          hoverContent: {
            title: t('canvas.toolbar.importResource'),
            description: t('canvas.toolbar.importResourceDescription'),
            videoUrl:
              'https://static.refly.ai/onboarding/canvas-toolbar/canvas-toolbar-import-resource.webm',
          },
        },
        {
          icon: IconResource,
          value: 'addResource',
          type: 'popover',
          domain: 'resource',
          tooltip: t('canvas.toolbar.addResource'),
        },
        {
          icon: IconCreateDocument,
          value: 'createDocument',
          type: 'button',
          domain: 'document',
          tooltip: t('canvas.toolbar.createDocument'),
          hoverContent: {
            title: t('canvas.toolbar.createDocument'),
            description: t('canvas.toolbar.createDocumentDescription'),
            videoUrl:
              'https://static.refly.ai/onboarding/canvas-toolbar/canvas-toolbar-create-document.webm',
          },
        },
        {
          icon: IconDocument,
          value: 'addDocument',
          type: 'popover',
          domain: 'document',
          tooltip: t('canvas.toolbar.addDocument'),
        },
        // {
        //   type: 'divider',
        //   value: 'divider1',
        // },
        // {
        //   icon: IconAskAIInput,
        //   value: 'handleLaunchpad',
        //   type: 'button',
        //   domain: 'launchpad',
        //   tooltip: t(`canvas.toolbar.${showLaunchpad ? 'hideLaunchpad' : 'showLaunchpad'}`),
        //   hoverContent: {
        //     title: t('canvas.toolbar.toggleLaunchpadTitle'),
        //     videoUrl:
        //       'https://static.refly.ai/onboarding/canvas-toolbar/canvas-toolbar-toggle-ask-ai.webm',
        //   },
        // },
        // {
        //   icon: IoAnalyticsOutline,
        //   value: 'showEdges',
        //   type: 'button',
        //   domain: 'edges',
        //   tooltip: t(`canvas.toolbar.${showEdges ? 'hideEdges' : 'showEdges'}`),
        //   hoverContent: {
        //     title: t('canvas.toolbar.toggleEdgeTitle'),
        //     videoUrl:
        //       'https://static.refly.ai/onboarding/canvas-toolbar/canvas-toolbar-toggle-edge.webm',
        //   },
        // },
        ...(nodeLength === 0 ? [showTemplateConfig] : []),
      ] as ToolbarItem[],
      modals: {
        sourceList: sourceListDrawerVisible && isWeb,
      },
    }),
    [t, showEdges, showLaunchpad, sourceListDrawerVisible, isWeb, showTemplates, nodeLength],
  );
};

const SearchListWrapper = memo(
  ({
    tool,
    handleConfirm,
  }: {
    tool: ToolbarItem;
    handleConfirm: (items: ContextItem[]) => void;
  }) => {
    const handleToolSelect = useCallback((event: React.MouseEvent) => {
      event.preventDefault();
    }, []);

    const [open, setOpen] = useState(false);

    const button = (
      <Button
        type="text"
        onClick={handleToolSelect}
        className={`
          h-[32px] w-[32px] 
          flex items-center justify-center 
          hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg 
          transition-colors duration-200 
          group
          ${tool.active ? 'bg-gray-100 dark:bg-gray-800' : ''}
        `}
        icon={
          <tool.icon className="h-[18px] w-[18px] text-gray-600 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-gray-100" />
        }
      />
    );

    return (
      <SearchList
        domain={tool.domain as SearchDomain}
        handleConfirm={handleConfirm}
        offset={12}
        placement="right"
        open={open}
        setOpen={setOpen}
      >
        <TooltipWrapper tooltip={tool.tooltip}>{button}</TooltipWrapper>
      </SearchList>
    );
  },
);

export const CanvasToolbar = memo<ToolbarProps>(({ onToolSelect, nodeLength }) => {
  const { t } = useTranslation();
  const { addNode } = useAddNode();

  // 4. 使用 selector 函数分离状态
  const { showLaunchpad, setShowLaunchpad, showEdges, showTemplates, setShowTemplates } =
    useCanvasStoreShallow((state) => ({
      showLaunchpad: state.showLaunchpad,
      setShowLaunchpad: state.setShowLaunchpad,
      showEdges: state.showEdges,
      showTemplates: state.showTemplates,
      setShowTemplates: state.setShowTemplates,
    }));

  const { setImportResourceModalVisible } = useImportResourceStoreShallow((state) => ({
    setImportResourceModalVisible: state.setImportResourceModalVisible,
  }));

  const contextItems = useContextPanelStoreShallow((state) => state.contextItems);

  const { createSingleDocumentInCanvas, isCreating } = useCreateDocument();
  const { toggleEdgeVisible } = useEdgeVisible();

  const { tools, modals } = useToolbarConfig(nodeLength);

  const getIconColor = useCallback(
    (tool: string) => {
      if (tool === 'showTemplates' && !showTemplates) return '#9CA3AF';
      if (tool === 'showEdges' && !showEdges) return '#9CA3AF';
      if (tool === 'handleLaunchpad' && !showLaunchpad) return '#9CA3AF';
      return '';
    },
    [showEdges, showLaunchpad, showTemplates],
  );

  const getIsLoading = useCallback(
    (tool: string) => {
      return tool === 'createDocument' && isCreating;
    },
    [isCreating],
  );

  const createSkillNode = useCallback(() => {
    addNode(
      {
        type: 'skill',
        data: { title: 'Skill', entityId: genSkillID() },
      },
      [],
      true,
      true,
    );
  }, [addNode]);

  const createMemo = useCallback(() => {
    const memoId = genMemoID();
    addNode(
      {
        type: 'memo',
        data: { title: t('canvas.nodeTypes.memo'), entityId: memoId },
      },
      [],
      true,
      true,
    );
  }, [addNode, t]);

  const createCodeArtifactNode = useCreateCodeArtifact();

  const createWebsiteNode = useCallback(() => {
    addNode(
      {
        type: 'website',
        data: {
          title: t('canvas.nodes.website.defaultTitle', 'Website'),
          entityId: genSkillID(),
          metadata: {
            viewMode: 'form',
          },
        },
      },
      [],
      true,
      true,
    );
  }, [addNode, t]);

  const createMindMapArtifact = useCallback(() => {
    createCodeArtifactNode({
      codeContent: getDefaultContentForType('application/refly.artifacts.mindmap'),
      language: 'json',
      type: 'application/refly.artifacts.mindmap',
      title: t('canvas.nodes.mindMap.defaultTitle', 'Mind Map'),
      activeTab: 'preview',
    });
  }, [createCodeArtifactNode, t]);

  const handleToolSelect = useCallback(
    (_event: React.MouseEvent, tool: string) => {
      switch (tool) {
        case 'importResource':
          setImportResourceModalVisible(true);
          break;
        case 'createWebsite':
          createWebsiteNode();
          break;
        case 'createMindMap':
          createMindMapArtifact();
          break;
        case 'createDocument':
          createSingleDocumentInCanvas();
          break;
        case 'handleLaunchpad':
          setShowLaunchpad(!showLaunchpad);
          break;
        case 'showEdges':
          toggleEdgeVisible();
          break;
        case 'askAI':
          createSkillNode();
          break;
        case 'createMemo':
          createMemo();
          break;
        case 'createCodeArtifact':
          createCodeArtifactNode();
          break;
        case 'showTemplates':
          setShowTemplates(!showTemplates);
          break;
      }
      onToolSelect?.(tool);
    },
    [
      setImportResourceModalVisible,
      createSingleDocumentInCanvas,
      setShowLaunchpad,
      showLaunchpad,
      toggleEdgeVisible,
      createSkillNode,
      createMemo,
      createCodeArtifactNode,
      createWebsiteNode,
      createMindMapArtifact,
      onToolSelect,
      setShowTemplates,
      showTemplates,
    ],
  );

  const handleConfirm = useCallback(async (selectedItems: ContextItem[]) => {
    if (!selectedItems || selectedItems.length === 0) return;

    // Store the reference position for node placement
    let referencePosition = null;

    try {
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        const contentPreview = item?.snippets?.map((snippet) => snippet?.text || '').join('\n');

        // For the first node, let the system calculate the position
        // For subsequent nodes, provide an offset based on the previous node
        const position = referencePosition
          ? {
              // @ts-ignore
              x: referencePosition.x,
              // @ts-ignore
              y: referencePosition.y + 150, // Add vertical spacing between nodes
            }
          : undefined;

        await new Promise<void>((resolve, reject) => {
          try {
            // Use the event emitter to add nodes with proper spacing
            nodeOperationsEmitter.emit('addNode', {
              node: {
                type: item.domain as CanvasNodeType,
                data: {
                  title: item.title,
                  entityId: item.id,
                  contentPreview: item?.contentPreview || contentPreview,
                  metadata:
                    item.domain === 'resource'
                      ? { resourceType: item?.metadata?.resourceType }
                      : {},
                },
                position,
              },
              shouldPreview: i === selectedItems.length - 1, // Only preview the last node
              needSetCenter: i === selectedItems.length - 1, // Only center on the last node
              positionCallback: (newPosition) => {
                referencePosition = newPosition;
                resolve();
              },
            });

            // Add a timeout in case the callback doesn't fire
            setTimeout(() => resolve(), 100);
          } catch (e) {
            console.error('Error adding node:', e);
            reject(e);
          }
        });
      }
    } catch (error) {
      console.error('Error in handleConfirm:', error);
    }
  }, []);

  return (
    <div
      className="absolute left-[12px] top-1/2 -translate-y-1/2 bg-white border border-solid border-gray-100 shadow-sm rounded-lg p-2 flex flex-col gap-2 z-10 dark:bg-gray-900 dark:border-gray-800"
      data-cy="canvas-toolbar"
    >
      {tools.map((tool) => {
        if (tool.type === 'divider') {
          return <Divider key={tool.value} className="m-0" />;
        }

        if (tool.type === 'button') {
          return (
            <ToolButton
              key={tool.value}
              tool={tool}
              contextCnt={contextItems?.length}
              handleToolSelect={handleToolSelect}
              getIconColor={getIconColor}
              getIsLoading={getIsLoading}
            />
          );
        }

        return <SearchListWrapper key={tool.value} tool={tool} handleConfirm={handleConfirm} />;
      })}

      {modals.sourceList && <SourceListModal classNames="source-list-modal" />}
    </div>
  );
});
