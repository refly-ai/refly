import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Checkbox } from 'antd';
import { cn } from '@refly/utils/cn';
import { NexuIcon } from './NexuIcon';
import { logEvent } from '@refly/telemetry-web';
import { LuMessageSquare, LuShield, LuGitFork } from 'react-icons/lu';

const NEXU_URL = 'https://nexu.io';
const STORAGE_KEY = 'nexu_modal_dismissed';
const SESSION_KEY = 'nexu_modal_shown_this_session';

interface NexuModalProps {
  open?: boolean;
}

export const NexuModal = memo(({ open: controlledOpen }: NexuModalProps) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [neverShow, setNeverShow] = useState(false);

  useEffect(() => {
    // Check if user has permanently dismissed the modal
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed === 'true') {
      return;
    }

    // Only show once per browser session (avoid re-showing on SPA navigation)
    const shownThisSession = sessionStorage.getItem(SESSION_KEY);
    if (shownThisSession === 'true') {
      return;
    }

    // Show modal after a short delay
    const timer = setTimeout(() => {
      setVisible(true);
      sessionStorage.setItem(SESSION_KEY, 'true');
      logEvent('refly_nexu_workbench_modal_shown');
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Allow controlled open state
  useEffect(() => {
    if (controlledOpen !== undefined) {
      setVisible(controlledOpen);
    }
  }, [controlledOpen]);

  const handleClose = useCallback(() => {
    setVisible(false);
    if (neverShow) {
      localStorage.setItem(STORAGE_KEY, 'true');
      logEvent('refly_nexu_workbench_modal_click_never_show');
    } else {
      logEvent('refly_nexu_workbench_modal_dismiss');
    }
  }, [neverShow]);

  const handleDownload = useCallback(() => {
    logEvent('refly_nexu_workbench_modal_click_download');
    window.open(NEXU_URL, '_blank');
    setVisible(false);
    if (neverShow) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  }, [neverShow]);

  const handleNeverShowChange = useCallback((checked: boolean) => {
    setNeverShow(checked);
  }, []);

  const features = [
    {
      icon: <LuMessageSquare size={18} />,
      text: t('nexuPromotion.modal.feature1'),
    },
    {
      icon: <LuShield size={18} />,
      text: t('nexuPromotion.modal.feature2'),
    },
    {
      icon: <LuGitFork size={18} />,
      text: t('nexuPromotion.modal.feature3'),
    },
  ];

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      footer={null}
      centered
      width="fit-content"
      style={{ maxWidth: 640 }}
      className="nexu-modal"
      styles={{
        body: { padding: 0 },
      }}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <NexuIcon size={36} className="text-[#2c2a2b] dark:text-white flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white m-0 whitespace-nowrap">
              {t('nexuPromotion.modal.title')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 m-0">
              {t('nexuPromotion.modal.subtitle')}
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-3 mb-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg',
                'bg-gray-50 dark:bg-gray-800/50',
              )}
            >
              <div className="text-[#0E9F77]">{feature.icon}</div>
              <span className="text-sm text-gray-700 dark:text-gray-300">{feature.text}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            type="primary"
            size="large"
            block
            onClick={handleDownload}
            className="!bg-[#0E9F77] !border-[#0E9F77] hover:!bg-[#0a7d5e] !h-11"
          >
            {t('nexuPromotion.modal.downloadBtn')}
          </Button>

          <Checkbox
            checked={neverShow}
            onChange={(e) => handleNeverShowChange(e.target.checked)}
            className="text-sm text-gray-500 dark:text-gray-400"
          >
            {t('nexuPromotion.modal.neverShow')}
          </Checkbox>
        </div>
      </div>
    </Modal>
  );
});

NexuModal.displayName = 'NexuModal';
