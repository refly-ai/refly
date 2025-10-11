import React from 'react';
import { Button } from 'antd';
import logoIcon from '@refly-packages/ai-workspace-common/assets/logo.svg';

/**
 * CTA Button component following Figma design specifications
 * - Green theme: #0E9F77
 * - Text: "立即使用"
 * - Height: 48px
 * - Border radius: 12px
 * - Includes Refly icon
 * - PingFang SC font
 */
interface CTAButtonProps {
  onClick?: () => void;
}

const CTAButton: React.FC<CTAButtonProps> = ({ onClick }) => {
  return (
    <Button
      type="primary"
      size="large"
      onClick={onClick}
      className="flex items-center justify-center gap-3"
      style={{
        fontFamily: 'PingFang SC, -apple-system, BlinkMacSystemFont, sans-serif',
        fontWeight: 600,
      }}
    >
      <img
        src={logoIcon}
        className="w-6 h-6"
        alt="Refly icon"
        style={{
          width: '24px',
          height: '24px',
        }}
      />
      <span style={{ color: '#FFFFFF' }}>立即使用</span>
    </Button>
  );
};

export default CTAButton;
