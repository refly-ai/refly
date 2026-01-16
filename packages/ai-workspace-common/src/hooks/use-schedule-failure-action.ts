import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import { useSubscriptionStoreShallow } from '@refly/stores';

/**
 * Schedule execution failure reasons
 * Used for frontend display and error tracking
 */
export enum ScheduleFailureReason {
  /** 积分不足 - 用户需要充值 */
  INSUFFICIENT_CREDITS = 'insufficient_credits',

  /** 超出订阅套餐的定时数量限额 */
  SCHEDULE_LIMIT_EXCEEDED = 'schedule_limit_exceeded',

  /** 用户并发执行数量超限 */
  USER_RATE_LIMITED = 'user_rate_limited',

  /** Schedule 被删除 */
  SCHEDULE_DELETED = 'schedule_deleted',

  /** Schedule 被禁用 */
  SCHEDULE_DISABLED = 'schedule_disabled',

  /** Cron 表达式无效 */
  INVALID_CRON_EXPRESSION = 'invalid_cron_expression',

  /** Canvas 数据异常（节点/边缺失） */
  CANVAS_DATA_ERROR = 'canvas_data_error',

  /** Snapshot 创建或加载失败 */
  SNAPSHOT_ERROR = 'snapshot_error',

  /** 工作流执行过程失败 */
  WORKFLOW_EXECUTION_FAILED = 'workflow_execution_failed',

  /** 其他未知错误 */
  UNKNOWN_ERROR = 'unknown_error',
}

export type FailureActionType = 'upgrade' | 'viewSchedule' | 'buyCredits' | 'fixWorkflow';

/**
 * Pre-check failure reasons - these failures happen before actual workflow execution,
 * so there's no detail page to view
 */
export const PRE_CHECK_FAILURE_REASONS = [
  ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED,
  ScheduleFailureReason.USER_RATE_LIMITED,
  ScheduleFailureReason.INSUFFICIENT_CREDITS,
  ScheduleFailureReason.SCHEDULE_DELETED,
  ScheduleFailureReason.SCHEDULE_DISABLED,
];

/**
 * Check if the failure reason is a pre-check failure (no actual execution happened)
 */
export const isPreCheckFailure = (failureReason: string | undefined): boolean => {
  if (!failureReason) return false;
  return PRE_CHECK_FAILURE_REASONS.includes(failureReason as ScheduleFailureReason);
};

export interface FailureActionConfig {
  label: string;
  isDark: boolean;
  actionType: FailureActionType;
}

// Get action config based on failure reason and plan type
export const getFailureActionConfig = (
  failureReason: string | undefined,
  planType: string,
  t: (key: string) => string,
): FailureActionConfig | null => {
  if (!failureReason) return null;

  const isFree = planType === 'free';

  switch (failureReason) {
    // 数量超限制
    case ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED:
    case ScheduleFailureReason.USER_RATE_LIMITED:
      return isFree
        ? {
            label: t('runDetail.failureActions.upgrade'),
            isDark: true,
            actionType: 'upgrade',
          }
        : {
            label: t('runDetail.failureActions.viewSchedule'),
            isDark: false,
            actionType: 'viewSchedule',
          };

    // 积分不足
    case ScheduleFailureReason.INSUFFICIENT_CREDITS:
      return isFree
        ? {
            label: t('runDetail.failureActions.upgrade'),
            isDark: true,
            actionType: 'upgrade',
          }
        : {
            label: t('runDetail.failureActions.buyCredits'),
            isDark: true,
            actionType: 'buyCredits',
          };
    default:
      return {
        label: t('runDetail.failureActions.fixWorkflow'),
        isDark: false,
        actionType: 'fixWorkflow',
      };
  }
};

// Get failure reason display text
export const getFailureReasonText = (
  failureReason: string | undefined,
  t: (key: string) => string,
): string => {
  if (!failureReason) return '';

  switch (failureReason) {
    case ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED:
    case ScheduleFailureReason.USER_RATE_LIMITED:
      return t('runDetail.failureReasons.scheduleLimited');
    case ScheduleFailureReason.INSUFFICIENT_CREDITS:
      return t('runDetail.failureReasons.insufficientCredits');
    default:
      return t('runDetail.failureReasons.runFailed');
  }
};

// Hook for handling failure actions
export const useScheduleFailureAction = (canvasId: string) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { planType, setCreditInsufficientModalVisible } = useSubscriptionStoreShallow((state) => ({
    planType: state.planType,
    setCreditInsufficientModalVisible: state.setCreditInsufficientModalVisible,
  }));

  const getActionConfig = useCallback(
    (failureReason: string | undefined) => {
      return getFailureActionConfig(failureReason, planType, t);
    },
    [planType, t],
  );

  const getReasonText = useCallback(
    (failureReason: string | undefined) => {
      return getFailureReasonText(failureReason, t);
    },
    [t],
  );

  const handleAction = useCallback(
    (actionType: FailureActionType) => {
      switch (actionType) {
        case 'upgrade':
        case 'buyCredits':
          setCreditInsufficientModalVisible(true, undefined, 'canvas');
          break;
        case 'viewSchedule':
        case 'fixWorkflow':
          navigate(`/workflow/${canvasId}`);
          break;
      }
    },
    [setCreditInsufficientModalVisible, navigate, canvasId],
  );

  return {
    planType,
    getActionConfig,
    getReasonText,
    handleAction,
  };
};
