import { useCallback } from 'react';
import { ActionResult } from '@refly/openapi-schema';
import { logEvent } from '@refly/telemetry-web';
import { useSkillError } from '@refly-packages/ai-workspace-common/hooks/use-skill-error';
import { useUserMembership } from '@refly-packages/ai-workspace-common/hooks/use-user-membership';
import { guessModelProviderError, ModelUsageQuotaExceeded } from '@refly/errors';
import { useGetCreditBalance } from '@refly-packages/ai-workspace-common/queries';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { ErrorNotice } from '@refly-packages/ai-workspace-common/components/common/error-notice';
import { classifyExecutionError } from '@refly-packages/ai-workspace-common/utils/error-classification';

interface FailureNoticeProps {
  result: ActionResult;
  handleRetry?: () => void;
}

export const FailureNotice = ({ result, handleRetry }: FailureNoticeProps) => {
  const { errCode } = useSkillError(result?.errors?.[0] ?? '');
  const { displayName } = useUserMembership();

  const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
  }));

  const error = guessModelProviderError(result?.errors?.[0] ?? '');

  const { data: balanceData, isSuccess: isBalanceSuccess } = useGetCreditBalance();
  const creditBalance = balanceData?.data?.creditBalance ?? 0;

  const handleSubscriptionClick = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setSubscribeModalVisible(true, 'canvas');

      logEvent('subscription::upgrade_click', 'skill_invoke');
    },
    [setSubscribeModalVisible],
  );

  // Check if this is a user abort (default to systemError if undefined)
  const effectiveErrorType = result?.errorType || 'systemError';
  const isUserAbort = effectiveErrorType === 'userAbort';

  // If user aborted, show user abort notice
  if (isUserAbort) {
    return (
      <ErrorNotice
        result={result}
        errorType="userAbort"
        trackingContext="skill_invoke"
        className="mt-2"
      />
    );
  }

  // Check if this is a classifiable execution error
  const failureType = classifyExecutionError(error, errCode);

  // Check if this is a credit insufficient error
  const isCreditInsufficient =
    error instanceof ModelUsageQuotaExceeded && creditBalance <= 0 && isBalanceSuccess;

  if (isCreditInsufficient) {
    return (
      <ErrorNotice
        result={result}
        errorType="creditInsufficient"
        membershipLevel={displayName}
        onUpgradeClick={handleSubscriptionClick}
        trackingContext="skill_invoke"
        className="mt-2"
      />
    );
  }

  // Handle execution failures - map FailureType to ErrorNoticeType
  if (failureType) {
    const errorNoticeType = (() => {
      switch (failureType) {
        case 'modelCall':
          return 'modelCallFailure';
        case 'toolCall':
          return 'toolCallFailure';
        case 'multimodal':
          return 'multimodalFailure';
        default:
          return 'modelCallFailure'; // fallback
      }
    })();

    return (
      <ErrorNotice
        result={result}
        errorType={errorNoticeType}
        onRetryClick={handleRetry}
        trackingContext="skill_invoke"
      />
    );
  }
};
