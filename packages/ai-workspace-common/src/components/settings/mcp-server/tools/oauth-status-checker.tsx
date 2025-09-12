import React, { useState, useEffect, useCallback } from 'react';
import { Button, Alert } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import Google from '../../../../../../web-core/src/assets/google.svg';

interface AuthPattern {
  type: string;
  provider: string;
  scope: string[];
}

interface OAuthStatusCheckerProps {
  authPattern: AuthPattern;
  onAuthRequired: () => void;
  onStatusChange?: (status: AuthStatus) => void;
}

type AuthStatus = 'checking' | 'authorized' | 'unauthorized' | 'error';

const OAuthStatusChecker: React.FC<OAuthStatusCheckerProps> = ({
  authPattern,
  onAuthRequired,
  onStatusChange,
}) => {
  const { t } = useTranslation();
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');

  const checkOAuthStatus = useCallback(async () => {
    try {
      setAuthStatus('checking');
      onStatusChange?.('checking');

      const { data } = await getClient().checkToolOauthStatus({
        query: {
          provider: authPattern.provider,
          scope: authPattern.scope.join(','),
        },
      });

      const newStatus = data.data.authorized ? 'authorized' : 'unauthorized';
      setAuthStatus(newStatus);
      onStatusChange?.(newStatus);
    } catch (error) {
      console.error('Failed to check OAuth status:', error);
      setAuthStatus('error');
      onStatusChange?.('error');
    }
  }, [authPattern.provider, authPattern.scope, onStatusChange]);

  useEffect(() => {
    checkOAuthStatus();
  }, [checkOAuthStatus]);

  const renderStatusContent = () => {
    switch (authStatus) {
      case 'checking':
        return (
          <div className="flex items-center gap-2 text-gray-600">
            <LoadingOutlined size={16} />
            <span>{t('settings.toolStore.oauth.checking')}</span>
          </div>
        );

      case 'authorized':
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircleOutlined size={16} />
            <span>{t('settings.toolStore.oauth.authorized')}</span>
          </div>
        );

      case 'unauthorized':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-orange-600">
              <ExclamationCircleOutlined size={16} />
              <span>{t('settings.toolStore.oauth.required')}</span>
            </div>
            <Button
              onClick={onAuthRequired}
              type="default"
              variant="filled"
              className="h-[52px] w-full font-semibold text-refly-text-0 border-refly-Card-Border !shadow-md !bg-white"
              loading={false}
              disabled={false}
            >
              {authPattern.provider === 'google' && (
                <img src={Google} alt="google" className="mr-1 h-4 w-4" />
              )}
              {t('settings.toolStore.oauth.authorizeWith', { provider: authPattern.provider })}
            </Button>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-2">
            <Alert message={t('settings.toolStore.oauth.checkFailed')} type="error" showIcon />
            <Button onClick={checkOAuthStatus} size="small" className="w-full">
              {t('common.retry')}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return <div className="oauth-status-checker">{renderStatusContent()}</div>;
};

// Optimize with memo to prevent unnecessary re-renders
export const MemoizedOAuthStatusChecker = React.memo(OAuthStatusChecker);
export { MemoizedOAuthStatusChecker as OAuthStatusChecker };
