import React, { memo, useEffect } from 'react';
import { notification } from 'antd';
import { useTranslation } from 'react-i18next';
import { useImageUploadStoreShallow } from '@refly/stores';
import { cn } from '@refly/utils';
import { IconImportResource } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Completed, Close } from 'refly-icons';

interface UploadNotificationProps {
  className?: string;
}

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

  // Update notification with progress and completion status
  useEffect(() => {
    if (uploads.length > 0) {
      const key = 'image-upload-progress';
      const progress = Math.round((completedFiles / totalFiles) * 100);
      const successCount = uploads.filter((upload) => upload.status === 'success').length;
      const errorCount = uploads.filter((upload) => upload.status === 'error').length;
      const isCompleted = !isUploading && completedFiles === totalFiles;

      // Determine notification type and content based on completion status
      let notificationType: 'open' | 'success' | 'warning' | 'error' = 'open';
      let icon = <IconImportResource className="text-refly-primary-default" />;
      let message =
        t('common.upload.notification.uploading', {
          count: totalFiles,
          suffix: totalFiles > 1 ? 's' : '',
        }) || `Uploading ${totalFiles} files`;
      let duration = 0;

      if (isCompleted) {
        if (errorCount === 0) {
          // All successful
          notificationType = 'success';
          icon = <Completed color="var(--refly-func-success-default)" />;
          message =
            t('common.upload.notification.success', {
              count: successCount,
              suffix: successCount > 1 ? 's' : '',
            }) || `Successfully uploaded ${successCount} files`;
          duration = 3;
        } else if (successCount > 0) {
          // Partial success
          notificationType = 'warning';
          icon = <Close color="var(--refly-func-warning-default)" />;
          message =
            t('common.upload.notification.partialSuccess') || 'Upload completed with some errors';
          duration = 5;
        } else {
          // All failed
          notificationType = 'error';
          icon = <Close color="var(--refly-func-danger-default)" />;
          message = t('common.upload.notification.failed') || 'Upload failed';
          duration = 5;
        }
      }

      const description = isCompleted ? (
        <div className="space-y-2">
          {errorCount === 0 ? (
            <div className="text-sm text-refly-func-success-default">
              {t('common.upload.notification.allUploaded') ||
                'All images have been uploaded successfully'}
            </div>
          ) : successCount > 0 ? (
            <div className="text-sm text-refly-func-warning-default">
              {t('common.upload.notification.partialSuccessDesc', {
                success: successCount,
                error: errorCount,
              }) || `${successCount} successful, ${errorCount} failed`}
            </div>
          ) : (
            <div className="text-sm text-refly-func-danger-default">
              {t('common.upload.notification.allFailed') || 'All images failed to upload'}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-refly-text-1">
            {t('common.upload.notification.progress', {
              completed: completedFiles,
              total: totalFiles,
            }) || `${completedFiles} of ${totalFiles} completed`}
          </div>
          <div className="w-full bg-refly-bg-control-z0 rounded-full h-2">
            <div
              className="bg-refly-primary-default h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-refly-text-2">
            {progress}% {t('common.upload.notification.complete') || 'complete'}
          </div>
        </div>
      );

      // Show notification based on type
      if (notificationType === 'success') {
        notification.success({
          key,
          message,
          description,
          duration,
          icon,
          className: cn('upload-notification', className),
        });
      } else if (notificationType === 'warning') {
        notification.warning({
          key,
          message,
          description,
          duration,
          icon,
          className: cn('upload-notification', className),
        });
      } else if (notificationType === 'error') {
        notification.error({
          key,
          message,
          description,
          duration,
          icon,
          className: cn('upload-notification', className),
        });
      } else {
        notification.open({
          key,
          message,
          description,
          duration,
          icon,
          className: cn('upload-notification', className),
        });
      }
      let clearTimeoutId: NodeJS.Timeout;

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
  }, [uploads, isUploading, completedFiles, totalFiles, t, clearUploads, className]);

  return null;
});

UploadNotification.displayName = 'UploadNotification';
