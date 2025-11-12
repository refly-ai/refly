import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { getVariableIcon } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/getVariableIcon';
import type { CanvasNodeType } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';

const TOOLSET_ICON_CONFIG = {
  size: 14,
  className: 'flex-shrink-0',
  builtinClassName: '!w-3.5 !h-3.5',
} as const;

function renderNodeIcon(source: string, variableType: string, nodeAttrs: any) {
  if (source === 'variables') {
    return getVariableIcon(variableType);
  }
  if (source === 'stepRecord') {
    return (
      <NodeIcon
        type={'skillResponse' as CanvasNodeType}
        small
        filled={false}
        className="!w-3.5 !h-3.5"
      />
    );
  }
  if (source === 'resultRecord' || source === 'myUpload') {
    const nodeType = variableType || 'document';
    return (
      <NodeIcon
        type={nodeType as CanvasNodeType}
        small
        filled={false}
        url={nodeType === 'image' ? (nodeAttrs?.url ?? undefined) : undefined}
        resourceType={nodeAttrs?.resourceType}
        resourceMeta={nodeAttrs?.resourceMeta}
        className="!w-3.5 !h-3.5"
      />
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

function MentionNodeViewBase(props: NodeViewProps) {
  const { node } = props;
  const labelText = (node?.attrs?.label as string) ?? (node?.attrs?.id as string) ?? '';
  const source = (node?.attrs?.source as string) ?? '';
  const variableType = (node?.attrs?.variableType as string) ?? source ?? '';

  return (
    <NodeViewWrapper
      as="span"
      className="mention"
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
