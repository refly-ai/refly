import { useCallback } from 'react';
import { ActionResult } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { Button, message } from 'antd';
import { Subscription } from 'refly-icons';
import { logEvent } from '@refly/telemetry-web';
import { IconError, IconRerun } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useSkillError } from '@refly-packages/ai-workspace-common/hooks/use-skill-error';
import { guessModelProviderError, ModelUsageQuotaExceeded } from '@refly/errors';
import { useGetCreditBalance } from '@refly-packages/ai-workspace-common/queries';
import { useActionResultStoreShallow, useSubscriptionStoreShallow } from '@refly/stores';

interface FailureNoticeProps {
  result: ActionResult;
  handleRetry: () => void;
}

export const FailureNotice = ({ result, handleRetry }: FailureNoticeProps) => {
  const { t } = useTranslation();
  const { resultId } = result;
  const { errCode, errMsg, rawError } = useSkillError(result?.errors?.[0] ?? '');

  const { traceId } = useActionResultStoreShallow((state) => ({
    traceId: state.traceIdMap[resultId],
  }));
  const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
  }));

  const error = guessModelProviderError(result?.errors?.[0] ?? '');

  const errDescription = t('canvas.skillResponse.error.description', {
    errCode,
    errMsg,
    rawError,
  });

  const { data: balanceData, isSuccess: isBalanceSuccess } = useGetCreditBalance();
  const creditBalance = balanceData?.data?.creditBalance ?? 0;

  const handleSubscriptionClick = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setSubscribeModalVisible(true);

      logEvent('subscription::upgrade_click', 'skill_invoke');
    },
    [setSubscribeModalVisible],
  );

  return (
    <div
      className="mt-2 flex flex-col gap-2 border border-solid border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-md"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="font-medium text-sm flex items-center gap-2">
            <IconError className="flex items-center justify-center text-yellow-500 flex-shrink-0" />
            {t('canvas.skillResponse.error.defaultTitle')}
          </div>
          {errCode && (
            <div className="space-y-2">
              <p className="text-gray-700 dark:text-gray-200 text-xs break-words">
                {errDescription}
              </p>
              {traceId && (
                <p className="text-gray-500 dark:text-gray-400 text-xs break-all">
                  Trace ID: {traceId}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="text"
          size="small"
          className="text-xs"
          onClick={() => {
            if (errCode) {
              navigator.clipboard.writeText(`${errDescription}\nTrace ID: ${traceId}`);
              message.success(t('components.markdown.copySuccess'));
            }
          }}
        >
          {t('common.copyRequestInfo')}
        </Button>
        {error instanceof ModelUsageQuotaExceeded && creditBalance <= 0 && isBalanceSuccess ? (
          <Button
            type="primary"
            size="small"
            className="text-xs flex items-center justify-center"
            icon={
              <Subscription
                size={13}
                className="text-[#1C1F23] dark:text-white text-xs flex items-center justify-center"
              />
            }
            onClick={handleSubscriptionClick}
          >
            {t('canvas.nodeActions.upgrade')}
          </Button>
        ) : (
          <Button
            type="primary"
            size="small"
            className="text-xs"
            icon={<IconRerun className="text-xs flex items-center justify-center" />}
            onClick={handleRetry}
          >
            {t('canvas.nodeActions.rerun')}
          </Button>
        )}
      </div>
    </div>
  );
};
