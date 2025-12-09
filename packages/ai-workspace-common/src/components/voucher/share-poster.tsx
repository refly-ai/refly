import { useState, useRef, useCallback } from 'react';
import { message, QRCode, Avatar, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { Download, Copy } from 'lucide-react';
import { VoucherInvitation } from '@refly/openapi-schema';
import { logEvent } from '@refly/telemetry-web';
import cn from 'classnames';
import { useUserStoreShallow } from '@refly/stores';
import html2canvas from 'html2canvas';
import couponGradientBg from '../../assets/images/coupon-gradient-bg.webp';
import reflyIcon from '../../assets/logo.svg';
import defaultAvatar from '../../assets/refly_default_avatar.png';
import { Account } from 'refly-icons';
import { getBaseMonthlyPrice } from '../../constants/pricing';

interface SharePosterProps {
  visible: boolean;
  onClose: () => void;
  invitation?: VoucherInvitation | null;
  shareUrl: string;
  discountPercent: number;
}

// Sparkle icon for coupon badge decoration
const SparkleIcon = ({ className }: { className?: string }) => (
  <svg
    className={cn('w-3 h-3', className)}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M8 0L9.5 6.5L16 8L9.5 9.5L8 16L6.5 9.5L0 8L6.5 6.5L8 0Z" fill="currentColor" />
  </svg>
);

// Curved arrow pointing to QR code
const CurvedArrow = ({ className }: { className?: string }) => (
  <svg
    className={cn('w-5 h-5', className)}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M7 8C7 8 7 16 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path
      d="M13 13L16 16L13 19"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Refly brand logo
const ReflyLogo = ({ className }: { className?: string }) => (
  <img src={reflyIcon} alt="Refly" className={cn('w-7 h-7', className)} loading="lazy" />
);

// Gradient coupon badge component
const GradientCouponBadge = ({ discount }: { discount: string }) => (
  <div className="relative w-[140px] h-[66px]">
    {/* Background gradient image */}
    <div className="absolute -inset-x-[17px] -inset-y-[28px] rounded-xl overflow-hidden">
      <img src={couponGradientBg} alt="" className="w-full h-full object-cover" loading="lazy" />
    </div>
    {/* Content overlay */}
    <div className="absolute inset-0 rounded-xl flex flex-col items-center justify-center">
      <div className="absolute top-2 left-1">
        <SparkleIcon className="text-emerald-500" />
      </div>
      <div className="absolute top-2 right-1">
        <SparkleIcon className="text-emerald-500" />
      </div>
      <span className="text-[26px] font-bold text-gray-900 tracking-tight leading-none">
        {discount}
      </span>
      <span
        className="text-[12px] font-normal leading-[18px] mt-0.5"
        style={{ color: 'rgba(28, 31, 35, 0.60)' }}
      >
        Coupon
      </span>
    </div>
  </div>
);

// Ticket divider - just the dashed line, cutouts are handled by the card mask
const TicketDivider = () => (
  <div className="relative w-full h-6 my-3">
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
      <div className="w-full border-t-2 border-dashed border-gray-200" />
    </div>
  </div>
);

export const SharePoster = ({ visible, onClose, shareUrl, discountPercent }: SharePosterProps) => {
  const { t } = useTranslation();
  const posterRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Get user info for the poster
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const userName = userProfile?.name || 'Refly User';
  const userAvatar = userProfile?.avatar;
  // Convert discountPercent (e.g., 90 = 90% off) to voucher_value (e.g., 1 = 1折)
  const voucherValue = Math.round((100 - discountPercent) / 10);

  const handleCopyLink = useCallback(async () => {
    setCopying(true);
    try {
      // Build promotional text with link
      const basePrice = getBaseMonthlyPrice('plus');
      const discountValue = Math.round((basePrice * discountPercent) / 100);
      const promotionalText = t(
        'voucher.share.copyLinkText',
        "Unlock Refly.ai's vibe-workflow and supercharge your automation with Banana Pro, Gemini 3.0, and other top-tier AI models — A ${{value}} discount to get you started! Join here → {{link}}",
        {
          value: discountValue,
          link: shareUrl,
        },
      );
      await navigator.clipboard.writeText(promotionalText);
      message.success(t('voucher.share.linkCopied', 'Link copied!'));
      logEvent('share_link_copied', null, {
        voucher_value: voucherValue,
      });
      onClose();
    } catch {
      message.error(t('voucher.share.copyFailed', 'Copy failed'));
    }
    setCopying(false);
  }, [shareUrl, t, discountPercent, onClose, voucherValue]);

  const handleDownload = useCallback(async () => {
    if (!posterRef.current || downloading) return;

    setDownloading(true);
    try {
      // Use html2canvas to capture the poster element
      const canvas = await html2canvas(posterRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      // Convert to PNG and download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `refly-voucher-${discountPercent}off.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      message.success(t('voucher.share.downloaded', 'Downloaded'));

      logEvent('poster_download', null, {
        voucher_value: voucherValue,
      });
      onClose();
    } catch (error) {
      console.error('Failed to download poster:', error);
      message.error(t('voucher.share.downloadFailed', 'Download failed'));
    } finally {
      setDownloading(false);
    }
  }, [downloading, discountPercent, t, onClose, voucherValue]);

  if (!visible) return null;

  const discountText = `${discountPercent}% OFF`;
  // Calculate discounted price using shared pricing constant
  const originalPrice = getBaseMonthlyPrice('plus');
  const discountedPrice = Math.round(originalPrice * (1 - discountPercent / 100));

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      closable={false}
      centered
      width="auto"
      maskClosable={false}
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
          backdropFilter: 'blur(10px)',
          background: 'rgba(0, 0, 0, 0.3)',
        },
      }}
    >
      <div className="flex flex-col items-center">
        {/* Poster Card */}
        <div
          ref={posterRef}
          className="relative bg-white w-[340px] rounded-[24px] shadow-xl"
          style={{
            // CSS mask to create ticket-style cutouts on left and right edges
            // The cutouts are positioned at approximately 68% from top (where the divider is)
            maskImage: `
              radial-gradient(circle at 0% 68%, transparent 10px, black 10px),
              radial-gradient(circle at 100% 68%, transparent 10px, black 10px)
            `,
            maskComposite: 'intersect',
            WebkitMaskImage: `
              radial-gradient(circle at 0% 68%, transparent 10px, black 10px),
              radial-gradient(circle at 100% 68%, transparent 10px, black 10px)
            `,
            WebkitMaskComposite: 'source-in',
          }}
        >
          <div className="px-6 pt-6 pb-5">
            {/* Header: Brand + Coupon Badge */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <ReflyLogo />
                <span className="text-base font-semibold text-gray-900">Refly AI</span>
              </div>
              <GradientCouponBadge discount={discountText} />
            </div>

            {/* User Info */}
            <div className="flex items-center gap-3 mb-5">
              <Avatar
                size={36}
                src={userAvatar || defaultAvatar}
                icon={<Account />}
                className="flex-shrink-0 ring-2 ring-white shadow-md"
              />
              <span
                className="text-[16px] font-normal leading-[24px]"
                style={{ color: 'rgba(28, 31, 35, 0.80)' }}
              >
                {userName}
              </span>
            </div>

            {/* Main Content */}
            <h2 className="text-[26px] font-bold text-gray-900 leading-tight mb-3 whitespace-pre-line">
              {t('voucher.share.posterTitle', 'Unlock Plus for\nJust ${{discountedPrice}}!', {
                discountedPrice,
              })}
            </h2>
            <p className="text-[15px] text-gray-500 leading-relaxed">
              {t(
                'voucher.share.posterDesc',
                "You're invited to enjoy full access to Refly Plus with a {{discount}} discount.",
                { discount: discountText },
              )}
            </p>

            {/* Ticket Divider */}
            <TicketDivider />

            {/* QR Code Section */}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex-shrink-0 rounded-lg shadow-sm overflow-hidden bg-white p-1.5 border border-gray-100">
                <QRCode value={shareUrl} size={72} bordered={false} />
              </div>
              <div className="relative flex flex-col justify-center">
                {/* Arrow pointing to QR code - positioned above the text, can overflow */}
                <CurvedArrow className="absolute -top-5 -left-2 text-gray-800 rotate-180" />
                {/* Main content vertically centered with QR code */}
                <p className="text-[15px] font-medium text-emerald-500 leading-snug max-w-[200px]">
                  {t(
                    'voucher.share.ctaText',
                    'Join Refly AI, a {{discount}} Coupon to get you started!',
                    { discount: discountText },
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {t('voucher.share.validDays', 'Valid for 7 days.')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-7 py-2.5 bg-white text-gray-800 font-medium text-sm rounded-full border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>
              {downloading
                ? t('voucher.share.downloading', 'Downloading...')
                : t('voucher.share.download', 'Download')}
            </span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={copying}
            className="flex items-center gap-2 px-7 py-2.5 bg-gray-900 text-white font-medium text-sm rounded-full hover:bg-gray-800 active:bg-gray-700 transition-colors duration-150 disabled:opacity-50"
          >
            <Copy className="w-4 h-4" />
            <span>{t('voucher.share.copyLink', 'Copy link')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SharePoster;
