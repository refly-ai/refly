import { memo, useCallback } from 'react';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { NodeHeader } from './node-header';

interface SkillResponseNodeHeaderProps {
  nodeId: string;
  entityId: string;
  title: string;
  readonly?: boolean;
  source?: 'preview' | 'node';
  className?: string;
  // Custom actions (e.g., Play button, More button)
  actions?: React.ReactNode;
}

/**
 * Shared header component for SkillResponse nodes
 * Encapsulates common NodeHeader logic for title editing
 *
 * @param actions - Custom actions to display in the header (e.g., Play button, More button)
 */
export const SkillResponseNodeHeader = memo(
  ({
    nodeId,
    entityId,
    title,
    readonly = false,
    source = 'node',
    className,
    actions,
  }: SkillResponseNodeHeaderProps) => {
    const updateNodeTitle = useUpdateNodeTitle();

    const onTitleChange = useCallback(
      (newTitle: string) => {
        if (newTitle === title) {
          return;
        }
        updateNodeTitle(newTitle, entityId, nodeId, 'skillResponse');
      },
      [title, entityId, nodeId, updateNodeTitle],
    );

    return (
      <NodeHeader
        nodeType="skillResponse"
        title={title}
        canEdit={true}
        disabled={readonly}
        updateTitle={onTitleChange}
        source={source === 'preview' ? 'skillResponsePreview' : 'node'}
        className={className}
        actions={actions}
      />
    );
  },
);

SkillResponseNodeHeader.displayName = 'SkillResponseNodeHeader';
