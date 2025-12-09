import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Spin, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { GiftOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { VoucherInvitation } from '@refly/openapi-schema';
import { logEvent } from '@refly/telemetry-web';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { storePendingVoucherCode } from '@refly-packages/ai-workspace-common/hooks/use-pending-voucher-claim';

const VoucherInvitePage = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getLoginStatus } = useIsLogin();
  const isLoggedIn = getLoginStatus();

  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [invitation, setInvitation] = useState<VoucherInvitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  // Get subscription modal control from store
  const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
  }));

  useEffect(() => {
    if (inviteCode) {
      verifyInvitation();
    }
  }, [inviteCode]);

  const verifyInvitation = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getClient().verifyVoucherInvitation({
        query: { code: inviteCode! },
      });
      if (response.data?.success && response.data.data) {
        const result = response.data.data;

        if (result.valid && result.invitation) {
          setInvitation(result.invitation);

          // Log page view event
          logEvent('voucher_invite_page_view', null, {
            inviteCode: inviteCode,
            discountPercent: result.invitation.discountPercent,
            isLoggedIn,
          });
        } else {
          // Invitation is invalid or already claimed
          setError(
            result.message || t('voucher.invite.invalidCode', 'Invalid or expired invitation code'),
          );
        }
      } else {
        setError(t('voucher.invite.invalidCode', 'Invalid or expired invitation code'));
      }
    } catch (err) {
      console.error('Failed to verify invitation:', err);
      setError(t('voucher.invite.verifyError', 'Failed to verify invitation'));
    }
    setLoading(false);
  };

  const handleClaim = useCallback(async () => {
    if (!isLoggedIn) {
      // Store invite code for claiming after login
      storePendingVoucherCode(inviteCode!);

      // Redirect to login with return URL
      const returnUrl = encodeURIComponent(window.location.href);
      navigate(`/login?returnUrl=${returnUrl}`);
      return;
    }

    setClaiming(true);
    try {
      const response = await getClient().claimVoucherInvitation({
        body: { inviteCode: inviteCode! },
      });
      if (response.data?.success) {
        setClaimed(true);
        message.success(t('voucher.invite.claimSuccess', 'Voucher claimed successfully!'));

        // Log telemetry event for successful claim
        logEvent('voucher_claim', null, {
          inviteCode: inviteCode,
          discountPercent: invitation?.discountPercent,
          inviterUid: invitation?.inviterUid,
        });
      } else {
        message.error(
          response.data?.errMsg || t('voucher.invite.claimError', 'Failed to claim voucher'),
        );
      }
    } catch (err) {
      console.error('Failed to claim voucher:', err);
      message.error(t('voucher.invite.claimError', 'Failed to claim voucher'));
    }
    setClaiming(false);
  }, [inviteCode, isLoggedIn, navigate, t, invitation]);

  const handleGoToWorkspace = useCallback(() => {
    navigate('/workspace');
  }, [navigate]);

  const handleGoToPricing = useCallback(() => {
    // Navigate to workspace first, then open subscribe modal
    navigate('/workspace');
    // Small delay to ensure navigation completes before opening modal
    setTimeout(() => {
      setSubscribeModalVisible(true);
    }, 100);
  }, [navigate, setSubscribeModalVisible]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800">
        <Spin size="large" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
            <CloseCircleOutlined className="text-3xl text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
            {t('voucher.invite.invalidTitle', 'Invalid Invitation')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {error ||
              t('voucher.invite.invalidDesc', 'This invitation link is invalid or has expired.')}
          </p>
          <Button
            type="primary"
            onClick={handleGoToWorkspace}
            className="bg-green-500 hover:bg-green-600 border-none"
          >
            {t('voucher.invite.goHome', 'Go to Homepage')}
          </Button>
        </div>
      </div>
    );
  }

  if (claimed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <CheckCircleOutlined className="text-3xl text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            {t('voucher.invite.successTitle', 'Voucher Claimed!')}
          </h2>
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl my-4 inline-block">
            <span className="text-3xl font-bold">{invitation.discountPercent}%</span>
            <span className="text-lg ml-2">{t('voucher.invite.off', 'OFF')}</span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {t(
              'voucher.invite.successDesc',
              'Your voucher has been added to your account. Use it on your next subscription!',
            )}
          </p>
          <div className="flex gap-3">
            <Button onClick={handleGoToWorkspace} className="flex-1">
              {t('voucher.invite.goWorkspace', 'Go to Workspace')}
            </Button>
            <Button
              type="primary"
              onClick={handleGoToPricing}
              className="flex-1 bg-green-500 hover:bg-green-600 border-none"
            >
              {t('voucher.invite.usePricing', 'Subscribe Now')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-6">
          <Logo className="h-8 mx-auto" />
        </div>

        {/* Gift Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
          <GiftOutlined className="text-4xl text-white" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          {t('voucher.invite.title', 'You Got a Gift!')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {t('voucher.invite.subtitle', 'Your friend shared a discount voucher with you')}
        </p>

        {/* Discount Display */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-6 rounded-2xl my-6">
          <span className="text-5xl font-bold">{invitation.discountPercent}%</span>
          <span className="text-2xl ml-2">{t('voucher.invite.off', 'OFF')}</span>
          <p className="text-sm mt-2 opacity-90">
            {t('voucher.invite.forSubscription', 'For your subscription')}
          </p>
        </div>

        {/* Expiration Notice */}
        <p className="text-sm text-orange-500 mb-6">
          {t('voucher.invite.validFor', 'Valid for 7 days after claiming')}
        </p>

        {/* Claim Button */}
        <Button
          type="primary"
          size="large"
          onClick={handleClaim}
          loading={claiming}
          className="w-full h-12 text-lg font-semibold bg-green-500 hover:bg-green-600 border-none rounded-xl"
        >
          {isLoggedIn
            ? t('voucher.invite.claimBtn', 'Claim Voucher')
            : t('voucher.invite.loginToClaim', 'Login to Claim')}
        </Button>

        {/* Already have account hint */}
        {!isLoggedIn && (
          <p className="text-sm text-gray-400 mt-4">
            {t('voucher.invite.newUser', "Don't have an account?")}
            <Button
              type="link"
              className="p-0 ml-1"
              onClick={() =>
                navigate(`/login?returnUrl=${encodeURIComponent(window.location.href)}`)
              }
            >
              {t('voucher.invite.signUp', 'Sign up for free')}
            </Button>
          </p>
        )}
      </div>
    </div>
  );
};

export default VoucherInvitePage;
