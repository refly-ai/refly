import { Badge, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TemplateGenerationStatus } from '../../utils/templateStatus';
import { memo, useEffect } from 'react';

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
                ? t('canvas.workflow.template.pending')
                : t('canvas.workflow.template.generating'),
          };
        case 'completed':
          return {
            status: 'success',
            dot: true,
            title: t('canvas.workflow.template.completed'),
          };
        case 'failed':
          return {
            status: 'error',
            dot: true,
            title: t('canvas.workflow.template.failed'),
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
    // Use a larger invisible element to ensure hover area is sufficient for tooltip
    const badgeContent = (
      <Badge {...badgeProps} className={className} offset={[0, -2]}>
        <div className="w-4 h-4 opacity-0 pointer-events-none" />
      </Badge>
    );

    // Add ripple animation style once
    useEffect(() => {
      const styleId = 'template-status-ripple-animation';
      if (document.getElementById(styleId)) {
        return;
      }

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes template-status-ripple {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(2.5);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);

      return () => {
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
          document.head.removeChild(existingStyle);
        }
      };
    }, []);

    // Ripple effect wrapper for completed status
    const RippleWrapper = ({ children }: { children: React.ReactNode }) => {
      if (status !== 'completed') {
        return <>{children}</>;
      }

      return (
        <div className="relative inline-block">
          {children}
          <span
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[#12B76A]"
            style={{
              animation: 'template-status-ripple 2s ease-out infinite',
              opacity: 0,
            }}
          />
        </div>
      );
    };

    // If completed and has switch handler, make it clickable
    if (status === 'completed' && onSwitchToEditor) {
      const tooltipTitle = title
        ? `${title} (${t('canvas.workflow.template.clickToSwitch')})`
        : t('canvas.workflow.template.clickToSwitch');

      return (
        <Tooltip title={tooltipTitle}>
          <div
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity z-10 border-none bg-transparent leading-[4px]"
            onClick={onSwitchToEditor}
            aria-label={tooltipTitle}
          >
            <RippleWrapper>{badgeContent}</RippleWrapper>
          </div>
        </Tooltip>
      );
    }

    // Ensure tooltip is shown for all statuses with title
    // Wrap the badge element in a container with sufficient hover area
    return (
      <Tooltip title={title || undefined}>
        <div className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center leading-[4px]">
          <RippleWrapper>{badgeContent}</RippleWrapper>
        </div>
      </Tooltip>
    );
  },
);

TemplateStatusBadge.displayName = 'TemplateStatusBadge';
