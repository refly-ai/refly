import { Modal, message, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { VoucherTriggerResult } from '@refly/openapi-schema';
import { useState, useEffect } from 'react';
import { logEvent } from '@refly/telemetry-web';
import { X } from 'lucide-react';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { Confetti } from './confetti';
import { TicketBottomCard } from './ticket-bottom-card';
import getClient from '../../requests/proxiedRequest';
import { getBaseMonthlyPrice } from '../../constants/pricing';
import { storePendingRedirect } from '../../hooks/use-pending-redirect';

interface VoucherPopupProps {
  visible: boolean;
  onClose: () => void;
  voucherResult: VoucherTriggerResult | null;
  onUseNow?: () => void;
  /** If true, this voucher was claimed via invite link (not earned by publishing) */
  useOnlyMode?: boolean;
}

export const VoucherPopup = ({
  visible,
  onClose,
  voucherResult,
  onUseNow: onUseNowProp,
  useOnlyMode = false,
}: VoucherPopupProps) => {
  const { t, i18n } = useTranslation();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  // Key to force Confetti remount on each popup open
  const [confettiKey, setConfettiKey] = useState(0);

  // Get plan type and user type from store
  const { planType, userType } = useSubscriptionStoreShallow((state) => ({
    planType: state.planType,
    userType: state.userType,
  }));

  // Determine if user is a Plus subscriber
  const isPlusUser = planType !== 'free';

  // Log popup display event when visible and trigger confetti remount
  useEffect(() => {
    if (visible && voucherResult?.voucher) {
      // Increment key to force Confetti component remount
      setConfettiKey((prev) => prev + 1);
      const dp = voucherResult.voucher.discountPercent;
      logEvent('voucher_popup_display', null, {
        voucher_value: Math.round((100 - dp) / 10),
        user_type: userType,
      });
    }
  }, [visible, voucherResult?.voucher, voucherResult]);

  if (!voucherResult) return null;

  const { voucher } = voucherResult;
  const discountPercent = voucher.discountPercent;
  // Convert discountPercent (e.g., 90 = 90% off) to voucher_value (e.g., 1 = 1折)
  const voucherValue = Math.round((100 - discountPercent) / 10);

  // Calculate discount value and discounted price
  const basePrice = getBaseMonthlyPrice('plus');
  const discountValue = Math.round((basePrice * discountPercent) / 100);
  const discountedPrice = basePrice - discountValue;

  // Calculate valid days from expiresAt
  const validDays = voucher.expiresAt
    ? Math.ceil((new Date(voucher.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 7;

  // Calculate min height based on mode, user type and language
  const isZh = i18n.language?.startsWith('zh');
  const getMinHeight = () => {
    if (useOnlyMode) {
      if (!isPlusUser) return '380px';
      return isZh ? '380px' : '390px';
    }
    if (!isPlusUser) return isZh ? '480px' : '510px';
    return isZh ? '450px' : '480px';
  };

  // Handle "Use It Now" / "Use Coupon" / "Publish to Get Coupon" / "Claim" button click
  const handleUseNow = async () => {
    // Log click event
    logEvent('voucher_use_now_click', null, {
      voucher_value: voucherValue,
      user_type: userType,
    });

    // Use custom handler if provided
    if (onUseNowProp) {
      onUseNowProp();
      return;
    }

    // If Plus user, just close
    if (isPlusUser) {
      onClose();
      return;
    }

    // For non-Plus user: Create Stripe checkout session with voucher
    setIsCheckingOut(true);
    try {
      console.log('[voucher-popup] voucher:', voucher);
      console.log('[voucher-popup] voucherId:', voucher.voucherId);

      // Validate voucher before creating checkout session
      const validateRes = await getClient().validateVoucher({
        body: { voucherId: voucher.voucherId },
      });

      console.log('[voucher-popup] validateRes:', validateRes.data);

      // Determine if user has a paid subscription
      const currentPlan = planType || 'free';

      const body: {
        planType: 'plus';
        interval: 'monthly';
        voucherId?: string;
        voucherEntryPoint?: string;
        voucherUserType?: string;
        source?: string;
        currentPlan?: string;
      } = {
        planType: 'plus',
        interval: 'monthly',
        currentPlan,
        source: 'voucher',
      };

      if (validateRes.data?.data?.valid) {
        body.voucherId = voucher.voucherId;
        body.voucherEntryPoint = 'discount_popup';
        body.voucherUserType = userType;
        console.log('[voucher-popup] voucher is valid, adding to checkout body');
      } else {
        console.log('[voucher-popup] voucher is NOT valid:', validateRes.data?.data);
        const reason = validateRes.data?.data?.reason || 'Voucher is no longer valid';
        message.warning(
          t('voucher.validation.invalid', {
            reason,
            defaultValue: `Your coupon cannot be applied: ${reason}`,
          }),
        );
      }

      console.log('[voucher-popup] createCheckoutSession body:', body);
      const res = await getClient().createCheckoutSession({ body });
      console.log('[voucher-popup] createCheckoutSession res:', res.data);
      if (res.data?.data?.url) {
        // Store current page for redirect after payment callback
        storePendingRedirect();
        window.location.href = res.data.data.url;
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      message.error(
        t('subscription.checkoutFailed', 'Failed to start checkout. Please try again.'),
      );
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <>
      <Modal
        open={visible}
        footer={null}
        closable={false}
        centered
        width={420}
        styles={{
          content: {
            padding: 0,
            background: 'transparent',
            boxShadow: 'none',
          },
          body: {
            padding: 0,
          },
          mask: {
            overflow: 'hidden',
          },
        }}
      >
        {/* Confetti effect - positioned relative to viewport, not the modal */}
        <div className="fixed inset-0 pointer-events-none z-[1000]">
          <Confetti key={confettiKey} isActive={visible} />
        </div>

        <div className="relative w-full max-w-[380px] mx-auto">
          {/* White base layer with shadow and rounded corners */}
          <div
            className="absolute left-0 right-0 rounded-[20px]"
            style={{
              top: '55px',
              bottom: 0,
              backgroundColor: '#FFFFFF',
              boxShadow: '0px 0px 10px rgba(13, 122, 115, 0.1)',
            }}
          />

          {/* Content Container - height varies by mode and language */}
          <div className="relative" style={{ minHeight: getMinHeight() }}>
            {/* Top Section - Congratulations and Coupon with green gradient background */}
            {/* 16px margin from left, right, top and bottom, with rounded corners on all sides */}
            <div
              className="absolute left-4 right-4 top-4 bottom-4 z-0 rounded-[16px] px-4 pt-7"
              style={{
                background: 'linear-gradient(90deg, #CDFFEA 0%, #E9FFFE 100%)',
                border: '0.5px solid rgba(9, 9, 9, 0.07)',
              }}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-3 flex items-center justify-center w-6 h-6 bg-transparent text-emerald-700/50 hover:text-emerald-700 transition-colors duration-150 outline-none focus:outline-none border-none"
                aria-label={t('common.close', 'Close')}
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header - Congratulations */}
              <div className="flex items-center justify-center gap-3">
                <span
                  className="h-[2px] w-[14px] rounded-full"
                  style={{ backgroundColor: 'rgba(0, 73, 53, 0.25)' }}
                />
                <span className="text-base font-medium" style={{ color: '#004935' }}>
                  {t('voucher.popup.congratulations', 'Congratulations')}
                </span>
                <span
                  className="h-[2px] w-[14px] rounded-full"
                  style={{ backgroundColor: 'rgba(0, 73, 53, 0.25)' }}
                />
              </div>

              {/* Coupon Card */}
              <div className="mx-auto mt-6 rounded-xl bg-white p-6 shadow-[0_0_10px_rgba(13,122,115,0.1)]">
                <div className="flex items-baseline justify-center gap-2">
                  <span
                    className="text-[40px] font-bold leading-none"
                    style={{
                      background: 'linear-gradient(180deg, #0E9F77 0%, #000000 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {i18n.language?.startsWith('zh')
                      ? `会员 ${voucherValue}折`
                      : `${discountPercent}% OFF`}
                  </span>
                  <span className="text-xl text-black/80">
                    {t('voucher.popup.coupon', 'Coupon')}
                  </span>
                </div>
              </div>

              {/* Valid for X days */}
              <p className="mt-4 text-center text-sm" style={{ color: 'rgba(28, 31, 35, 0.35)' }}>
                {t('voucher.popup.validFor', 'Valid for {{days}} days', { days: validDays })}
              </p>
            </div>

            {/* Bottom semi-transparent white area with punched hole at top */}
            <TicketBottomCard>
              {/* Description text - different based on user status and mode */}
              <div
                className="text-center text-sm leading-relaxed"
                style={{ color: 'rgba(28, 31, 35, 0.6)' }}
              >
                {isPlusUser ? (
                  // Plus user: show congratulations description
                  <p>
                    {t(
                      'voucher.popup.plusUserDesc1',
                      "To celebrate your amazing work, we're giving you a {{discountPercent}}% off coupon.",
                      { discountPercent, voucherValue },
                    )}
                  </p>
                ) : useOnlyMode ? (
                  // Non-Plus user who claimed via invite: show upgrade description
                  <p>
                    {t(
                      'voucher.popup.claimedDesc',
                      'Upgrade to Refly.ai Plus and unlock advanced models like Gemini 3.',
                    )}
                  </p>
                ) : (
                  // Non-Plus user who earned voucher: show discount and price description
                  <>
                    <p>
                      {t(
                        'voucher.popup.nonPlusUserDesc1',
                        "To celebrate your amazing work, we're giving you a {{discountPercent}}% off coupon - our way of saying thanks for contributing such a high-quality template.",
                        { discountPercent, voucherValue },
                      )}
                    </p>
                    <p className="mt-1">
                      {t(
                        'voucher.popup.nonPlusUserDesc2',
                        'Enjoy full access for just ${{discountedPrice}}!',
                        { discountedPrice },
                      )}
                    </p>
                  </>
                )}
              </div>

              {/* Button group */}
              <div className="mt-5 flex flex-col gap-3 max-w-[320px]">
                {/* Use button: only for non-Plus users */}
                {!isPlusUser && (
                  <Button
                    type="primary"
                    size="large"
                    block
                    shape="round"
                    onClick={handleUseNow}
                    loading={isCheckingOut}
                    style={{
                      height: 48,
                      backgroundColor: '#1C1F23',
                      borderColor: '#1C1F23',
                      fontSize: 16,
                      fontWeight: 500,
                    }}
                  >
                    {useOnlyMode
                      ? t('voucher.popup.useCoupon', 'Use Coupon')
                      : t('voucher.popup.useNow', 'Use It Now')}
                  </Button>
                )}
              </div>
            </TicketBottomCard>
          </div>
        </div>
      </Modal>
    </>
  );
};
