import { Badge, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TemplateGenerationStatus } from '../../utils/templateStatus';
import { memo } from 'react';

interface TemplateStatusBadgeProps {
  status: TemplateGenerationStatus;
  className?: string;
  onSwitchToEditor?: () => void;
}

/**
 * Badge component to display template generation status in the top-right corner
 * Uses Ant Design Badge component
 */
export const TemplateStatusBadge = memo<TemplateStatusBadgeProps>(
  ({ status, className, onSwitchToEditor }) => {
    const { t } = useTranslation();

    // Get badge configuration based on status
    const getBadgeConfig = (): {
      status?: 'success' | 'processing' | 'error' | 'warning' | 'default';
      dot?: boolean;
      title?: string;
    } => {
      switch (status) {
        case 'pending':
        case 'generating':
          return {
            status: 'processing',
            dot: true,
            title:
              status === 'pending'
                ? t('canvas.workflow.template.pending') || '模板生成已排队，请稍候...'
                : t('canvas.workflow.template.generating') || '正在生成模板内容，请稍候...',
          };
        case 'completed':
          return {
            status: 'success',
            dot: true,
            title: t('canvas.workflow.template.completed') || '模板内容已生成！',
          };
        case 'failed':
          return {
            status: 'error',
            dot: true,
            title: t('canvas.workflow.template.failed') || '模板生成失败，请稍后重试',
          };
        default:
          return {};
      }
    };

    const badgeConfig = getBadgeConfig();

    if (!badgeConfig.status && !badgeConfig.dot) {
      return null;
    }

    const { title, ...badgeProps } = badgeConfig;

    // Badge needs to wrap an element to display in top-right corner
    // Position the badge dot in the top-right corner with proper offset
    const badgeElement = (
      <div className="absolute top-2 right-2">
        <Badge {...badgeProps} className={className} offset={[0, 0]}>
          <div className="w-1 h-1 opacity-0" />
        </Badge>
      </div>
    );

    // If completed and has switch handler, make it clickable
    if (status === 'completed' && onSwitchToEditor) {
      const tooltipTitle = title
        ? `${title} (${t('canvas.workflow.template.clickToSwitch') || '点击切换到编辑器'})`
        : t('canvas.workflow.template.clickToSwitch') || '点击切换到编辑器';

      return (
        <Tooltip title={tooltipTitle}>
          <div
            className="absolute top-2 right-2 cursor-pointer hover:opacity-80 transition-opacity z-10 border-none bg-transparent p-0"
            onClick={onSwitchToEditor}
            aria-label={tooltipTitle}
          >
            <Badge {...badgeProps} className={className} offset={[0, 0]}>
              <div className="w-1 h-1 opacity-0" />
            </Badge>
          </div>
        </Tooltip>
      );
    }

    return <Tooltip title={title}>{badgeElement}</Tooltip>;
  },
);

TemplateStatusBadge.displayName = 'TemplateStatusBadge';
