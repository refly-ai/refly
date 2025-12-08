import { useState, useRef, useCallback, useEffect } from 'react';
import { message, QRCode } from 'antd';
import { useTranslation } from 'react-i18next';
import { Download, Copy } from 'lucide-react';
import { VoucherInvitation } from '@refly/openapi-schema';
import { logEvent } from '@refly/telemetry-web';
import cn from 'classnames';
import { useUserStoreShallow } from '@refly/stores';

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
  <svg
    className={cn('w-7 h-7', className)}
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="14" cy="14" r="13" fill="url(#reflyGradient)" />
    <path d="M9 10L14 8L19 10L14 12L9 10Z" fill="white" fillOpacity="0.9" />
    <path d="M9 14L14 12L19 14L14 16L9 14Z" fill="white" fillOpacity="0.7" />
    <path d="M9 18L14 16L19 18L14 20L9 18Z" fill="white" fillOpacity="0.5" />
    <defs>
      <linearGradient id="reflyGradient" x1="0" y1="0" x2="28" y2="28">
        <stop stopColor="#10B981" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
    </defs>
  </svg>
);

// Gradient coupon badge component
const GradientCouponBadge = ({ discount }: { discount: string }) => (
  <div className="relative w-[140px] h-[66px]">
    {/* Background gradient blobs */}
    <div className="absolute inset-0 rounded-xl overflow-hidden">
      <div className="absolute inset-0 opacity-60">
        <div
          className="absolute w-8 h-14 rounded-full blur-xl"
          style={{ background: '#6F00FF', left: '10%', top: '50%', transform: 'translateY(-50%)' }}
        />
        <div
          className="absolute w-8 h-14 rounded-full blur-xl"
          style={{ background: '#00FFFF', left: '30%', top: '50%', transform: 'translateY(-50%)' }}
        />
        <div
          className="absolute w-8 h-14 rounded-full blur-xl"
          style={{ background: '#FF9900', left: '55%', top: '50%', transform: 'translateY(-50%)' }}
        />
        <div
          className="absolute w-8 h-14 rounded-full blur-xl"
          style={{ background: '#FF00FF', left: '80%', top: '50%', transform: 'translateY(-50%)' }}
        />
      </div>
    </div>
    {/* Glass-morphism overlay */}
    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm rounded-xl border border-black/10 flex flex-col items-center justify-center">
      <div className="absolute top-2 left-3">
        <SparkleIcon className="text-emerald-500" />
      </div>
      <div className="absolute top-2 right-3">
        <SparkleIcon className="text-emerald-500" />
      </div>
      <span className="text-[26px] font-bold text-gray-900 tracking-tight leading-none">
        {discount}
      </span>
      <span className="text-sm text-pink-500 font-medium mt-0.5">Coupon</span>
    </div>
  </div>
);

// Ticket divider with circular cutouts
const TicketDivider = () => (
  <div className="relative w-full h-8 my-2">
    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-black/30 backdrop-blur-[10px]" />
    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2">
      <div className="w-full border-t-2 border-dashed border-gray-300" />
    </div>
    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 rounded-full bg-black/30 backdrop-blur-[10px]" />
  </div>
);

export const SharePoster = ({
  visible,
  onClose,
  invitation,
  shareUrl,
  discountPercent,
}: SharePosterProps) => {
  const { t } = useTranslation();
  const posterRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);

  // Get user info for the poster
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const userName = userProfile?.name || 'Refly User';
  const userAvatar = userProfile?.avatar;

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        onClose();
      }
    };
    if (visible) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [visible, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [visible]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handleCopyLink = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(shareUrl);
      message.success(t('voucher.share.linkCopied', 'Link copied!'));
      logEvent('share_link_copied', null, {
        inviteCode: invitation?.inviteCode,
        discountPercent,
        shareUrl,
      });
    } catch {
      message.error(t('voucher.share.copyFailed', 'Copy failed'));
    }
    setCopying(false);
  };

  const handleDownload = async () => {
    // TODO: Implement html2canvas for proper poster download
    const text = `
Refly Discount Coupon
Discount: ${discountPercent}% OFF
Link: ${shareUrl}
${invitation?.inviteCode ? `Invite Code: ${invitation.inviteCode}` : ''}
    `.trim();

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'refly-voucher-share.txt';
    a.click();
    URL.revokeObjectURL(url);
    message.success(t('voucher.share.downloaded', 'Downloaded'));

    logEvent('poster_download', null, {
      inviteCode: invitation?.inviteCode,
      discountPercent,
      format: 'text',
    });
  };

  if (!visible) return null;

  const discountText = `${discountPercent}% OFF`;

  return (
    <dialog
      open
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[10px] flex items-center justify-center p-4 m-0 max-w-none max-h-none w-full h-full border-none"
      onClick={handleBackdropClick}
    >
      <div className="relative flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        {/* Poster Card */}
        <div
          ref={posterRef}
          className="relative bg-white w-[340px] rounded-[24px] shadow-xl overflow-visible"
        >
          <div className="px-6 pt-6 pb-5">
            {/* Header: Brand + Coupon Badge */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-2">
                <ReflyLogo />
                <span className="text-base font-semibold text-gray-900">Refly AI</span>
              </div>
              <GradientCouponBadge discount={discountText} />
            </div>

            {/* User Info */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white shadow-md">
                {userAvatar ? (
                  <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {userName?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </div>
              <span className="text-base text-gray-700">{userName}</span>
            </div>

            {/* Main Content */}
            <h2 className="text-[26px] font-bold text-gray-900 leading-tight mb-3 whitespace-pre-line">
              {t('voucher.share.posterTitle', 'Top Contributor\nReward Unlocked')}
            </h2>
            <p className="text-[15px] text-gray-500 leading-relaxed">
              {t(
                'voucher.share.posterDesc',
                "Refly recognized my template contribution with a Pro reward. I'm sharing this exclusive access key with my network.",
              )}
            </p>

            {/* Ticket Divider */}
            <TicketDivider />

            {/* QR Code Section */}
            <div className="flex items-start gap-4 pt-2">
              <div className="flex-shrink-0 rounded-lg shadow-sm overflow-hidden bg-white p-1.5 border border-gray-100">
                <QRCode value={shareUrl} size={72} bordered={false} />
              </div>
              <div className="flex flex-col pt-1">
                <CurvedArrow className="text-gray-800 rotate-180 mb-1" />
                <p className="text-[15px] font-medium text-emerald-500 leading-snug max-w-[200px]">
                  {t(
                    'voucher.share.ctaText',
                    'Join Refly AI, a {{discount}} Coupon to get you started!',
                    { discount: discountText },
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {t('voucher.share.validDays', 'valid for 7 days')}
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
            className="flex items-center gap-2 px-7 py-2.5 bg-white text-gray-800 font-medium text-sm rounded-full border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150"
          >
            <Download className="w-4 h-4" />
            <span>{t('voucher.share.download', 'Download')}</span>
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
    </dialog>
  );
};

export default SharePoster;
