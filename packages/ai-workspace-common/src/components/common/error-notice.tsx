import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, message } from 'antd';
import { logEvent } from '@refly/telemetry-web';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { Close, Refresh, Copy } from 'refly-icons';
import { ActionResult } from '@refly/openapi-schema';

export type ErrorNoticeType =
  | 'creditInsufficient'
  | 'modelCallFailure'
  | 'toolCallFailure'
  | 'multimodalFailure'
  | 'userAbort';

interface BaseErrorNoticeProps {
  /** Result data */
  result: ActionResult;
  /** Type of error notice to determine the appropriate message and actions */
  errorType: ErrorNoticeType;
  /** Custom title text, if not provided will use default translation */
  title?: string;
  /** Custom description text, if not provided will use default translation */
  description?: string;
  /** Event tracking context for analytics */
  trackingContext?: string;
  /** Additional CSS classes for customization */
  className?: string;
}

interface CreditInsufficientProps extends BaseErrorNoticeProps {
  errorType: 'creditInsufficient';
  /** User's membership level to display in the message */
  membershipLevel?: string;
  /** Custom upgrade button text, if not provided will use default translation */
  upgradeButtonText?: string;
  /** Custom click handler for upgrade button */
  onUpgradeClick?: () => void;
}

interface ExecutionFailureProps extends BaseErrorNoticeProps {
  errorType: 'modelCallFailure' | 'toolCallFailure' | 'multimodalFailure';
  /** Custom retry button text, if not provided will use default translation */
  retryButtonText?: string;
  /** Custom click handler for retry button */
  onRetryClick?: () => void;
}

interface UserAbortProps extends BaseErrorNoticeProps {
  errorType: 'userAbort';
}

type ErrorNoticeProps = CreditInsufficientProps | ExecutionFailureProps | UserAbortProps;

/**
 * Error Notice Component
 *
 * A reusable component that displays different types of error notices including
 * credit insufficient and execution failure notices. Follows the Figma design
 * specifications with proper styling and internationalization.
 */
export const ErrorNotice: React.FC<ErrorNoticeProps> = React.memo((props) => {
  const {
    result,
    errorType,
    title,
    description,
    trackingContext = 'error_notice',
    className = '',
  } = props;
  const { t } = useTranslation();
  const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
  }));

  // Get appropriate translations based on error type
  const getTranslationKey = (key: string) => {
    const typeMap = {
      creditInsufficient: 'creditInsufficient',
      modelCallFailure: 'modelCallFailure',
      toolCallFailure: 'toolCallFailure',
      multimodalFailure: 'multimodalFailure',
      userAbort: 'userAbort',
    };
    return `canvas.skillResponse.${typeMap[errorType]}.${key}`;
  };

  const displayTitle = title || t(getTranslationKey('title'));
  const displayDescription =
    description ||
    (() => {
      if (errorType === 'creditInsufficient') {
        const membershipLevel = 'membershipLevel' in props ? props.membershipLevel : '免费用户';
        return t(getTranslationKey('description'), { membershipLevel });
      }
      return t(getTranslationKey('description'));
    })();

  const handleUpgradeClick = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();

      if (errorType === 'creditInsufficient' && 'onUpgradeClick' in props) {
        if (props.onUpgradeClick) {
          props.onUpgradeClick();
        } else {
          setSubscribeModalVisible(true);
        }
        logEvent('subscription::upgrade_click', trackingContext);
      }
    },
    [errorType, props, setSubscribeModalVisible, trackingContext],
  );

  const handleRetryClick = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();

      if (errorType !== 'creditInsufficient' && 'onRetryClick' in props && props.onRetryClick) {
        props.onRetryClick();
        logEvent('execution::retry_click', `${trackingContext}_${errorType}`);
      }
    },
    [errorType, props, trackingContext],
  );

  const handleCopyResultId = useCallback(
    async (e?: React.MouseEvent) => {
      e?.stopPropagation();

      try {
        await navigator.clipboard.writeText(result.resultId);
        message.success(t('common.copySuccess', { defaultValue: 'Copied to clipboard' }));
      } catch (error) {
        console.error('Failed to copy result ID:', error);
        message.error(t('common.copyFailed', { defaultValue: 'Failed to copy' }));
      }
    },
    [result.resultId, t],
  );

  const renderButton = () => {
    if (errorType === 'creditInsufficient') {
      const upgradeButtonText = 'upgradeButtonText' in props ? props.upgradeButtonText : undefined;
      const displayUpgradeText = upgradeButtonText || t(getTranslationKey('upgradeButton'));

      return (
        <Button
          size="small"
          className="text-sm font-semibold h-8 bg-white dark:bg-gray-800 text-[#0E9F77] dark:text-green-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 leading-[1.429]"
          onClick={handleUpgradeClick}
        >
          {displayUpgradeText}
        </Button>
      );
    } else if (errorType === 'userAbort') {
      // No button for user abort
      return null;
    } else {
      return (
        <Refresh
          className="text-refly-text-0 cursor-pointer"
          size={22}
          onClick={handleRetryClick}
        />
      );
    }
  };

  // Determine styles based on error type
  const isWarning = errorType === 'userAbort';
  const bgColor = isWarning
    ? 'bg-[#FFFBE6] dark:bg-yellow-950/20'
    : 'bg-[#FFEFED] dark:bg-red-950/20';
  const iconBgColor = isWarning
    ? 'bg-[#faad14] dark:bg-yellow-500'
    : 'bg-[#F93920] dark:bg-red-500';

  return (
    <div
      className={`flex items-center gap-2 border border-solid border-black/10 dark:border-white/10 ${bgColor} px-4 py-3 rounded-xl font-['PingFang_SC','-apple-system','BlinkMacSystemFont','sans-serif'] ${className}`}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {/* Left side: Icon and Content */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {/* Title Row with Icon */}
        <div className="flex items-center gap-2">
          {/* Error/Warning Icon */}
          <div
            className={`flex items-center justify-center p-0.5 ${iconBgColor} rounded-full flex-shrink-0`}
          >
            <Close size={12} color="white" />
          </div>
          {/* Title */}
          <div className="text-base font-semibold text-[#1C1F23] dark:text-gray-100 leading-[1.625]">
            {displayTitle}
          </div>
        </div>

        {/* Description */}
        <div className="text-sm font-normal text-[#1C1F23] dark:text-gray-200 leading-[1.429] pl-6">
          {displayDescription}
        </div>

        <div className="flex items-center gap-1 text-xs font-normal text-gray-500 dark:text-gray-100 leading-[1.429] pl-6 pt-1">
          <span>{t('common.errorNotice.resultId', { resultId: result.resultId })}</span>
          <Copy
            size={14}
            className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            onClick={handleCopyResultId}
          />
        </div>
      </div>

      {/* Right side: Action Button */}
      <div className="flex items-center justify-center flex-shrink-0 pl-2">{renderButton()}</div>
    </div>
  );
});

ErrorNotice.displayName = 'ErrorNotice';
