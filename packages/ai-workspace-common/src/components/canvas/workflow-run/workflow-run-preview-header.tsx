import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Close } from 'refly-icons';
import { IoEyeOutline } from 'react-icons/io5';
import { Button } from 'antd';
import cn from 'classnames';
import { logEvent } from '@refly/telemetry-web';

interface WorkflowRunPreviewHeaderProps {
  onClose?: () => void;
  onToggleOutputsOnly?: () => void;
  outputsOnly?: boolean;
  showOutputsOnlyButton?: boolean;
}

const WorkflowRunPreviewHeaderComponent = ({
  onClose,
  onToggleOutputsOnly,
  outputsOnly = false,
  showOutputsOnlyButton = true,
}: WorkflowRunPreviewHeaderProps) => {
  const { t } = useTranslation();

  const handleClickOutputsOnly = useCallback(() => {
    logEvent('only_view_result', outputsOnly ? 'off' : 'on');
    onToggleOutputsOnly?.();
  }, [onToggleOutputsOnly, outputsOnly]);

  return (
    <div className="flex flex-col bg-white">
      <div className="flex items-center px-3 py-2 pl-4 h-16">
        {/* Left side - Title */}
        <div className="flex items-center flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-base leading-6 text-gray-900">
              {t('canvas.workflow.run.preview')}
            </span>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center flex-shrink-0 gap-3">
          {/* Outputs only button */}
          {showOutputsOnlyButton && (
            <>
              <button
                type="button"
                onClick={handleClickOutputsOnly}
                className={cn(
                  'flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity p-0 w-[114px] h-6 rounded-[20px] gap-1.5',
                  outputsOnly
                    ? 'bg-green-600 border-none'
                    : 'bg-white border border-solid border-[#D0D5DD] box-border',
                )}
              >
                <IoEyeOutline
                  size={16}
                  className={`flex-shrink-0 ${outputsOnly ? 'text-white' : 'text-[#1C1F23]'}`}
                />
                <span
                  className={`font-normal text-xs leading-[18px] whitespace-nowrap ${
                    outputsOnly ? 'text-white' : 'text-[#1C1F23]'
                  }`}
                >
                  {t('canvas.workflow.run.outputsOnly')}
                </span>
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-black/10" />
            </>
          )}

          {/* Close button */}
          <Button
            type="text"
            icon={<Close size={24} />}
            onClick={onClose}
            className="flex items-center justify-center p-0 w-6 h-6"
          />
        </div>
      </div>
      {/* Bottom divider */}
      <div className="w-full h-px bg-black/10" />
    </div>
  );
};

export const WorkflowRunPreviewHeader = memo(WorkflowRunPreviewHeaderComponent);
