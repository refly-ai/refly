import { memo, useCallback, useRef } from 'react';
import { Button, Tooltip } from 'antd';
import { Attachment, Send, Stop } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly/utils/cn';
import { ACCEPT_FILE_EXTENSIONS } from '../workflow-variables/constants';

interface CopilotActionsProps {
  query: string;
  fileCount: number;
  maxFileCount: number;
  isExecuting: boolean;
  isUploading: boolean;
  onUploadFiles: (files: File[]) => Promise<void>;
  onSendMessage: () => void;
  onAbort?: () => void;
}

export const CopilotActions = memo(
  ({
    query,
    fileCount,
    maxFileCount,
    isExecuting,
    isUploading,
    onUploadFiles,
    onSendMessage,
    onAbort,
  }: CopilotActionsProps) => {
    const { t } = useTranslation();
    const uploadRef = useRef<HTMLInputElement>(null);

    const uploadDisabled = fileCount >= maxFileCount;
    const canSend = (query?.trim() || fileCount > 0) && !isUploading;
    const acceptExtensions = ACCEPT_FILE_EXTENSIONS ?? [];
    const acceptValue =
      acceptExtensions?.length > 0 ? acceptExtensions.map((ext) => `.${ext}`).join(',') : undefined;

    const handleFileChange = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files?.length) return;

        // Use batch upload to handle multiple files atomically
        await onUploadFiles(Array.from(files));
        // Reset input
        e.target.value = '';
      },
      [onUploadFiles],
    );

    const handleAttachmentClick = useCallback(() => {
      if (!uploadDisabled) {
        uploadRef.current?.click();
      }
    }, [uploadDisabled]);

    const attachmentButton = (
      <Button
        type="text"
        icon={<Attachment size={20} />}
        onClick={handleAttachmentClick}
        disabled={fileCount >= 10}
        className="!text-refly-text-0 "
      />
    );

    return (
      <div className="flex items-center justify-between mt-2">
        {/* Left side: Attachment button - direct upload */}
        <div className="flex items-center">
          <Tooltip
            title={uploadDisabled ? t('copilot.maxFilesPerTask') : t('copilot.uploadFile')}
            placement="top"
            overlayInnerStyle={{ borderRadius: '8px' }}
            color="#000"
          >
            <div className="flex items-center justify-center">{attachmentButton}</div>
          </Tooltip>

          {/* Hidden file upload input */}
          <input
            ref={uploadRef}
            type="file"
            multiple
            accept={acceptValue}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Right side: Send/Stop button */}
        <div className="flex items-center">
          {isExecuting ? (
            <button
              type="button"
              className="w-9 h-9 rounded-full bg-[#1C1F23] hover:bg-[#3D4043] flex items-center justify-center border-none cursor-pointer transition-colors"
              onClick={onAbort}
            >
              <Stop size={20} color="white" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!canSend}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center border-none transition-colors',
                canSend
                  ? 'bg-[#1C1F23] hover:bg-[#3D4043] cursor-pointer'
                  : 'bg-[rgba(28,31,35,0.1)] cursor-not-allowed',
              )}
              onClick={onSendMessage}
            >
              <Send size={20} color="white" />
            </button>
          )}
        </div>
      </div>
    );
  },
);

CopilotActions.displayName = 'CopilotActions';
