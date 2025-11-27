import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { Button, Table, Segmented } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import {
  useSubscriptionStoreShallow,
  useUserStoreShallow,
  useSiderStoreShallow,
} from '@refly/stores';
import {
  useGetCreditBalance,
  useGetCreditUsage,
  useGetCreditRecharge,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { logEvent } from '@refly/telemetry-web';

// styles
import './index.scss';
import { ContentHeader } from '@refly-packages/ai-workspace-common/components/settings/contentHeader';
import { Subscription as SubscriptionIcon } from 'refly-icons';
import RegularIcon from '@refly-packages/ai-workspace-common/assets/regular.svg';
import CommissionIcon from '@refly-packages/ai-workspace-common/assets/commission.svg';

// Define interfaces for the table data
interface CreditUsageRecord {
  usageId: string;
  description?: string;
  createdAt: string;
  amount: number;
  title?: string;
  shareId?: string;
}

interface CreditRechargeRecord {
  rechargeId: string;
  description?: string;
  source: string;
  createdAt: string;
  expiresAt: string;
  amount: number;
  balance: number;
  enabled: boolean;
  title?: string;
  shareId?: string;
}

// Define pagination interface
interface PaginationState {
  page: number;
  pageSize: number;
}

// Component to handle commission source display with app name
const CommissionSourceCell = React.memo(({ record }: { record: CreditRechargeRecord }) => {
  const { t } = useTranslation('ui');
  const { setShowSettingModal } = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
  }));

  const handleAppNameClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (record.shareId) {
        // Close settings modal before navigation
        setShowSettingModal(false);
        window.open(`/app/${record.shareId}`, '_blank');
      }
    },
    [record.shareId, setShowSettingModal],
  );

  const appName = record.title ?? t('subscription.subscriptionManagement.rechargeType.commission');

  return (
    <span className="inline-block max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap align-bottom">
      {t('subscription.subscriptionManagement.rechargeType.commissionPrefix')}
      {record.shareId ? (
        <span
          className="cursor-pointer underline hover:text-blue-600 dark:hover:text-blue-400"
          onClick={handleAppNameClick}
        >
          {appName}
        </span>
      ) : (
        appName
      )}
    </span>
  );
});

// Component to handle commission usage display with app name
const CommissionUsageCell = React.memo(({ record }: { record: CreditUsageRecord }) => {
  const { t } = useTranslation('ui');
  const { setShowSettingModal } = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
  }));

  const handleAppNameClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (record.shareId) {
        // Close settings modal before navigation
        setShowSettingModal(false);
        window.open(`/app/${record.shareId}`, '_blank');
      }
    },
    [record.shareId, setShowSettingModal],
  );

  const appName = record.title ?? t('subscription.subscriptionManagement.rechargeType.commission');

  return (
    <span className="inline-block max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap align-bottom">
      {t('subscription.subscriptionManagement.usageType.commissionPrefix')}
      {record.shareId ? (
        <span
          className="cursor-pointer underline hover:text-blue-600 dark:hover:text-blue-400"
          onClick={handleAppNameClick}
        >
          {appName}
        </span>
      ) : (
        appName
      )}
    </span>
  );
});

