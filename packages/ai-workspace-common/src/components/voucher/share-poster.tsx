import { useState, useRef } from 'react';
import { Modal, Button, message, QRCode } from 'antd';
import { useTranslation } from 'react-i18next';
import { CopyOutlined, DownloadOutlined, LinkOutlined } from '@ant-design/icons';
import { VoucherInvitation } from '@refly/openapi-schema';

interface SharePosterProps {
  visible: boolean;
  onClose: () => void;
  invitation: VoucherInvitation | null;
  shareUrl: string;
  discountPercent: number;
}

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

  const handleCopyLink = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(shareUrl);
      message.success(t('voucher.share.linkCopied', '链接已复制'));
    } catch {
      message.error(t('voucher.share.copyFailed', '复制失败'));
    }
    setCopying(false);
  };

  const handleDownload = async () => {
    // Simple text download for now - can be enhanced with html2canvas later
    const text = `
Refly 折扣券分享
折扣: ${discountPercent}% OFF
链接: ${shareUrl}
邀请码: ${invitation?.inviteCode || ''}
    `.trim();

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'refly-voucher-share.txt';
    a.click();
    URL.revokeObjectURL(url);
    message.success(t('voucher.share.downloaded', '已下载'));
  };

  if (!invitation) return null;

  return (
    <Modal
      open={visible}
      footer={null}
      closable={true}
      onCancel={onClose}
      centered
      width={400}
      title={t('voucher.share.title', '分享折扣券')}
    >
      <div className="flex flex-col items-center py-4">
        {/* Poster Preview */}
        <div
          ref={posterRef}
          className="w-full bg-gradient-to-br from-green-400 to-green-600 rounded-2xl p-6 text-white mb-6"
        >
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Refly 专属折扣</h3>
            <div className="text-5xl font-bold my-4">{discountPercent}% OFF</div>
            <p className="text-sm opacity-90 mb-4">
              {t('voucher.share.posterDesc', '扫码或点击链接领取')}
            </p>

            {/* QR Code */}
            <div className="bg-white rounded-lg p-2 inline-block">
              <QRCode value={shareUrl} size={120} bordered={false} />
            </div>

            <div className="mt-4 text-xs opacity-80">
              {t('voucher.share.inviteCode', '邀请码')}: {invitation.inviteCode}
            </div>
          </div>
        </div>

        {/* Share URL */}
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4 flex items-center gap-2">
          <LinkOutlined className="text-gray-400" />
          <span className="flex-1 text-sm truncate text-gray-600 dark:text-gray-300">
            {shareUrl}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 w-full">
          <Button
            icon={<CopyOutlined />}
            onClick={handleCopyLink}
            loading={copying}
            className="flex-1"
          >
            {t('voucher.share.copyLink', '复制链接')}
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            type="primary"
            className="flex-1 bg-green-500 hover:bg-green-600 border-none"
          >
            {t('voucher.share.download', '下载')}
          </Button>
        </div>

        {/* Reward Notice */}
        <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('voucher.share.rewardNotice', '好友领取后，您将获得 2000 积分奖励!')}
        </div>
      </div>
    </Modal>
  );
};

export default SharePoster;
