import { memo, useMemo, useCallback } from 'react';
import { Tag, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { GenericToolset } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { X, AiChat } from 'refly-icons';
import { Question } from 'refly-icons';
import { MentionCommonData, parseMentionsFromQuery } from '@refly/utils';
import { IContextItem } from '@refly/common-types';
import { CanvasNode } from '@refly/canvas-common';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';

interface ConfigInfoDisplayProps {
  prompt: string;
  selectedToolsets: GenericToolset[];
  contextItems: IContextItem[];
  setContextItems: (items: IContextItem[]) => void;
  setSelectedToolsets: (toolsets: GenericToolset[]) => void;
}

const SectionTitle = memo(
  ({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) => (
    <div
      className="text-xs font-semibold leading-4 mb-2 flex items-center gap-1"
      style={{ fontFamily: 'PingFang SC', letterSpacing: 0 }}
    >
      <span>{children}</span>
      {tooltip && (
        <Tooltip title={tooltip} placement="top">
          <Question color="rgba(28, 31, 35, 0.6)" className="w-3 h-3 cursor-help" />
        </Tooltip>
      )}
    </div>
  ),
);

SectionTitle.displayName = 'SectionTitle';

export const ConfigInfoDisplay = memo(
  ({
    prompt,
    selectedToolsets,
    contextItems = [],
    setContextItems,
    setSelectedToolsets,
  }: ConfigInfoDisplayProps) => {
    const { t, i18n } = useTranslation();

    const currentLanguage = (i18n.language || 'en') as 'en' | 'zh';

    // Extract tools
    const toolsets = useMemo(() => {
      return selectedToolsets?.filter((toolset) => toolset.id !== 'empty') || [];
    }, [selectedToolsets]);

    // Extract variables
    const variables = useMemo(() => {
      if (!prompt) {
        return [];
      }
      const mentions = parseMentionsFromQuery(prompt);
      return mentions.filter((item) => item.type === 'var');
    }, [prompt]);

    // Extract files from contextItems
    const files = useMemo(() => {
      return contextItems.filter((item) => item.type === 'file');
    }, [contextItems]);

    const agents = useMemo(() => {
      return contextItems.filter((item) => item.type === 'skillResponse');
    }, [contextItems]);

    const { nodes } = useRealtimeCanvasData();
    const agentNodeMap = useMemo(() => {
      const m = new Map<string, CanvasNode>();
      for (const node of nodes) {
        if (node.type === 'skillResponse') {
          m.set(node.data?.entityId, node);
        }
      }
      return m;
    }, [nodes]);

    const handleRemoveContextItem = useCallback(
      (item: IContextItem) => {
        if (!item?.entityId) {
          return;
        }

        const currentItems = contextItems ?? [];
        const nextItems = currentItems.filter(
          (contextItem) => contextItem.entityId !== item.entityId,
        );
        setContextItems(nextItems);
      },
      [contextItems, setContextItems],
    );

    const handleRemoveToolset = useCallback(
      (toolset: GenericToolset) => {
        if (!toolset?.id) {
          return;
        }

        const currentToolsets = selectedToolsets ?? [];
        const nextToolsets = currentToolsets.filter(
          (selectedToolset) => selectedToolset.id !== toolset.id,
        );
        setSelectedToolsets(nextToolsets);
      },
      [selectedToolsets, setSelectedToolsets],
    );

    return (
      <div className="flex flex-col gap-4 mt-4">
        {
          <div>
            <SectionTitle tooltip={t('agent.config.inputsDescription')}>
              {t('agent.config.inputs')}
            </SectionTitle>
            <div className="flex flex-wrap gap-2">
              {variables.map((variable: MentionCommonData, index) => (
                <Tag
                  key={`${variable.id}-${index}`}
                  className="text-xs m-0 flex items-center gap-1 bg-[#FEF2CF] px-2 py-1"
                >
                  <X className="w-3.5 h-3.5 text-[#faad14] flex-shrink-0" />
                  {variable.name}
                </Tag>
              ))}
            </div>
          </div>
        }

        {
          <div>
            <SectionTitle tooltip={t('agent.config.toolsDescription')}>
              {t('agent.config.tools')}
            </SectionTitle>
            <div className="flex flex-wrap gap-2">
              {toolsets.map((toolset, index) => {
                // Get localized label for builtin toolsets, otherwise use name
                const labelName = toolset?.builtin
                  ? ((toolset?.toolset?.definition?.labelDict?.[currentLanguage] as string) ??
                    toolset.name)
                  : toolset.name;

                return (
                  <Tag
                    key={`${toolset.id || toolset.name}-${index}`}
                    closable
                    onClose={() => handleRemoveToolset(toolset)}
                    className="text-xs m-0 flex items-center gap-1 px-2 py-1"
                  >
                    <ToolsetIcon
                      toolset={toolset}
                      config={{
                        size: 16,
                        className: 'flex-shrink-0',
                        builtinClassName: '!w-4 !h-4',
                      }}
                    />
                    <span>{labelName}</span>
                  </Tag>
                );
              })}
            </div>
          </div>
        }

        {
          <div>
            <SectionTitle tooltip={t('agent.config.filesDescription')}>
              {t('agent.config.files')}
            </SectionTitle>
            <div className="flex flex-wrap gap-2">
              {files.map((file: any, index) => (
                <Tag
                  key={`${file.entityId}-${index}`}
                  closable
                  onClose={() => handleRemoveContextItem(file)}
                  className="text-xs m-0 flex items-center gap-1 px-2 py-1"
                >
                  {file.title}
                </Tag>
              ))}
            </div>
          </div>
        }

        {
          <div>
            <SectionTitle tooltip={t('agent.config.agentsDescription')}>
              {t('agent.config.agents')}
            </SectionTitle>
            <div className="flex flex-wrap gap-2">
              {agents.map((item: IContextItem, index) => {
                const node = agentNodeMap.get(item.entityId);
                const title = node?.data?.title ?? item.title;
                return (
                  <Tag
                    key={`${item.entityId}-${index}`}
                    closable
                    onClose={() => handleRemoveContextItem(item)}
                    className="text-xs m-0 flex items-center gap-1 px-2 py-1 max-w-[200px]"
                  >
                    <AiChat className="w-3.5 h-3.5 text-[#faad14] flex-shrink-0" />
                    <span className="truncate">
                      {title || t('canvas.richChatInput.untitledAgent')}
                    </span>
                  </Tag>
                );
              })}
            </div>
          </div>
        }
      </div>
    );
  },
);

ConfigInfoDisplay.displayName = 'ConfigInfoDisplay';
