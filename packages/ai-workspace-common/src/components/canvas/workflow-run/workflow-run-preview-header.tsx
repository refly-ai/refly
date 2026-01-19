import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Close } from 'refly-icons';
import { FiEye } from 'react-icons/fi';
import { Button } from 'antd';

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
                onClick={onToggleOutputsOnly}
                className={`flex border-0 items-center justify-center cursor-pointer hover:opacity-90 transition-opacity gap-1.5 p-0 w-28 h-6 rounded-full ${
                  outputsOnly ? 'bg-green-600' : 'bg-gray-100'
                }`}
              >
                <FiEye
                  size={16}
                  className={`flex-shrink-0 ${outputsOnly ? 'text-white' : 'text-gray-900'}`}
                  style={{ strokeWidth: '1.5px' }}
                />
                <span
                  className={`font-normal text-xs leading-4.5 whitespace-nowrap ${
                    outputsOnly ? 'text-white' : 'text-gray-900'
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
