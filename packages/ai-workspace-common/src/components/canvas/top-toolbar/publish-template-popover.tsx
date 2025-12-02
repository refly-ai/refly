import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { Popover, Button, Input, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { LuLink, LuRefreshCw } from 'react-icons/lu';

interface PublishTemplatePopoverProps {
  shareId?: string;
  onUpdateTemplate: () => void;
  onOpen?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export const PublishTemplatePopover = React.memo(
  ({ shareId, onUpdateTemplate, onOpen, disabled, children }: PublishTemplatePopoverProps) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const shareLink = useMemo(() => {
      if (!shareId) {
        return '';
      }
      return getShareLink('workflowApp', shareId);
    }, [shareId]);

    const handleCopy = useCallback(async () => {
      if (!shareLink) {
        return;
      }

      // Clear any existing timeout
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }

      try {
        const ok = await copyToClipboard(shareLink);
        if (ok) {
          setLinkCopied(true);
          message.success(t('shareContent.linkCopied'));
          copyTimeoutRef.current = setTimeout(() => {
            setLinkCopied(false);
            copyTimeoutRef.current = null;
          }, 2000);
        } else {
          message.error(t('common.operationFailed'));
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to copy link:', error);
        message.error(t('common.operationFailed'));
      }
    }, [shareLink, t]);

    // Reset linkCopied state when shareId changes
    useEffect(() => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
      setLinkCopied(false);
    }, [shareId]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
          copyTimeoutRef.current = null;
        }
      };
    }, []);

    const handleUpdateTemplate = useCallback(() => {
      setOpen(false);
      onUpdateTemplate();
    }, [onUpdateTemplate]);

    const content = (
      <div
        className="w-[480px] bg-white dark:bg-refly-bg-content-z2 rounded-[12px] border border-refly-Card-Border py-4"
        style={{
          boxShadow: '0px 8px 40px 0px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Title - x: 24, y: 24, width: 432, height: 24 */}
        <div className="px-6 pt-6 h-6 flex items-center justify-between">
          <h3 className="text-lg leading-6 font-semibold text-refly-text-0">
            {t('shareContent.publishTemplate')}
          </h3>
        </div>

        {/* Content Area - x: 24, y: 64, gap: 10px */}
        <div className="px-6 pt-4 flex flex-col gap-2.5">
          {/* URL Input Section - width: 432, height: 48, padding: 8px 8px 8px 16px, gap: 12px */}
          <div className="w-[432px]">
            {/* Separator line - padding: 10px means left/right padding, height should be part of the container */}
            <div className="px-[6px] py-[6px]" />
            {/* URL Input Container */}
            <div className="w-[432px] h-12 bg-refly-tertiary-default dark:bg-refly-bg-control-z0 rounded-xl flex items-center gap-3 pl-4 pr-2 py-2">
              <div className="flex-1 min-w-0">
                <Input
                  value={shareLink}
                  readOnly
                  className="border-0 bg-transparent p-0 text-xs leading-[22px] text-refly-text-1 placeholder:text-refly-text-3 focus:shadow-none"
                  placeholder=""
                />
              </div>
              <Button
                type="default"
                size="small"
                icon={<LuLink size={16} />}
                onClick={handleCopy}
                disabled={!shareLink}
                className="flex items-center gap-1 px-[14px] py-[6px] h-auto bg-refly-bg-content-z1 border border-refly-Card-Border rounded-lg text-refly-text-0 font-semibold hover:bg-refly-tertiary-hover hover:border-refly-Card-Border disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderWidth: '0.5px',
                }}
              >
                {linkCopied ? t('shareContent.linkCopied') : t('shareContent.copy')}
              </Button>
            </div>
          </div>

          {/* Update Template Button Section - width: 432, padding: 8px 0px 8px 16px, gap: 12px */}
          <div className="flex justify-end gap-3 pl-4 pr-0 py-2">
            <Button
              type="primary"
              size="small"
              icon={<LuRefreshCw size={16} />}
              onClick={handleUpdateTemplate}
              className="flex items-center gap-1 px-[14px] py-[6px] h-auto bg-refly-primary-default hover:bg-refly-primary-hover border-0 rounded-lg text-white font-semibold"
            >
              {t('shareContent.updateTemplate')}
            </Button>
          </div>
        </div>
      </div>
    );

    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        // Prevent opening if disabled
        if (newOpen && disabled) {
          return;
        }
        setOpen(newOpen);
        if (newOpen && onOpen) {
          onOpen();
        } else if (!newOpen) {
          // Reset linkCopied state when popover closes
          if (copyTimeoutRef.current) {
            clearTimeout(copyTimeoutRef.current);
            copyTimeoutRef.current = null;
          }
          setLinkCopied(false);
        }
      },
      [onOpen, disabled],
    );

    return (
      <Popover
        open={open}
        onOpenChange={handleOpenChange}
        content={content}
        placement="bottom"
        trigger="click"
        overlayClassName="publish-template-popover"
        styles={{ body: { padding: 0 } }}
        rootClassName="publish-template-popover-root"
      >
        {children}
      </Popover>
    );
  },
);

PublishTemplatePopover.displayName = 'PublishTemplatePopover';
