import { memo, useMemo, useCallback } from 'react';
import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { GenericToolset } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { X, AiChat } from 'refly-icons';
import { Question } from 'refly-icons';
import { MentionCommonData, parseMentionsFromQuery } from '@refly/utils';
import { IContextItem } from '@refly/common-types';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';
import { LabelItem } from '@refly-packages/ai-workspace-common/components/canvas/common/label-display';
import { useCanvasNodesStoreShallow } from '@refly/stores';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { AGENT_CONFIG_KEY_CLASSNAMES } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';

interface ConfigInfoDisplayProps {
  readonly?: boolean;
  prompt: string;
  selectedToolsets: GenericToolset[];
  contextItems: IContextItem[];
  upstreamAgentNodes: CanvasNode<ResponseNodeMeta>[];
  setContextItems: (items: IContextItem[]) => void;
  setSelectedToolsets: (toolsets: GenericToolset[]) => void;
  removeUpstreamAgent: (targetEntityId: string) => void;
  disabled: boolean;
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
          <Question color="rgba(28, 31, 35, 0.6)" className="w-3 h-3 cursor-pointer" />
        </Tooltip>
      )}
    </div>
  ),
);

SectionTitle.displayName = 'SectionTitle';

export const ConfigInfoDisplay = memo(
  ({
    readonly = false,
    prompt,
    selectedToolsets,
    contextItems = [],
    upstreamAgentNodes = [],
    setContextItems,
    setSelectedToolsets,
    removeUpstreamAgent,
    disabled,
  }: ConfigInfoDisplayProps) => {
    const { t, i18n } = useTranslation();
    const { setHighlightedNodeId } = useCanvasNodesStoreShallow((state) => ({
      setHighlightedNodeId: state.setHighlightedNodeId,
    }));
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
      return contextItems.filter(
        (item) => item.type === 'file' && item.metadata.source === 'files',
      );
    }, [contextItems]);

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

    const handleRemoveUpstreamAgent = useCallback(
      (resultId: string) => {
        if (!resultId) {
          return;
        }
        removeUpstreamAgent(resultId);
        setHighlightedNodeId(null);
      },
      [removeUpstreamAgent, setHighlightedNodeId],
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
      <div className="flex flex-col gap-4 pt-4 h-full overflow-y-auto">
        <div>
          <SectionTitle tooltip={t('agent.config.inputsDescription')}>
            {t('agent.config.inputs')}
          </SectionTitle>
          <div className="flex flex-wrap gap-2">
            {variables.map((variable: MentionCommonData, index) => (
              <LabelItem
                readonly={readonly}
                key={`${variable.id}-${index}`}
                icon={<X size={12} className="flex-shrink-0" />}
                labeltext={variable.name}
                classnames={AGENT_CONFIG_KEY_CLASSNAMES.inputs}
              />
            ))}
          </div>
        </div>

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
                  readonly={readonly}
                  key={`${toolset.id || toolset.name}-${index}`}
                  icon={
                    <ToolsetIcon
                      toolset={toolset}
                      config={{
                        size: 12,
                        className: 'flex-shrink-0',
                        builtinClassName: '!rounded-[2.5px] !w-3 !h-3',
                      }}
                    />
                  }
                  labeltext={labelName}
                  classnames={AGENT_CONFIG_KEY_CLASSNAMES.tools}
                  onClose={disabled ? undefined : () => handleRemoveToolset(toolset)}
                />
              );
            })}
          </div>
        </div>

        <div>
          <SectionTitle tooltip={t('agent.config.filesDescription')}>
            {t('agent.config.files')}
          </SectionTitle>
          <div className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <LabelItem
                readonly={readonly}
                key={`${file.entityId}-${index}`}
                icon={
                  <NodeIcon
                    type="file"
                    filename={file.title}
                    filled={false}
                    className="!w-3.5 !h-3.5"
                  />
                }
                labeltext={file.title}
                classnames={AGENT_CONFIG_KEY_CLASSNAMES.files}
                onClose={disabled ? undefined : () => handleRemoveContextItem(file)}
              />
            ))}
          </div>
        </div>

        <div>
          <SectionTitle tooltip={t('agent.config.agentsDescription')}>
            {t('agent.config.agents')}
          </SectionTitle>
          <div className="flex flex-wrap gap-2">
            {upstreamAgentNodes.map((node, index) => {
              const title = node?.data?.title;
              return (
                <LabelItem
                  onMouseEnter={!readonly ? () => setHighlightedNodeId(node.id) : undefined}
                  onMouseLeave={!readonly ? () => setHighlightedNodeId(null) : undefined}
                  readonly={readonly}
                  key={`${node.id}-${index}`}
                  icon={<AiChat size={14} className="flex-shrink-0" />}
                  labeltext={title || t('canvas.richChatInput.untitledAgent')}
                  classnames={AGENT_CONFIG_KEY_CLASSNAMES.agents}
                  onClose={
                    disabled ? undefined : () => handleRemoveUpstreamAgent(node.data?.entityId)
                  }
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);

ConfigInfoDisplay.displayName = 'ConfigInfoDisplay';
