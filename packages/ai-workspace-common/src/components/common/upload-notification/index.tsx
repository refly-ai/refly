import React, { memo, useEffect } from 'react';
import { message as antMessage } from 'antd';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useTranslation } from 'react-i18next';
import { useImageUploadStoreShallow } from '@refly/stores';
import { Cancelled, CheckCircle, SadFace } from 'refly-icons';

interface UploadNotificationProps {
  className?: string;
}

const UPLOAD_NOTIFICATION_MESSAGE_KEY = 'upload-notification';

export const UploadNotification: React.FC<UploadNotificationProps> = memo(({ className }) => {
  const { t } = useTranslation();
  const { uploads, isUploading, totalFiles, completedFiles, clearUploads } =
    useImageUploadStoreShallow((state) => ({
      uploads: state.uploads,
      isUploading: state.isUploading,
      totalFiles: state.totalFiles,
      completedFiles: state.completedFiles,
      clearUploads: state.clearUploads,
    }));

  // Ensure the singleton message is cleaned up when the component unmounts.
  useEffect(() => {
    return () => {
      antMessage.destroy(UPLOAD_NOTIFICATION_MESSAGE_KEY);
    };
  }, []);

  // Update notification with progress and completion status
  useEffect(() => {
    const safeUploads = uploads ?? [];
    const safeTotalFiles = totalFiles ?? 0;
    const safeCompletedFiles = completedFiles ?? 0;

    if (safeUploads.length > 0) {
      const successCount = safeUploads.filter((upload) => upload.status === 'success').length;
      const errorCount = safeUploads.filter((upload) => upload.status === 'error').length;
      const isCompleted = !isUploading && safeCompletedFiles === safeTotalFiles;

      // Determine notification type and content based on completion status
      let notificationType: 'open' | 'success' | 'warning' | 'error' = 'open';

      let duration = 0;

      if (isCompleted) {
        if (errorCount === 0) {
          // All successful
          notificationType = 'success';
          duration = 3;
        } else if (successCount > 0) {
          // Partial success
          notificationType = 'warning';
          duration = 5;
        } else {
          // All failed
          notificationType = 'error';
          duration = 5;
        }
      }

      // Show notification based on type
      if (notificationType === 'success') {
        antMessage.success({
          key: UPLOAD_NOTIFICATION_MESSAGE_KEY,
          icon: <CheckCircle className="mr-1" size={18} />,
          content: t('common.upload.notification.allUploaded'),
          duration,
        });
      } else if (notificationType === 'warning') {
        antMessage.warning({
          key: UPLOAD_NOTIFICATION_MESSAGE_KEY,
          icon: <Cancelled color="var(--refly-func-warning-default)" className="mr-1" size={18} />,
          content: t('common.upload.notification.partialSuccessDesc', {
            success: successCount,
            error: errorCount,
          }),
          duration,
        });
      } else if (notificationType === 'error') {
        antMessage.error({
          key: UPLOAD_NOTIFICATION_MESSAGE_KEY,
          icon: <SadFace className="mr-1" size={18} />,
          content: t('common.upload.notification.allFailed'),
          duration,
        });
      } else {
        antMessage.loading({
          key: UPLOAD_NOTIFICATION_MESSAGE_KEY,
          content: t('common.upload.notification.uploading'),
          duration,
          icon: <Spin className="text-refly-primary-default mr-2" size="small" />,
        });
      }
      let clearTimeoutId: ReturnType<typeof setTimeout> | undefined;

      // Clear uploads after completion notification
      if (isCompleted) {
        clearTimeoutId = setTimeout(() => {
          clearUploads();
        }, 1000);
      }

      return () => {
        if (clearTimeoutId) {
          clearTimeout(clearTimeoutId);
        }
      };
    }

    // If uploads are cleared, ensure we don't leave an infinite-duration message hanging around.
    antMessage.destroy(UPLOAD_NOTIFICATION_MESSAGE_KEY);
  }, [uploads, isUploading, completedFiles, totalFiles, t, clearUploads, className]);

  return null;
});

UploadNotification.displayName = 'UploadNotification';
