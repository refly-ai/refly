import { CheckCircleOutlined, ExclamationCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { Button, message } from 'antd';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Google from '../../../../../../web-core/src/assets/google.svg';
import {
  composioOAuthStatusKey,
  useComposioOAuthAuthorize,
  useComposioOAuthRevoke,
  useComposioOAuthStatus,
} from '../../../../hooks/use-composio-oauth';

/**
 * OAuth status checker - uses Composio backend service for OAuth management
 * Checks connection status and initiates OAuth flow through backend API
 */

interface AuthPattern {
  type: string;
  provider: string;
  scope: string[];
}

interface OAuthStatusCheckerProps {
  authPattern?: AuthPattern; // Optional for backward compatibility
  onStatusChange?: (status: AuthStatus) => void;
  toolKey: string; // Tool key to map to Composio app slug (required)
}

type AuthStatus = 'authorized' | 'unauthorized';

/**
 * Loading status component - shows checking status
 */
const LoadingStatus: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-gray-600">
      <LoadingOutlined size={16} />
      <span>{t('settings.toolStore.oauth.checking')}</span>
    </div>
  );
};

/**
 * Common OAuth status component - abstracted for both authorized and unauthorized states
 */
interface OAuthStatusDisplayProps {
  statusText: string;
  statusIcon: React.ReactNode;
  statusColor: string;
  buttonText: string | React.ReactNode;
  buttonTextColor: string;
  onButtonClick: () => Promise<void>;
  isLoading: boolean;
}

