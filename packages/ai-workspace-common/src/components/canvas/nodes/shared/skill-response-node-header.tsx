import { Button } from 'antd';
import { memo, useCallback } from 'react';
import { Play } from 'refly-icons';
import {
  createNodeEventName,
  nodeActionEmitter,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { NodeHeader } from './node-header';

interface SkillResponseNodeHeaderProps {
  nodeId: string;
  entityId: string;
  title: string;
  readonly?: boolean;
  source?: 'preview' | 'node';
  className?: string;
  // Custom actions to replace default Play and More buttons
  actions?: React.ReactNode;
}

/**
 * Shared header component for SkillResponse nodes
 * Encapsulates common NodeHeader logic with default Play and More action buttons
 *
 * @param actions - Custom actions to replace default Play and More buttons.
 *                  If not provided, default Play and More buttons will be used.
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

    const handleRerunClick = useCallback(() => {
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'rerun'));
    }, [nodeId]);

    const defaultActions = (
      <Button
        type="text"
        size="small"
        icon={<Play size={12} />}
        onClick={handleRerunClick}
        className="h-6 p-0 flex items-center justify-center hover:!bg-refly-tertiary-hover"
      />
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
        actions={
          <>
            {defaultActions}
            {actions}
          </>
        }
      />
    );
  },
);

SkillResponseNodeHeader.displayName = 'SkillResponseNodeHeader';