export const Subscription = () => {
  const { t } = useTranslation('ui');
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  // State to hold the subscription data for display, defaults to real data
  const [displaySubscription, setDisplaySubscription] = useState(userProfile?.subscription);

  // Pagination state
  const [usagePagination, setUsagePagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
  });
  const [rechargePagination, setRechargePagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
  });

  // Update display subscription when real subscription data changes
  useEffect(() => {
    setDisplaySubscription(userProfile?.subscription);
  }, [userProfile?.subscription]);

  const { planType: subscriptionPlanType, cancelAt } = displaySubscription ?? {};

  const { setSubscribeModalVisible, setPlanType, planType, setOpenedFromSettings } =
    useSubscriptionStoreShallow((state) => ({
      setSubscribeModalVisible: state.setSubscribeModalVisible,
      setPlanType: state.setPlanType,
      planType: state.planType,
      setOpenedFromSettings: state.setOpenedFromSettings,
    }));

  const { setShowSettingModal } = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
  }));

  const { isUsageLoading } = useSubscriptionUsage();

  const { data: balanceData, isLoading: isBalanceLoading } = useGetCreditBalance();
  const creditBalance = balanceData?.data?.creditBalance ?? 0;
  const regularCredits = balanceData?.data?.regularCredits ?? 0;
  const templateEarningsCredits = balanceData?.data?.templateEarningsCredits ?? 0;

  // State for active history tab
  const [activeTab, setActiveTab] = useState<'usage' | 'recharge'>('usage');

  // Fetch credit history data with pagination
  const {
    data: usageData,
    isLoading: isUsageHistoryLoading,
    error: usageError,
    refetch: refetchUsage,
  } = useGetCreditUsage(
    {
      query: {
        page: usagePagination.page,
        pageSize: usagePagination.pageSize,
      },
    },
    [usagePagination.page, usagePagination.pageSize],
    { enabled: true },
  );
  const {
    data: rechargeData,
    isLoading: isRechargeHistoryLoading,
    error: rechargeError,
    refetch: refetchRecharge,
  } = useGetCreditRecharge(
    {
      query: {
        page: rechargePagination.page,
        pageSize: rechargePagination.pageSize,
      },
    },
    [rechargePagination.page, rechargePagination.pageSize],
    { enabled: true },
  );

  // Separate initial loading from pagination loading
  const isInitialLoading = isBalanceLoading || isUsageLoading;
  const isPaginationLoading =
    (activeTab === 'usage' && isUsageHistoryLoading) ||
    (activeTab === 'recharge' && isRechargeHistoryLoading);
  const isLoading = isInitialLoading || isPaginationLoading;

  // Error handling
  const currentError = activeTab === 'usage' ? usageError : rechargeError;
  const currentRefetch = activeTab === 'usage' ? refetchUsage : refetchRecharge;

  // Reset pagination when switching tabs
  useEffect(() => {
    if (activeTab === 'usage') {
      setUsagePagination({ page: 1, pageSize: 10 });
    } else {
      setRechargePagination({ page: 1, pageSize: 10 });
    }
  }, [activeTab]);

  useEffect(() => {
    if (displaySubscription?.planType) {
      setPlanType(displaySubscription.planType);
    }
  }, [displaySubscription?.planType, setPlanType]);

  const [portalLoading, setPortalLoading] = useState(false);

  const handleManageBilling = async () => {
    if (portalLoading) return;

    if (!userProfile?.customerId) {
      return;
    }

    setPortalLoading(true);
    try {
      const { data } = await getClient().createPortalSession();
      setPortalLoading(false);
      if (data?.data?.url) {
        window.open(data.data.url, '_blank');
      }
    } catch (error) {
      console.error('Failed to create portal session:', error);
      setPortalLoading(false);
    }
  };

  // Handle pagination change for usage table
  const handleUsagePaginationChange = useCallback(
    (page: number, pageSize: number) => {
      if (isUsageHistoryLoading) return; // Prevent multiple clicks during loading
      setUsagePagination({ page, pageSize });
    },
    [isUsageHistoryLoading],
  );

  // Handle pagination change for recharge table
  const handleRechargePaginationChange = useCallback(
    (page: number, pageSize: number) => {
      if (isRechargeHistoryLoading) return; // Prevent multiple clicks during loading
      setRechargePagination({ page, pageSize });
    },
    [isRechargeHistoryLoading],
  );

  // Get current data and pagination info
  const currentData = activeTab === 'usage' ? usageData?.data : rechargeData?.data;
  const currentPagination = activeTab === 'usage' ? usagePagination : rechargePagination;
  const currentTotal = currentData?.total ?? 0;
  // Keep current records during pagination loading to avoid flickering
  const currentRecords = currentData?.data ?? [];

  // Columns for Usage History Table
  const usageColumns: ColumnsType<CreditUsageRecord> = [
    {
      title: t('subscription.subscriptionManagement.usageDetails'),
      dataIndex: 'usageType',
      key: 'usageType',
      align: 'left',
      render: (value: string, record: CreditUsageRecord) => {
        if (value === 'commission') {
          return <CommissionUsageCell record={record} />;
        }
        const key = `subscription.subscriptionManagement.usageType.${value}`;
        return t(key);
      },
    },
    {
      title: t('subscription.subscriptionManagement.usageTime'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      align: 'left',
      render: (text) => (text ? dayjs(text).format('YYYY.MM.DD HH:mm:ss') : ''),
    },
    {
      title: t('subscription.subscriptionManagement.creditChange'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (amount) => `${amount > 0 ? '-' : ''}${amount.toLocaleString()}`,
    },
  ];

  // Columns for Recharge History Table
  const rechargeColumns: ColumnsType<CreditRechargeRecord> = [
    {
      title: t('subscription.subscriptionManagement.rechargeSource'),
      dataIndex: 'source',
      key: 'source',
      align: 'left',
      render: (source, record) => {
        if (source === 'commission') {
          return <CommissionSourceCell record={record} />;
        }

        const sourceMap: Record<string, string> = {
          purchase: t('subscription.subscriptionManagement.rechargeType.purchase'),
          gift: t('subscription.subscriptionManagement.rechargeType.gift'),
          promotion: t('subscription.subscriptionManagement.rechargeType.promotion'),
          refund: t('subscription.subscriptionManagement.rechargeType.refund'),
          subscription: t('subscription.subscriptionManagement.rechargeType.subscription'),
          invitation: t('subscription.subscriptionManagement.rechargeType.invitation'),
        };
        return sourceMap[source] || source;
      },
    },
    {
      title: t('subscription.subscriptionManagement.rechargeTime'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      align: 'left',
      render: (text) => (text ? dayjs(text).format('YYYY.MM.DD HH:mm:ss') : ''),
    },
    {
      title: t('subscription.subscriptionManagement.expiryDate'),
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      align: 'left',
      render: (text) => (text ? dayjs(text).format('YYYY.MM.DD') : '-'),
    },
    {
      title: t('subscription.subscriptionManagement.creditChange'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (amount) => `${amount > 0 ? '+' : ''}${amount.toLocaleString()}`,
    },
    {
      title: t('subscription.subscriptionManagement.remaining'),
      dataIndex: 'balance',
      key: 'balance',
      align: 'right',
      render: (balance) => balance.toLocaleString(),
    },
    {
      title: t('subscription.subscriptionManagement.status'),
      key: 'status',
      align: 'left',
      render: (_, record) => {
        if (!record.enabled) {
          return t('subscription.subscriptionManagement.disabled');
        }
        if (record.balance <= 0) {
          return t('subscription.subscriptionManagement.depleted');
        }
        const now = new Date();
        const expiryDate = new Date(record.expiresAt);
        if (expiryDate < now) {
          return t('subscription.subscriptionManagement.expired');
        }
        return t('subscription.subscriptionManagement.available');
      },
    },
  ];

  const handleClickSubscription = useCallback(() => {
    logEvent('subscription::upgrade_click', 'settings');
    setShowSettingModal(false);
    setOpenedFromSettings(true);
    setSubscribeModalVisible(true);
  }, [setSubscribeModalVisible, setShowSettingModal, setOpenedFromSettings]);

  const handleViewPricing = useCallback(() => {
    window.open('/pricing', '_blank');
  }, []);

  const PaidPlanCard = () => {
    return (
      <div className={`subscription-plan-card plan-${planType} w-full`}>
        <div className="plan-info w-full">
          <div className="current-plan-label">
            {t('subscription.subscriptionManagement.currentPlan')}
          </div>
          <div className="current-plan-name flex items-center w-full justify-between">
            {t(`subscription.plans.${planType}.title`)}{' '}
            <div className="flex items-center gap-3 plan-actions">
              <div className="plan-renewal-info">
                {cancelAt
                  ? `${dayjs(cancelAt).format('YYYY.MM.DD')} ${t('subscription.subscriptionManagement.willExpire')}`
                  : t('subscription.subscriptionManagement.willAutoRenew')}
              </div>
              <div
                className="cursor-pointer text-sm font-semibold leading-5 flex h-[var(--height-button\_default,32px)] [padding:var(--spacing-button\_default-paddingTop,6px)_var(--spacing-button\_default-paddingRight,12px)_var(--spacing-button\_default-paddingTop,6px)_var(--spacing-button\_default-paddingLeft,12px)] justify-center items-center border-[color:var(--border---refly-Card-Border,rgba(0,0,0,0.10))] [background:var(--tertiary---refly-tertiary-default,rgba(0,0,0,0.04))] hover:[background:var(--refly-tertiary-hover,#00000014)] rounded-lg border-0 border-solid transition-colors duration-200"
                onClick={handleManageBilling}
              >
                {portalLoading
                  ? t('common.loading')
                  : t('subscription.subscriptionManagement.viewBilling')}
              </div>
              {subscriptionPlanType === 'free' && !!userProfile?.customerId && (
                <Button
                  type="primary"
                  className="ant-btn-primary"
                  onClick={handleClickSubscription}
                >
                  {t('subscription.subscriptionManagement.changePlan')}
                </Button>
              )}
              <div
                className="cursor-pointer text-sm font-semibold leading-5 flex h-[var(--height-button\_default,32px)] [padding:var(--spacing-button\_default-paddingTop,6px)_var(--spacing-button\_default-paddingRight,12px)_var(--spacing-button\_default-paddingTop,6px)_var(--spacing-button\_default-paddingLeft,12px)] justify-center items-center border-[color:var(--border---refly-Card-Border,rgba(0,0,0,0.10))] [background:var(--tertiary---refly-tertiary-default,rgba(0,0,0,0.04))] hover:[background:var(--refly-tertiary-hover,#00000014)] rounded-lg border-0 border-solid transition-colors duration-200"
                onClick={handleViewPricing}
              >
                {t('subscription.subscriptionManagement.viewPricing')}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const FreePlanCard = () => (
    <div className="subscription-plan-card plan-free w-full">
      <div className="plan-info w-full">
        <div className="current-plan-label">
          {t('subscription.subscriptionManagement.currentPlan')}
        </div>

        <div className="current-plan-name flex items-center w-full justify-between">
          {t('subscription.subscriptionManagement.planNames.freePlan')}
          <Button
            type="primary"
            className="upgrade-button ant-btn-primary"
            onClick={() => {
              setShowSettingModal(false);
              setOpenedFromSettings(true);
              setSubscribeModalVisible(true);
            }}
          >
            {t('subscription.subscriptionManagement.upgradePlan')}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderPlanCard = () => {
    if (subscriptionPlanType && subscriptionPlanType !== 'free') {
      return <PaidPlanCard />;
    }
    return <FreePlanCard />;
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <ContentHeader title={t('subscription.subscriptionManagement.title')} />

      <div className="subscription-management-page">
        <div className="subscription-content">
          {isLoading ? (
            <Spin
              spinning={isLoading}
              style={{
                height: '100%',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          ) : (
            <>
              {renderPlanCard()}

              <div className="usage-section-wrapper">
                <div className="available-credits-section">
                  <div className="usage-label">
                    {t('subscription.subscriptionManagement.availableCredits')}
                  </div>

                  <div className="usage-value">
                    <SubscriptionIcon size={18} className="text-refly-text-2 flex-shrink-0" />
                    {creditBalance?.toLocaleString()}
                  </div>
                </div>

                <div className="usage-cards">
                  <div className="usage-card regular-credits-card flex items-center justify-between">
                    <div className="usage-content flex-1 p-4">
                      <div className="usage-label">
                        {t('subscription.subscriptionManagement.regularCredits')}
                      </div>
                      <div className="usage-value flex items-center gap-1">
                        {' '}
                        <SubscriptionIcon size={18} className="text-refly-text-2 flex-shrink-0" />
                        {regularCredits?.toLocaleString()}
                      </div>
                    </div>
                    <img src={RegularIcon} alt="Regular" className="w-[76px] h-[76px]" />
                  </div>

                  <div className="usage-card template-earnings-card flex items-center justify-between">
                    <div className="usage-content flex-1 p-4">
                      <div className="usage-label">
                        {t('subscription.subscriptionManagement.templateEarningsCredits')}
                      </div>
                      <div className="usage-value flex items-center gap-1">
                        <SubscriptionIcon size={18} className="text-refly-text-2 flex-shrink-0" />
                        {templateEarningsCredits?.toLocaleString()}
                      </div>
                    </div>
                    <img src={CommissionIcon} alt="Commission" className="w-[76px] h-[76px]" />
                  </div>
                </div>
              </div>
              <div className="points-history">
                <Segmented
                  options={[
                    {
                      label: t('subscription.subscriptionManagement.creditUsageDetails'),
                      value: 'usage',
                    },
                    {
                      label: t('subscription.subscriptionManagement.creditRechargeDetails'),
                      value: 'recharge',
                    },
                  ]}
                  value={activeTab}
                  onChange={(value) => setActiveTab(value as 'usage' | 'recharge')}
                  className="history-tabs"
                  size="large"
                />
                {currentError ? (
                  <div className="error-container p-4 text-center">
                    <div className="text-red-500 mb-2">
                      {t('common.error')}:{' '}
                      {(currentError as any)?.message || t('common.unknownError')}
                    </div>
                    <Button
                      type="primary"
                      onClick={() => currentRefetch()}
                      className="retry-button"
                    >
                      {t('common.retry')}
                    </Button>
                  </div>
                ) : (
                  <Table<any>
                    columns={activeTab === 'usage' ? usageColumns : rechargeColumns}
                    dataSource={currentRecords}
                    rowKey={activeTab === 'usage' ? 'usageId' : 'rechargeId'}
                    pagination={
                      currentTotal > currentPagination.pageSize
                        ? {
                            current: currentPagination.page,
                            pageSize: currentPagination.pageSize,
                            total: currentTotal,
                            showSizeChanger: false,
                            showQuickJumper: false,
                            showTotal: (total, range) =>
                              t('subscription.subscriptionManagement.pagination.totalItems', {
                                start: range[0],
                                end: range[1],
                                total,
                              }),
                            onChange:
                              activeTab === 'usage'
                                ? handleUsagePaginationChange
                                : handleRechargePaginationChange,
                          }
                        : false
                    }
                    className="history-table"
                    bordered={false}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
