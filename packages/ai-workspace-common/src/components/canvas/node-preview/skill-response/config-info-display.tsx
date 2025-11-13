import { memo, useMemo } from 'react';
import { Tag, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { GenericToolset } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { X } from 'refly-icons';
import { useListMentionItems } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/rich-chat-input/hooks/use-list-mention-items';
import { MentionItem } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/rich-chat-input/mentionList';
import { Question } from 'refly-icons';

interface ConfigInfoDisplayProps {
  nodeId: string;
  selectedToolsets?: GenericToolset[];
  contextItems?: any[];
  onRemoveFile?: (file: any) => void;
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
  ({ nodeId, selectedToolsets, contextItems = [], onRemoveFile }: ConfigInfoDisplayProps) => {
    const { i18n } = useTranslation();
    const allItems = useListMentionItems(nodeId);

    const currentLanguage = (i18n.language || 'en') as 'en' | 'zh';

    // Extract tools
    const toolsets = useMemo(() => {
      return selectedToolsets?.filter((toolset) => toolset.id !== 'empty') || [];
    }, [selectedToolsets]);

    // Extract variables
    const variables = useMemo(() => {
      return allItems.filter((item) => item.source === 'variables');
    }, [allItems]);

    // Extract files from contextItems (resource type)
    const files = useMemo(() => {
      return contextItems.filter((item) => item.type === 'resource');
    }, [contextItems]);

    // Extract node references (stepRecord and resultRecord)
    const nodeReferences = useMemo(() => {
      return allItems.filter(
        (item) => item.source === 'stepRecord' || item.source === 'resultRecord',
      );
    }, [allItems]);

    return (
      <div className="flex flex-col gap-4 mt-4">
        {/* Variables (输入项) */}
        {
          <div>
            <SectionTitle tooltip="添加你需要填写的信息（如关键词、数量），workflow会基于这些信息生成内容">
              输入项
            </SectionTitle>
            <div className="flex flex-wrap gap-2">
              {variables.map((variable: MentionItem, index) => (
                <Tag
                  key={`${variable.variableId || variable.name}-${index}`}
                  className="text-xs m-0 flex items-center gap-1 bg-[#FEF2CF] px-2 py-1"
                >
                  <X className="w-3.5 h-3.5 text-[#faad14] flex-shrink-0" />
                  {variable.name}
                </Tag>
              ))}
            </div>
          </div>
        }

        {/* Tools (工具) */}
        {
          <div>
            <SectionTitle tooltip="调用外部服务（如搜索全网信息、生成图片），让workflow具备更多能力">
              工具
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

        {/* Files (文件) */}
        {
          <div>
            <SectionTitle tooltip='可拖入添加文档、图片、视频等，添加后会自动保存至"文件"，可通过@调用，为workflow提供参考资料'>
              文件
            </SectionTitle>
            <div className="flex flex-wrap gap-2">
              {files.map((file: any, index) => (
                <Tag
                  key={`${file.entityId}-${index}`}
                  closable
                  onClose={() => onRemoveFile?.(file)}
                  className="text-xs m-0 flex items-center gap-1 px-2 py-1"
                >
                  {file.title}
                </Tag>
              ))}
            </div>
          </div>
        }

        {/* Node References (智能体) */}
        {
          <div>
            <SectionTitle tooltip="添加智能助手，与当前节点协作完成复杂任务（如先分析数据，再生成报告）">
              智能体
            </SectionTitle>
            <div className="flex flex-wrap gap-2">
              {nodeReferences.map((node: MentionItem, index) => (
                <Tag
                  key={`${node.nodeId || node.name}-${index}`}
                  className="text-xs m-0 flex items-center gap-1 px-2 py-1 max-w-[200px]"
                >
                  <span className="truncate">{node.name}</span>
                </Tag>
              ))}
            </div>
          </div>
        }
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.nodeId === nextProps.nodeId &&
      JSON.stringify(prevProps.selectedToolsets) === JSON.stringify(nextProps.selectedToolsets) &&
      JSON.stringify(prevProps.contextItems) === JSON.stringify(nextProps.contextItems)
    );
  },
);

ConfigInfoDisplay.displayName = 'ConfigInfoDisplay';
