import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button, Spin, message } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  CopyOutlined,
  DesktopOutlined,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import { useGetUserSettings } from '@refly-packages/ai-workspace-common/hooks/use-get-user-settings';
import { useUserStoreShallow } from '@refly/stores';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { serverOrigin } from '@refly/ui-kit';
import './index.css';

// ============================================================================
// Types
// ============================================================================

type PageState =
  | 'checking_session'
  | 'login_or_register'
  | 'authorize_confirm'
  | 'authorizing'
  | 'authorized_success'
  | 'authorized_cancel'
  | 'error';

interface DeviceInfo {
  deviceId: string;
  cliVersion: string;
  host: string;
  status: 'pending' | 'authorized' | 'cancelled' | 'expired';
}

// ============================================================================
// API Functions
// ============================================================================

const API_BASE = `${serverOrigin}/v1/auth/cli`;

async function fetchDeviceInit(
  deviceId: string,
  cliVersion: string,
  host: string,
): Promise<{ success: boolean; data?: DeviceInfo; error?: string }> {
  try {
    const params = new URLSearchParams({
      device_id: deviceId,
      cli_version: cliVersion,
      host: host,
    });

    const response = await fetch(`${API_BASE}/device/init?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'not_found' };
      }
      return { success: false, error: 'api_error' };
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      return { success: false, error: result.errCode || 'unknown_error' };
    }

    return {
      success: true,
      data: {
        deviceId: result.data.deviceId,
        cliVersion: result.data.cliVersion,
        host: result.data.host,
        status: result.data.status,
      },
    };
  } catch {
    return { success: false, error: 'network_error' };
  }
}

async function authorizeDevice(deviceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/device/authorize`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_id: deviceId }),
    });

    if (!response.ok) {
      return { success: false, error: 'api_error' };
    }

    const result = await response.json();
    return { success: result.success, error: result.errCode };
  } catch {
    return { success: false, error: 'network_error' };
  }
}

