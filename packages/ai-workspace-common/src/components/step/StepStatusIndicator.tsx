import React from 'react';
import { StepNodeStatus } from '@refly/common-types';

interface StepStatusIndicatorProps {
  status: StepNodeStatus;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const StepStatusIndicator: React.FC<StepStatusIndicatorProps> = ({
  status,
  size = 'medium',
  className = '',
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8',
  };

  const renderIcon = () => {
    switch (status) {
      case StepNodeStatus.PENDING:
        return (
          <div className={`border-2 border-gray-300 rounded-full ${sizeClasses[size]} bg-white`} />
        );

      case StepNodeStatus.RUNNING:
        return (
          <div
            className={`bg-green-500 rounded-full ${sizeClasses[size]} flex items-center justify-center animate-pulse`}
          >
            <svg
              className="w-3/4 h-3/4 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );

      case StepNodeStatus.COMPLETED:
        return (
          <div
            className={`bg-green-500 rounded-full ${sizeClasses[size]} flex items-center justify-center`}
          >
            <svg
              className="w-3/4 h-3/4 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 13.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );

      default:
        return (
          <div className={`border-2 border-gray-300 rounded-full ${sizeClasses[size]} bg-white`} />
        );
    }
  };

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>{renderIcon()}</div>
  );
};

export default StepStatusIndicator;