const OAuthStatusDisplay: React.FC<OAuthStatusDisplayProps> = ({
  statusText,
  statusIcon,
  statusColor,
  buttonText,
  buttonTextColor,
  onButtonClick,
  isLoading,
}) => {
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 ${statusColor}`}>
        {statusIcon}
        <span>{statusText}</span>
      </div>
      <Button
        onClick={onButtonClick}
        type="default"
        variant="filled"
        className={`h-[52px] w-full font-semibold ${buttonTextColor} border-refly-Card-Border !shadow-md !bg-white`}
        loading={isLoading}
        disabled={isLoading}
      >
        {buttonText}
      </Button>
    </div>
  );
};

/**
 * Authorized status component - shows authorized status with revoke button
 */
interface AuthorizedStatusProps {
  composioApp: string;
  authPattern?: AuthPattern;
  onRevoke: () => Promise<void>;
  isRevoking: boolean;
}

const AuthorizedStatus: React.FC<AuthorizedStatusProps> = ({
  composioApp,
  authPattern,
  onRevoke,
  isRevoking,
}) => {
  const { t } = useTranslation();

  const buttonContent = (
    <>
      {authPattern?.provider === 'google' && (
        <img src={Google} alt="google" className="mr-1 h-4 w-4" />
      )}
      {t('settings.toolStore.oauth.revokeWith', {
        provider:
          (authPattern?.provider || composioApp).charAt(0).toUpperCase() +
          (authPattern?.provider || composioApp).slice(1),
      })}
    </>
  );

  return (
    <OAuthStatusDisplay
      statusText={t('settings.toolStore.oauth.authorized')}
      statusIcon={<CheckCircleOutlined size={16} />}
      statusColor="text-green-600"
      buttonText={buttonContent}
      buttonTextColor="text-red-600"
      onButtonClick={onRevoke}
      isLoading={isRevoking}
    />
  );
};

/**
 * Unauthorized status component - shows authorization required with authorize button
 */
interface UnauthorizedStatusProps {
  composioApp: string;
  authPattern?: AuthPattern;
  onAuthorize: () => Promise<void>;
  isConnecting: boolean;
}

const UnauthorizedStatus: React.FC<UnauthorizedStatusProps> = ({
  composioApp,
  authPattern,
  onAuthorize,
  isConnecting,
}) => {
  const { t } = useTranslation();

  const buttonContent = (
    <>
      {authPattern?.provider === 'google' && (
        <img src={Google} alt="google" className="mr-1 h-4 w-4" />
      )}
      {t('settings.toolStore.oauth.authorizeWith', {
        provider:
          (authPattern?.provider || composioApp).charAt(0).toUpperCase() +
          (authPattern?.provider || composioApp).slice(1),
      })}
    </>
  );

  return (
    <OAuthStatusDisplay
      statusText={t('settings.toolStore.oauth.required')}
      statusIcon={<ExclamationCircleOutlined size={16} />}
      statusColor="text-orange-600"
      buttonText={buttonContent}
      buttonTextColor="text-refly-text-0"
      onButtonClick={onAuthorize}
      isLoading={isConnecting}
    />
  );
};

/**
 * Main OAuth Status Checker Component
 */
const OAuthStatusChecker: React.FC<OAuthStatusCheckerProps> = ({
  toolKey,
  authPattern,
  onStatusChange,
}) => {
  const queryClient = useQueryClient();
  const composioApp = toolKey;
  // Use React Query hook to check OAuth status
  const {
    data: statusData,
    isLoading,
    error,
  } = useComposioOAuthStatus(composioApp, {
    enabled: !!composioApp,
    refetchOnMount: true,
  });

  // Use mutation hook for authorization
  const { mutateAsync: authorizeOAuth, isPending: isConnecting } = useComposioOAuthAuthorize({
    onSuccess: (data) => {
      console.log('Received OAuth initiation data:', data);

      // Save connectionRequestId and app info to localStorage for polling
      localStorage.setItem(
        'composio_pending_oauth',
        JSON.stringify({
          connectionRequestId: data.connectionRequestId,
          app: composioApp,
          toolKey: toolKey,
          timestamp: Date.now(),
        }),
      );

      // Open Composio OAuth page in a new window
      window.open(data.redirectUrl, '_blank', 'noopener,noreferrer');
    },
    onError: (error) => {
      console.error('Failed to initiate Composio connection:', error);
      message.error(error.message || 'Failed to initiate OAuth authorization');
    },
  });

  // Use mutation hook for revoking authorization
  const { mutateAsync: revokeOAuth, isPending: isRevoking } = useComposioOAuthRevoke({
    onSuccess: (data) => {
      message.success(data.message || 'Authorization revoked successfully');
      // Invalidate query to refetch status
      queryClient.invalidateQueries({ queryKey: [composioOAuthStatusKey, composioApp] });
      onStatusChange?.('unauthorized');
    },
    onError: (error) => {
      console.error('Failed to revoke Composio connection:', error);
      message.error(error.message || 'Failed to revoke authorization');
    },
  });

  // Notify parent component when status changes
  useEffect(() => {
    if (statusData) {
      const authStatus = statusData.status === 'active' ? 'authorized' : 'unauthorized';
      onStatusChange?.(authStatus);
    }
  }, [statusData, onStatusChange]);

  // Handle errors
  useEffect(() => {
    if (error) {
      console.error('Failed to check OAuth status:', error);
      onStatusChange?.('unauthorized');
    }
  }, [error, onStatusChange]);

  /**
   * Handle authorization - initiate OAuth flow
   */
  const handleAuthorize = async () => {
    console.log(`Starting OAuth flow for tool key: ${toolKey}`);
    if (!composioApp) {
      console.error(`No Composio app mapping found for tool key: ${toolKey}`);
      message.error('Invalid tool configuration');
      return;
    }

    console.log(`Initiating OAuth flow for Composio app: ${composioApp}`);
    await authorizeOAuth(composioApp);
  };

  /**
   * Handle revoke - remove authorization
   */
  const handleRevoke = async () => {
    console.log(`Revoking OAuth connection for tool key: ${toolKey}`);
    if (!composioApp) {
      console.error(`No Composio app mapping found for tool key: ${toolKey}`);
      message.error('Invalid tool configuration');
      return;
    }

    await revokeOAuth(composioApp);
  };

  /**
   * Render status content based on current auth status
   */
  const renderStatusContent = () => {
    // Show loading state while checking or if no composio app mapping
    if (isLoading || !composioApp || !statusData) {
      return <LoadingStatus />;
    }

    // Show authorized status with revoke button
    if (statusData.status === 'active') {
      return (
        <AuthorizedStatus
          composioApp={composioApp}
          authPattern={authPattern}
          onRevoke={handleRevoke}
          isRevoking={isRevoking}
        />
      );
    }

    // Show unauthorized status with authorize button
    return (
      <UnauthorizedStatus
        composioApp={composioApp}
        authPattern={authPattern}
        onAuthorize={handleAuthorize}
        isConnecting={isConnecting}
      />
    );
  };

  return <div className="oauth-status-checker">{renderStatusContent()}</div>;
};

// use memo to prevent unnecessary re-renders
export const MemoizedOAuthStatusChecker = React.memo(OAuthStatusChecker);
export { MemoizedOAuthStatusChecker as OAuthStatusChecker };
