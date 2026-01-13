import { memo } from 'react';
import { Close } from 'refly-icons';
import { FiEye } from 'react-icons/fi';
import { Button } from 'antd';

interface WorkflowRunPreviewHeaderProps {
  onClose?: () => void;
  onToggleOutputsOnly?: () => void;
  outputsOnly?: boolean;
}

const WorkflowRunPreviewHeaderComponent = ({
  onClose,
  onToggleOutputsOnly,
  outputsOnly: _outputsOnly = false,
}: WorkflowRunPreviewHeaderProps) => {
  return (
    <div className="flex flex-col bg-white">
      <div
        className="flex items-center"
        style={{
          padding: '8px 12px 8px 16px',
          height: '64px',
        }}
      >
        {/* Left side - Title */}
        <div className="flex items-center flex-1 min-w-0">
          <div
            className="flex items-center"
            style={{
              gap: '4px',
            }}
          >
            <span
              style={{
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: '16px',
                lineHeight: '1.5em',
                color: '#1C1F23',
              }}
            >
              Preview
            </span>
          </div>
        </div>

        {/* Right side - Actions */}
        <div
          className="flex items-center flex-shrink-0"
          style={{
            gap: '12px',
          }}
        >
          {/* Outputs only button */}
          <button
            type="button"
            onClick={onToggleOutputsOnly}
            className="flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
            style={{
              width: '114px',
              height: '24px',
              backgroundColor: '#0E9F77',
              border: '1px solid #0E9F77',
              borderRadius: '20px',
              gap: '6px',
              padding: 0,
            }}
          >
            <FiEye
              size={16}
              style={{
                color: '#FFFFFF',
                strokeWidth: '1.5px',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: 'Inter',
                fontWeight: 400,
                fontSize: '12px',
                lineHeight: '1.5em',
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
              }}
            >
              Outputs only
            </span>
          </button>

          {/* Divider */}
          <div
            style={{
              width: '1px',
              height: '20px',
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
            }}
          />

          {/* Close button */}
          <Button
            type="text"
            icon={<Close size={24} />}
            onClick={onClose}
            style={{
              padding: 0,
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </div>
      </div>
      {/* Bottom divider */}
      <div
        style={{
          width: '100%',
          height: '1px',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
        }}
      />
    </div>
  );
};

export const WorkflowRunPreviewHeader = memo(WorkflowRunPreviewHeaderComponent);
