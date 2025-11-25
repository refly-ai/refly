import { Button } from 'antd';
import React from 'react';
import { Github } from 'refly-icons';
import Google from '../../assets/google.svg';

interface OAuthButtonProps {
  provider: 'github' | 'google';
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  loadingText: string;
  buttonText: string;
}

const OAuthButton: React.FC<OAuthButtonProps> = ({
  provider,
  onClick,
  loading,
  disabled,
  loadingText,
  buttonText,
}) => {
  const renderIcon = () => {
    if (provider === 'github') {
      return (
        <span className="mr-2 inline-flex items-center">
          <Github size={20} />
        </span>
      );
    }
    if (provider === 'google') {
      return <img src={Google} alt="google" className="mr-2 h-4 w-4" />;
    }
    return null;
  };

  const getDataCy = () => {
    return `${provider}-login-button`;
  };

  return (
    <Button
      onClick={onClick}
      type="default"
      className="w-full font-semibold flex items-center justify-center transition-colors oauth-button"
      style={{
        height: '52px',
        padding: '16px 12px',
        borderRadius: '12px',
        backgroundColor: 'var(--refly-oauth-button-bg, #fdfdfd)',
        border: '1px solid var(--refly-border-divider, rgba(0, 0, 0, 0.08))',
        boxShadow: '0px 2px 20px 4px rgba(0, 0, 0, 0.04)',
        fontSize: '14px',
        fontWeight: 600,
        lineHeight: '1.4285714285714286em',
        color: 'var(--refly-text-0)',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.opacity = '0.8';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.opacity = '1';
        }
      }}
      data-cy={getDataCy()}
      loading={loading}
      disabled={disabled}
    >
      {renderIcon()}
      {loading ? loadingText : buttonText}
    </Button>
  );
};

// Optimize with memo to prevent unnecessary re-renders
export const MemoizedOAuthButton = React.memo(OAuthButton);
export { MemoizedOAuthButton as OAuthButton };
