import { Modal, message, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { VoucherTriggerResult } from '@refly/openapi-schema';
import { useState, useEffect } from 'react';
import { logEvent } from '@refly/telemetry-web';
import { createVoucherInvitation } from '../../requests/services.gen';
import { SharePoster } from './share-poster';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { useCreateCanvas } from '../../hooks/canvas/use-create-canvas';
import { Confetti } from './confetti';
import { TicketBottomCard } from './ticket-bottom-card';
import getClient from '../../requests/proxiedRequest';
import { getBaseMonthlyPrice } from '../../constants/pricing';

interface VoucherPopupProps {
  visible: boolean;
  onClose: () => void;
  voucherResult: VoucherTriggerResult | null;
  onUseNow?: () => void;
  onShare?: () => void;
  /** If true, this voucher was claimed via invite link (not earned by publishing) */
  useOnlyMode?: boolean;
}

export const VoucherPopup = ({
  visible,
  onClose,
  voucherResult,
  onUseNow: onUseNowProp,
  onShare: onShareProp,
  useOnlyMode = false,
}: VoucherPopupProps) => {
  const { t } = useTranslation();
  const [showSharePoster, setShowSharePoster] = useState(false);
  const [shareInvitation, setShareInvitation] = useState<any>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [creatingInvitation, setCreatingInvitation] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  // Key to force Confetti remount on each popup open
  const [confettiKey, setConfettiKey] = useState(0);

  // Get plan type from store
  const { planType } = useSubscriptionStoreShallow((state) => ({
    planType: state.planType,
  }));

  // Determine if user is a Plus subscriber
  const isPlusUser = planType !== 'free';

  // Create canvas hook for "Publish to Get Coupon" flow
  const { debouncedCreateCanvas, isCreating: isCreatingCanvas } = useCreateCanvas({
    afterCreateSuccess: onClose,
  });

  // Log popup display event when visible and trigger confetti remount
  useEffect(() => {
    if (visible && voucherResult?.voucher) {
      // Increment key to force Confetti component remount
      setConfettiKey((prev) => prev + 1);
      logEvent('voucher_popup_display', null, {
        voucherId: voucherResult?.voucher.voucherId,
        discountPercent: voucherResult?.voucher.discountPercent,
        triggerLimitReached: voucherResult.triggerLimitReached,
      });
    }
  }, [visible, voucherResult?.voucher, voucherResult]);

  if (!voucherResult) return null;

  const { voucher } = voucherResult;
  const discountPercent = voucher.discountPercent;

  // Calculate discount value and discounted price
  const basePrice = getBaseMonthlyPrice('plus');
  const discountValue = Math.round((basePrice * discountPercent) / 100);
  const discountedPrice = basePrice - discountValue;

  // Calculate valid days from expiresAt
  const validDays = voucher.expiresAt
    ? Math.ceil((new Date(voucher.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 7;

  // Handle "Use It Now" / "Publish to Get Coupon" / "Claim" button click
  const handleUseNow = async () => {
    // Log click event
    logEvent('voucher_use_now_click', null, {
      voucherId: voucher.voucherId,
      discountPercent: voucher.discountPercent,
      useOnlyMode,
      isPlusUser,
    });

    // Use custom handler if provided
    if (onUseNowProp) {
      onUseNowProp();
      return;
    }

    // If Plus user in useOnlyMode (claimed via invite), just close - they can share
    if (useOnlyMode && isPlusUser) {
      onClose();
      return;
    }

    // In useOnlyMode (claimed via invite) for non-Plus user, create new canvas to encourage publishing
    if (useOnlyMode) {
      debouncedCreateCanvas('voucher_claimed');
      return;
    }

    // Default behavior: Create Stripe checkout session directly with voucher
    setIsCheckingOut(true);
    try {
      // Validate voucher before creating checkout session
      const validateRes = await getClient().validateVoucher({
        body: { voucherId: voucher.voucherId },
      });

      const body: {
        planType: 'plus';
        interval: 'monthly';
        voucherId?: string;
      } = {
        planType: 'plus',
        interval: 'monthly',
      };

      if (validateRes.data?.data?.valid) {
        body.voucherId = voucher.voucherId;

        logEvent('voucher_applied', null, {
          voucherId: voucher.voucherId,
          discountPercent: voucher.discountPercent,
          entry_point: 'voucher_popup',
          planType: 'plus',
          interval: 'monthly',
        });
      } else {
        const reason = validateRes.data?.data?.reason || 'Voucher is no longer valid';
        message.warning(
          t('voucher.validation.invalid', {
            reason,
            defaultValue: `Your coupon cannot be applied: ${reason}`,
          }),
        );
      }

      const res = await getClient().createCheckoutSession({ body });
      if (res.data?.data?.url) {
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

  // Handle "Share With Friend" button click
  const handleShare = async () => {
    // Log click event
    logEvent('voucher_share_click', null, {
      voucherId: voucher.voucherId,
      discountPercent: voucher.discountPercent,
    });

    // Use custom handler if provided
    if (onShareProp) {
      onShareProp();
      return;
    }

    // Create invitation
    setCreatingInvitation(true);
    try {
      const response = await createVoucherInvitation({
        body: {
          voucherId: voucher.voucherId,
        },
      });

      if (response.data?.data?.invitation) {
        const invitation = response.data.data.invitation;
        setShareInvitation(invitation);

        // Build share URL - pointing to /workspace with invite parameter
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/workspace?invite=${invitation.inviteCode}`;
        setShareUrl(url);

        // Close the voucher popup and show share poster
        onClose();
        setShowSharePoster(true);
      } else {
        message.error(t('voucher.share.createFailed', 'Failed to create invitation'));
      }
    } catch (error) {
      console.error('Failed to create invitation:', error);
      message.error(t('voucher.share.createFailed', 'Failed to create invitation'));
    } finally {
      setCreatingInvitation(false);
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

          {/* Content Container */}
          <div className="relative min-h-[520px]">
            {/* Top Section - Congratulations and Coupon with green gradient background */}
            {/* 16px margin from left, right, top and bottom, with rounded corners on all sides */}
            <div
              className="absolute left-4 right-4 top-4 bottom-4 z-0 rounded-[16px] px-4 pt-7"
              style={{
                background: 'linear-gradient(90deg, #CDFFEA 0%, #E9FFFE 100%)',
                border: '0.5px solid rgba(9, 9, 9, 0.07)',
              }}
            >
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
                    {discountPercent}% OFF
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
              {/* Description text - different for Plus vs non-Plus users */}
              <div
                className="text-center text-sm leading-relaxed px-2"
                style={{ color: 'rgba(28, 31, 35, 0.6)' }}
              >
                {isPlusUser ? (
                  // Plus user: show invite friend description
                  <>
                    <p>
                      {t(
                        'voucher.popup.plusUserDesc1',
                        "To celebrate your amazing work, we're giving you a ${{value}} discount (valid for 7 days).",
                        { value: discountValue },
                      )}
                    </p>
                    <p className="mt-2">
                      {t(
                        'voucher.popup.plusUserDesc2',
                        "Invite a friend to register with your link and purchase a membership, and you'll both get rewards:",
                      )}
                    </p>
                    <ul className="mt-1 text-left pl-4 list-disc">
                      <li>{t('voucher.popup.plusUserReward1', 'You: +2,000 bonus credits')}</li>
                      <li>
                        {t(
                          'voucher.popup.plusUserReward2',
                          'Your friend: A special discount for their membership purchase.',
                        )}
                      </li>
                    </ul>
                  </>
                ) : (
                  // Non-Plus user: show discount and price description
                  <>
                    <p>
                      {t(
                        'voucher.popup.nonPlusUserDesc1',
                        "To celebrate your amazing work, we're giving you a ${{value}} discount (valid for 7 days)—our way of saying thanks for contributing such a high-quality template to the Marketplace.",
                        { value: discountValue },
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
                <Button
                  type="primary"
                  size="large"
                  block
                  shape="round"
                  onClick={handleUseNow}
                  loading={useOnlyMode ? isCreatingCanvas : isCheckingOut}
                  style={{
                    height: 48,
                    backgroundColor: '#1C1F23',
                    borderColor: '#1C1F23',
                    fontSize: 16,
                    fontWeight: 500,
                  }}
                >
                  {useOnlyMode
                    ? t('voucher.popup.publishToGetCoupon', 'Publish to Get Coupon')
                    : t('voucher.popup.useNow', 'Use It Now')}
                </Button>
                {!useOnlyMode && (
                  <Button
                    size="large"
                    block
                    shape="round"
                    onClick={handleShare}
                    loading={creatingInvitation}
                    style={{
                      height: 48,
                      fontSize: 16,
                      fontWeight: 500,
                      boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    {t('voucher.popup.shareWithFriend', 'Share With Friend')}
                  </Button>
                )}
              </div>
            </TicketBottomCard>
          </div>
        </div>
      </Modal>

      {/* Share Poster Modal */}
      {showSharePoster && (
        <SharePoster
          visible={showSharePoster}
          onClose={() => setShowSharePoster(false)}
          invitation={shareInvitation}
          shareUrl={shareUrl}
          discountPercent={discountPercent}
        />
      )}
    </>
  );
};

export default VoucherPopup;
