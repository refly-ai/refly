import { memo, useMemo, useCallback } from 'react';
import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { GenericToolset } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { X, AiChat, File } from 'refly-icons';
import { Question } from 'refly-icons';
import { MentionCommonData, parseMentionsFromQuery } from '@refly/utils';
import { IContextItem } from '@refly/common-types';
import { CanvasNode } from '@refly/canvas-common';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { LabelItem } from '@refly-packages/ai-workspace-common/components/canvas/common/label-display';

interface ConfigInfoDisplayProps {
  prompt: string;
  selectedToolsets: GenericToolset[];
  contextItems: IContextItem[];
  upstreamResultIds: string[];
  setContextItems: (items: IContextItem[]) => void;
  setSelectedToolsets: (toolsets: GenericToolset[]) => void;
  setUpstreamResultIds: (resultIds: string[]) => void;
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
    upstreamResultIds = [],
    setContextItems,
    setSelectedToolsets,
    setUpstreamResultIds,
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

    // Extract files from contextItems
    const files = useMemo(() => {
      return contextItems.filter((item) => item.type === 'file');
    }, [contextItems]);

    const agents = useMemo(() => {
      return upstreamResultIds
        .map((resultId) => agentNodeMap.get(resultId))
        .filter((node): node is CanvasNode => node !== undefined);
    }, [upstreamResultIds, agentNodeMap]);

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

    const handleRemoveUpstreamResult = useCallback(
      (resultId: string) => {
        if (!resultId) {
          return;
        }

        const currentResultIds = upstreamResultIds ?? [];
        const nextResultIds = currentResultIds.filter((id) => id !== resultId);
        setUpstreamResultIds(nextResultIds);
      },
      [upstreamResultIds, setUpstreamResultIds],
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
                <LabelItem
                  key={`${variable.id}-${index}`}
                  icon={<X size={12} className="flex-shrink-0" />}
                  labeltext={variable.name}
                  classnames="bg-refly-node-contrl-2"
                />
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
                  <LabelItem
                    key={`${toolset.id || toolset.name}-${index}`}
                    icon={
                      <ToolsetIcon
                        toolset={toolset}
                        config={{
                          size: 12,
                          className: 'flex-shrink-0',
                          builtinClassName: '!rounded-[2.5px]',
                        }}
                      />
                    }
                    labeltext={labelName}
                    classnames="bg-refly-node-contrl-1"
                    onClose={() => handleRemoveToolset(toolset)}
                  />
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
                <LabelItem
                  key={`${file.entityId}-${index}`}
                  icon={<File size={12} className="flex-shrink-0" />} // TODO: use file icon for file type
                  labeltext={file.title}
                  classnames="bg-gray-100 dark:bg-gray-700"
                  onClose={() => handleRemoveContextItem(file)}
                />
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
              {agents.map((node, index) => {
                const title = node?.data?.title;
                return (
                  <LabelItem
                    key={`${node.id}-${index}`}
                    icon={<AiChat size={14} className="flex-shrink-0" />}
                    labeltext={title || t('canvas.richChatInput.untitledAgent')}
                    classnames="bg-refly-node-contrl-2"
                    onClose={() => handleRemoveUpstreamResult(node.data?.entityId)}
                  />
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
