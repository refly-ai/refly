import { Modal, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { VoucherTriggerResult } from '@refly/openapi-schema';
import { useState, useEffect } from 'react';
import { logEvent } from '@refly/telemetry-web';
import { createVoucherInvitation } from '../../requests/services.gen';
import { SharePoster } from './share-poster';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { useCreateCanvas } from '../../hooks/canvas/use-create-canvas';
import { Confetti } from './confetti';

interface VoucherPopupProps {
  visible: boolean;
  onClose: () => void;
  voucherResult: VoucherTriggerResult | null;
  onUseNow?: () => void;
  onShare?: () => void;
  /** If true, only show "Use It Now" button, hide share button */
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

  // Get subscription modal control from store
  const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
  }));

  // Create canvas hook for "Publish to Get Coupon" flow
  const { debouncedCreateCanvas, isCreating: isCreatingCanvas } = useCreateCanvas({
    afterCreateSuccess: onClose,
  });

  // Log popup display event when visible
  useEffect(() => {
    if (visible && voucherResult?.voucher) {
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

  // Calculate valid days from expiresAt
  const validDays = voucher.expiresAt
    ? Math.ceil((new Date(voucher.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 7;

  // Handle "Use It Now" / "Publish to Get Coupon" button click
  const handleUseNow = () => {
    // Log click event
    logEvent('voucher_use_now_click', null, {
      voucherId: voucher.voucherId,
      discountPercent: voucher.discountPercent,
      useOnlyMode,
    });

    // Use custom handler if provided
    if (onUseNowProp) {
      onUseNowProp();
      return;
    }

    // In useOnlyMode (claimed via invite), create new canvas to encourage publishing
    if (useOnlyMode) {
      debouncedCreateCanvas('voucher_claimed');
      return;
    }

    // Default behavior: Close voucher popup and open subscribe modal
    onClose();
    setSubscribeModalVisible(true);
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

        // Show share poster
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
        closable={true}
        onCancel={onClose}
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
        }}
      >
        <div className="relative w-full max-w-[380px] mx-auto">
          {/* Confetti effect */}
          <Confetti isActive={visible} />

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
          <div className="relative min-h-[460px]">
            {/* Top Section - Congratulations and Coupon with green gradient background - full height */}
            <div
              className="absolute inset-0 mx-2 mt-2 rounded-t-[16px] px-4 pt-7 pb-6"
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

            {/* Bottom semi-transparent white area with punched holes at top - overlays bottom half */}
            <div className="absolute bottom-0 left-0 right-0">
              <svg
                className="w-full"
                height="262"
                viewBox="0 0 380 262"
                fill="none"
                preserveAspectRatio="none"
                style={{ display: 'block' }}
              >
                {/* Backdrop blur effect filter */}
                <defs>
                  <filter id="backdrop-blur" x="-20" y="-20" width="420" height="302">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
                  </filter>
                </defs>
                {/* White semi-transparent card with punched circular notches at top */}
                <path
                  d="M358 0C369.046 0 380 10.9543 380 22V242C380 253.046 369.046 262 358 262H22C10.9543 262 0 253.046 0 242V22C0 10.9543 10.9543 0 22 0H170C174.418 0 177.834 3.95 180.569 7.42C182.766 10.209 186.174 12 190 12C193.826 12 197.234 10.209 199.431 7.42C202.166 3.95 205.582 0 210 0H358Z"
                  fill="rgba(255, 255, 255, 0.7)"
                  style={{
                    filter: 'url(#backdrop-blur)',
                  }}
                />
              </svg>

              {/* Bottom content area - positioned absolutely over the SVG */}
              <div className="absolute inset-0 pt-6 pb-6 px-5 flex flex-col justify-end">
                {/* Description text */}
                <p
                  className="text-center text-sm leading-relaxed px-2"
                  style={{ color: 'rgba(28, 31, 35, 0.6)' }}
                >
                  {useOnlyMode
                    ? t(
                        'voucher.popup.claimedDescription',
                        'Great! You have received a discount coupon. Publish a high-quality template to get your own coupon and share with friends!',
                      )
                    : t(
                        'voucher.popup.description',
                        'Thanks for contributing such a high-quality template to the Marketplace. With your Voucher applied, you get full access at a discounted price.',
                      )}
                </p>

                {/* Button group */}
                <div className="mt-5 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleUseNow}
                    disabled={isCreatingCanvas}
                    className="h-12 w-full rounded-full text-base font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#1C1F23' }}
                  >
                    {isCreatingCanvas
                      ? t('common.loading', 'Loading...')
                      : useOnlyMode
                        ? t('voucher.popup.publishToGetCoupon', 'Publish to Get Coupon')
                        : t('voucher.popup.useNow', 'Use It Now')}
                  </button>
                  {!useOnlyMode && (
                    <button
                      type="button"
                      onClick={handleShare}
                      disabled={creatingInvitation}
                      className="h-12 w-full rounded-full bg-white text-base font-medium text-black transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      {creatingInvitation
                        ? t('voucher.popup.creating', 'Creating...')
                        : t('voucher.popup.shareWithFriend', 'Share With Friend')}
                    </button>
                  )}
                </div>
              </div>
            </div>
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