async function cancelDevice(deviceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/device/cancel`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_id: deviceId }),
    });

    if (!response.ok) {
      return { success: false, error: 'api_error' };
    }

    const result = await response.json();
    return { success: result.success, error: result.errCode };
  } catch {
    return { success: false, error: 'network_error' };
  }
}

// ============================================================================
// Device Card Component
// ============================================================================

interface DeviceCardProps {
  deviceInfo: DeviceInfo | null;
  loading: boolean;
}

const DeviceCard: React.FC<DeviceCardProps> = React.memo(({ deviceInfo, loading }) => {
  const { t } = useTranslation();

  const handleCopyDeviceId = useCallback(() => {
    if (deviceInfo?.deviceId) {
      navigator.clipboard.writeText(deviceInfo.deviceId);
      message.success(t('common.copy.success'));
    }
  }, [deviceInfo?.deviceId, t]);

  const truncateDeviceId = (id: string) => {
    if (id.length <= 16) return id;
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
  };

  if (loading) {
    return (
      <div className="cli-auth-device-card cli-auth-device-card-loading">
        <Spin size="small" />
        <span>{t('cliAuth.loadingDevice')}</span>
      </div>
    );
  }

  if (!deviceInfo) {
    return null;
  }

  return (
    <div className="cli-auth-device-card">
      <div className="cli-auth-device-icon">
        <DesktopOutlined style={{ fontSize: 24 }} />
      </div>
      <div className="cli-auth-device-info">
        <div className="cli-auth-device-row">
          <span className="cli-auth-device-label">{t('cliAuth.deviceId')}:</span>
          <span className="cli-auth-device-value" title={deviceInfo.deviceId}>
            {truncateDeviceId(deviceInfo.deviceId)}
          </span>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={handleCopyDeviceId}
            className="cli-auth-copy-btn"
          />
        </div>
        <div className="cli-auth-device-row">
          <span className="cli-auth-device-label">{t('cliAuth.cliVersion')}:</span>
          <span className="cli-auth-device-value">{deviceInfo.cliVersion}</span>
        </div>
        <div className="cli-auth-device-row">
          <span className="cli-auth-device-label">{t('cliAuth.host')}:</span>
          <span className="cli-auth-device-value">{deviceInfo.host}</span>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Main Page Component
// ============================================================================

const CliAuthPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getLoginStatus } = useIsLogin();
  const { isLogin, isCheckingLoginStatus, userProfile } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
    userProfile: state.userProfile,
  }));

  // Initialize user settings (fetches profile and updates login status)
  useGetUserSettings();

  // State
  const [pageState, setPageState] = useState<PageState>('checking_session');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [deviceLoading, setDeviceLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [countdown, setCountdown] = useState(10);

  // URL params
  const deviceId = searchParams.get('device_id') || '';
  const cliVersion = searchParams.get('cli_version') || '';
  const host = searchParams.get('host') || '';

  // Check if user is logged in
  const isLoggedIn = useMemo(() => {
    const status = getLoginStatus();
    return status || isLogin;
  }, [getLoginStatus, isLogin]);

  // Initialize device info
  useEffect(() => {
    const initDevice = async () => {
      if (!deviceId) {
        setPageState('error');
        setErrorMessage(t('cliAuth.errors.missingDeviceId'));
        setDeviceLoading(false);
        return;
      }

      setDeviceLoading(true);
      try {
        const result = await fetchDeviceInit(deviceId, cliVersion, host);
        setDeviceLoading(false);

        if (!result.success || !result.data) {
          setPageState('error');
          setErrorMessage(t('cliAuth.errors.invalidDevice'));
          return;
        }

        if (result.data.status === 'expired') {
          setPageState('error');
          setErrorMessage(t('cliAuth.errors.expiredDevice'));
          return;
        }

        if (result.data.status === 'authorized') {
          setDeviceInfo(result.data);
          setPageState('authorized_success');
          return;
        }

        setDeviceInfo(result.data);
      } catch {
        setDeviceLoading(false);
        setPageState('error');
        setErrorMessage(t('cliAuth.errors.invalidDevice'));
      }
    };

    initDevice();
  }, [deviceId, cliVersion, host, t]);

  // Check login status and update page state
  useEffect(() => {
    // Only block if explicitly true (meaning a check is actually in progress)
    if (isCheckingLoginStatus === true) {
      return; // Still checking
    }

    if (deviceLoading) {
      return; // Still loading device info
    }

    if (
      pageState === 'error' ||
      pageState === 'authorized_success' ||
      pageState === 'authorized_cancel'
    ) {
      return; // Terminal states
    }

    if (isLoggedIn) {
      setPageState('authorize_confirm');
    } else {
      setPageState('login_or_register');
    }
  }, [isCheckingLoginStatus, isLoggedIn, deviceLoading, pageState, userProfile]);

  // Countdown for success page
  useEffect(() => {
    if (pageState !== 'authorized_success') {
      return;
    }

    if (countdown <= 0) {
      // Try to close the window, show message if blocked
      try {
        window.close();
      } catch {
        // Window.close() may be blocked by browser
      }
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [pageState, countdown]);

  // Handlers
  const handleLogin = useCallback(() => {
    // Build returnUrl with all device params using URLSearchParams for proper encoding
    const params = new URLSearchParams({
      device_id: deviceId,
      cli_version: cliVersion,
      host: host,
    });
    const returnUrl = encodeURIComponent(`/cli/auth?${params.toString()}`);
    navigate(`/login?returnUrl=${returnUrl}`);
  }, [navigate, deviceId, cliVersion, host]);

  const handleAuthorize = useCallback(async () => {
    if (!deviceId) return;

    setPageState('authorizing');
    try {
      const result = await authorizeDevice(deviceId);

      if (result.success) {
        setPageState('authorized_success');
        setCountdown(10);
      } else {
        setPageState('error');
        setErrorMessage(t('cliAuth.errors.authorizeFailed'));
      }
    } catch {
      setPageState('error');
      setErrorMessage(t('cliAuth.errors.authorizeFailed'));
    }
  }, [deviceId, t]);

  const handleCancel = useCallback(async () => {
    if (!deviceId) return;

    try {
      const result = await cancelDevice(deviceId);
      if (result.success) {
        setPageState('authorized_cancel');
      }
    } catch {
      // Silently fail on cancel - user can close the page
      setPageState('authorized_cancel');
    }
  }, [deviceId]);

  // Render content based on page state
  const renderContent = () => {
    switch (pageState) {
      case 'checking_session':
        return (
          <div className="cli-auth-content cli-auth-content-center">
            <Spin size="large" />
            <p className="cli-auth-message">{t('cliAuth.checkingSession')}</p>
          </div>
        );

      case 'login_or_register':
        return (
          <div className="cli-auth-content">
            <div className="cli-auth-permission">
              <p>{t('cliAuth.permissionSummary')}</p>
            </div>
            <div className="cli-auth-login-prompt">
              <p>{t('cliAuth.loginRequired')}</p>
              <Button type="primary" size="large" onClick={handleLogin} className="cli-auth-btn">
                {t('cliAuth.loginButton')}
              </Button>
            </div>
          </div>
        );

      case 'authorize_confirm':
        return (
          <div className="cli-auth-content">
            <div className="cli-auth-user-info">
              <p>
                {t('cliAuth.loggedInAs')}:{' '}
                <strong>{userProfile?.email || userProfile?.name}</strong>
              </p>
            </div>
            <div className="cli-auth-permission">
              <p>{t('cliAuth.permissionSummary')}</p>
            </div>
            <div className="cli-auth-actions">
              <Button
                type="primary"
                size="large"
                onClick={handleAuthorize}
                className="cli-auth-btn cli-auth-btn-authorize"
              >
                {t('cliAuth.authorizeButton')}
              </Button>
              <Button
                size="large"
                onClick={handleCancel}
                className="cli-auth-btn cli-auth-btn-cancel"
              >
                {t('cliAuth.cancelButton')}
              </Button>
            </div>
            <p className="cli-auth-hint">{t('cliAuth.cancelHint')}</p>
          </div>
        );

      case 'authorizing':
        return (
          <div className="cli-auth-content cli-auth-content-center">
            <Spin size="large" />
            <p className="cli-auth-message">{t('cliAuth.authorizing')}</p>
          </div>
        );

      case 'authorized_success':
        return (
          <div className="cli-auth-content cli-auth-content-center">
            <CheckCircleFilled className="cli-auth-icon cli-auth-icon-success" />
            <h2 className="cli-auth-result-title">{t('cliAuth.successTitle')}</h2>
            <p className="cli-auth-message">{t('cliAuth.successMessage')}</p>
            <p className="cli-auth-countdown">
              {t('cliAuth.autoCloseCountdown', { seconds: countdown })}
            </p>
          </div>
        );

      case 'authorized_cancel':
        return (
          <div className="cli-auth-content cli-auth-content-center">
            <CloseCircleFilled className="cli-auth-icon cli-auth-icon-cancel" />
            <h2 className="cli-auth-result-title">{t('cliAuth.cancelledTitle')}</h2>
            <p className="cli-auth-message">{t('cliAuth.cancelledMessage')}</p>
          </div>
        );

      case 'error':
        return (
          <div className="cli-auth-content cli-auth-content-center">
            <ExclamationCircleFilled className="cli-auth-icon cli-auth-icon-error" />
            <h2 className="cli-auth-result-title">{t('cliAuth.errorTitle')}</h2>
            <p className="cli-auth-message">{errorMessage}</p>
            <p className="cli-auth-hint">{t('cliAuth.errorHint')}</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="cli-auth-page">
      <div className="cli-auth-container">
        {/* Header */}
        <div className="cli-auth-header">
          <Logo className="cli-auth-logo" />
          <h1 className="cli-auth-title">{t('cliAuth.title')}</h1>
        </div>

        {/* Device Card */}
        <DeviceCard deviceInfo={deviceInfo} loading={deviceLoading} />

        {/* Main Content */}
        {renderContent()}

        {/* Footer */}
        <div className="cli-auth-footer">
          <p className="cli-auth-footer-text">{t('cliAuth.securityNote')}</p>
        </div>
      </div>
    </div>
  );
};

export default CliAuthPage;
