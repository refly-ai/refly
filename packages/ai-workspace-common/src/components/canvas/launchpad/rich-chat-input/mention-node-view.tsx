import React from 'react';
import { cn } from '@refly/utils';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { X } from 'refly-icons';
import type { CanvasNodeType } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { MentionItemSource } from './const';
import { AGENT_CONFIG_KEY_CLASSNAMES } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';

const TOOLSET_ICON_CONFIG = {
  size: 14,
  className: 'flex-shrink-0',
  builtinClassName: '!w-3.5 !h-3.5',
} as const;

function renderNodeIcon(source: MentionItemSource, variableType: string, nodeAttrs: any) {
  if (source === 'variables') {
    return <X size={12} className="flex-shrink-0" />;
  }
  if (source === 'agents') {
    return <NodeIcon type="skillResponse" small filled={false} className="!w-3.5 !h-3.5" />;
  }
  if (source === 'files' || source === 'products') {
    const filename = nodeAttrs?.label as string;
    return (
      <NodeIcon type="file" small filled={false} filename={filename} className="!w-3.5 !h-3.5" />
    );
  }
  if (source === 'toolsets' || source === 'tools') {
    return (
      <ToolsetIcon
        toolsetKey={nodeAttrs?.id}
        toolset={nodeAttrs?.toolset}
        config={TOOLSET_ICON_CONFIG}
      />
    );
  }
  const nodeType = variableType || 'document';
  return (
    <NodeIcon type={nodeType as CanvasNodeType} small filled={false} className="!w-3.5 !h-3.5" />
  );
}

const getMentionClassName = (source: MentionItemSource) => {
  if (source === 'variables') {
    return AGENT_CONFIG_KEY_CLASSNAMES.inputs;
  }
  if (source === 'toolsets' || source === 'tools') {
    return AGENT_CONFIG_KEY_CLASSNAMES.tools;
  }
  if (source === 'files' || source === 'products') {
    return AGENT_CONFIG_KEY_CLASSNAMES.files;
  }
  if (source === 'agents') {
    return AGENT_CONFIG_KEY_CLASSNAMES.agents;
  }
  return '';
};

function MentionNodeViewBase(props: NodeViewProps) {
  const { node } = props;
  const labelText = (node?.attrs?.label as string) ?? (node?.attrs?.id as string) ?? '';
  const source = node?.attrs?.source as MentionItemSource;
  const variableType = node?.attrs?.variableType as string;

  return (
    <NodeViewWrapper
      as="span"
      className={cn('mention', getMentionClassName(source))}
      contentEditable={false}
      draggable={false}
      data-mention="true"
      spellCheck={false}
    >
      <span className="mention-icon" aria-hidden="true">
        {renderNodeIcon(source, variableType, node?.attrs ?? {})}
      </span>
      <span className="mention-text" aria-hidden="true">
        {labelText}
      </span>
    </NodeViewWrapper>
  );
}

// Export a memoized component to avoid unnecessary re-renders
const MentionNodeView = React.memo(MentionNodeViewBase);

export default MentionNodeView;
