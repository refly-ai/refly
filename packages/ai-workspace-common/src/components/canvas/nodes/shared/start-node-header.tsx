import { Button } from 'antd';
import { memo } from 'react';
import { Close } from 'refly-icons';
import { NodeHeader } from './node-header';
import { useTranslation } from 'react-i18next';

interface StartNodeHeaderProps {
  source?: 'preview' | 'node';
  className?: string;
  // Custom actions for preview mode (e.g., close button)
  actions?: React.ReactNode;
  onClose?: () => void;
}

/**
 * Shared header component for Start nodes
 * Encapsulates common NodeHeader logic for both canvas node and preview
 *
 * @param source - 'node' for canvas node, 'preview' for preview panel
 * @param actions - Custom actions (e.g., close button for preview)
 * @param onClose - Close handler for preview mode
 */
export const StartNodeHeader = memo(
  ({ source = 'node', className, actions, onClose }: StartNodeHeaderProps) => {
    const { t } = useTranslation();

    // Default close button for preview mode
    const defaultPreviewActions = onClose ? (
      <Button type="text" icon={<Close size={20} />} onClick={onClose} />
    ) : null;

    return (
      <NodeHeader
        nodeType="start"
        fixedTitle={t('canvas.workflow.userInput')}
        title=""
        iconFilled={true}
        className={className}
        actions={source === 'preview' ? actions || defaultPreviewActions : undefined}
      />
    );
  },
);

StartNodeHeader.displayName = 'StartNodeHeader';
