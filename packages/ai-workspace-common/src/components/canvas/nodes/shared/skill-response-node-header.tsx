import { memo, useCallback } from 'react';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { NodeHeader } from './node-header';
import { useTranslation } from 'react-i18next';

interface SkillResponseNodeHeaderProps {
  nodeId: string;
  entityId: string;
  title: string;
  source?: 'preview' | 'node';
  className?: string;
  // Custom actions (e.g., Play button, More button)
  actions?: React.ReactNode;
  canEdit?: boolean;
  iconSize?: number;
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
    source = 'node',
    className,
    actions,
    canEdit,
    iconSize = 16,
  }: SkillResponseNodeHeaderProps) => {
    const { t } = useTranslation();
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
        fixedTitle={t('canvas.nodeTypes.agent')}
        placeholder={t('agent.editTitlePlaceholder')}
        canEdit={canEdit}
        updateTitle={onTitleChange}
        source={source === 'preview' ? 'skillResponsePreview' : 'node'}
        className={className}
        actions={actions}
        iconSize={iconSize}
        maxLength={200}
      />
    );
  },
);

SkillResponseNodeHeader.displayName = 'SkillResponseNodeHeader';
