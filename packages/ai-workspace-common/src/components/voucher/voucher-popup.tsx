import { Modal, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { VoucherTriggerResult } from '@refly/openapi-schema';
import { ShareAltOutlined, GiftOutlined } from '@ant-design/icons';

// Glassmorphism styles
const glassmorphismStyles = `
  .voucher-popup-modal .ant-modal-content {
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
  }

  .voucher-popup-modal .ant-modal-body {
    border-radius: 20px !important;
    border: 0.5px solid var(--border---refly-Card-Border, rgba(0, 0, 0, 0.10)) !important;
    background: var(--bg---refly-bg-Glass-content, rgba(255, 255, 255, 0.90)) !important;
    box-shadow: var(--sds-size-depth-0) 6px 60px 0 rgba(0, 0, 0, 0.08) !important;
    backdrop-filter: blur(20px) !important;
  }

  .dark .voucher-popup-modal .ant-modal-body {
    background: var(--bg---refly-bg-Glass-content-dark, rgba(30, 30, 30, 0.90)) !important;
    border: 0.5px solid var(--border---refly-Card-Border-dark, rgba(255, 255, 255, 0.10)) !important;
  }
`;

interface VoucherPopupProps {
  visible: boolean;
  onClose: () => void;
  voucherResult: VoucherTriggerResult | null;
  onUseNow: () => void;
  onShare: () => void;
}

export const VoucherPopup = ({
  visible,
  onClose,
  voucherResult,
  onUseNow,
  onShare,
}: VoucherPopupProps) => {
  const { t } = useTranslation();

  if (!voucherResult) return null;

  const { voucher, score, feedback } = voucherResult;
  const discountPercent = voucher.discountPercent;

  return (
    <>
      <style>{glassmorphismStyles}</style>
      <Modal
        open={visible}
        footer={null}
        closable={true}
        onCancel={onClose}
        centered
        width={480}
        styles={{
          body: {
            padding: '24px',
          },
        }}
        className="voucher-popup-modal"
      >
        <div className="flex flex-col items-center w-full">
          {/* Gift Icon */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-4">
            <GiftOutlined className="text-3xl text-white" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            {t('voucher.popup.congratulations', '恭喜获得折扣券!')}
          </h2>

          {/* Discount Display */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-2xl my-4">
            <span className="text-5xl font-bold">{discountPercent}%</span>
            <span className="text-xl ml-2">{t('voucher.popup.off', 'OFF')}</span>
          </div>

          {/* Score Info */}
          {score !== undefined && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {t('voucher.popup.templateScore', '模板质量评分')}: {score}/100
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg mb-4 w-full">
              <span className="font-medium">{t('voucher.popup.tip', '提示')}: </span>
              {feedback}
            </div>
          )}

          {/* Expiration Notice */}
          <div className="text-sm text-orange-500 mb-4">
            {t('voucher.popup.expiresIn', '有效期 7 天，请尽快使用!')}
          </div>

          {/* Buttons */}
          <div className="flex gap-4 w-full">
            <Button icon={<ShareAltOutlined />} onClick={onShare} className="flex-1 h-10">
              {t('voucher.popup.shareToFriend', '分享给好友')}
            </Button>
            <Button
              type="primary"
              onClick={onUseNow}
              className="flex-1 h-10 bg-green-500 hover:bg-green-600 border-none"
            >
              {t('voucher.popup.useNow', '立即使用')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default VoucherPopup;
