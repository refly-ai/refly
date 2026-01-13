import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Divider, Spin, Avatar } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  DesktopOutlined,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import { Account, Flow } from 'refly-icons';
import { BsDatabase } from 'react-icons/bs';
import { useTranslation } from 'react-i18next';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import { useGetUserSettings } from '@refly-packages/ai-workspace-common/hooks/use-get-user-settings';
import { useUserStoreShallow } from '@refly/stores';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { LoginCard } from '../../components/login-modal/login-card';
import { VerificationModal } from '../../components/verification-modal';
import { ResetPasswordModal } from '../../components/reset-password-modal';
import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar.png';
import './index.scss';
import { HiOutlineLightningBolt } from 'react-icons/hi';
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

// Get API base URL from window.ENV or use relative path as fallback
// This allows the page to work both in development (with proxy) and production (with separate API domain)
const getApiBase = () => {
  const apiUrl = window.ENV?.API_URL;
  if (apiUrl) {
    return `${apiUrl}/v1/auth/cli`;
  }
  // Fallback to relative path for development with proxy
  return '/v1/auth/cli';
};

const API_BASE = getApiBase();

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

  if (loading) {
    return (
      <div className="flex items-start gap-4 p-4 rounded-xl justify-center items-center gap-3 text-[#666]">
        <Spin size="small" />
        <span>{t('cliAuth.loadingDevice')}</span>
      </div>
    );
  }

  if (!deviceInfo) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-6 py-2 rounded-xl bg-white border border-solid border-refly-tertiary-hover">
      <div className="flex items-center justify-center flex-shrink-0">
        <DesktopOutlined size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-inter text-[rgba(28,31,35,0.6)] flex-shrink-0">
            {t('cliAuth.host')}
          </span>
          <span className="text-sm font-inter font-medium text-[#1c1f23] leading-[21px] overflow-hidden text-ellipsis whitespace-nowrap">
            {deviceInfo.host}
          </span>
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
  const [searchParams] = useSearchParams();
  const { getLoginStatus } = useIsLogin();

  // Fetch user settings on mount (sets userProfile and isCheckingLoginStatus in store)
  useGetUserSettings();

  const { userProfile, isCheckingLoginStatus } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
  }));

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
    return getLoginStatus();
  }, [getLoginStatus]);

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
    // Debug logging
    console.log('[CLI Auth] State check:', {
      isCheckingLoginStatus,
      isLoggedIn,
      deviceLoading,
      pageState,
      userProfile: userProfile?.email,
    });

    // Wait for login check to complete
    if (isCheckingLoginStatus) {
      console.log('[CLI Auth] Still checking login status...');
      return; // Still checking
    }

    if (deviceLoading) {
      console.log('[CLI Auth] Still loading device info...');
      return; // Still loading device info
    }

    if (
      pageState === 'error' ||
      pageState === 'authorized_success' ||
      pageState === 'authorized_cancel'
    ) {
      console.log('[CLI Auth] Terminal state:', pageState);
      return; // Terminal states
    }

    if (isLoggedIn) {
      console.log('[CLI Auth] User is logged in, showing authorize_confirm');
      setPageState('authorize_confirm');
    } else {
      console.log('[CLI Auth] User not logged in, showing login_or_register');
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
          <div className="flex flex-col gap-6 items-center text-center py-6">
            <Spin size="large" />
            <p className="m-0 text-sm text-[#666] leading-[1.6]">{t('cliAuth.checkingSession')}</p>
          </div>
        );

      case 'login_or_register':
        return null;

      case 'authorize_confirm':
        return (
          <div className="flex flex-col gap-6">
            <div className="w-full h-full p-6 rounded-[12px] bg-[#FBFBFB] border-solid border-refly-tertiary-hover flex flex-col gap-4">
              <p className="m-0 text-base text-refly-text-0 font-semibold">
                {t('cliAuth.permissionSummary')}
              </p>
              <p className="m-0 text-base font-inter font-normal text-refly-text-1 flex items-center gap-2">
                <Flow size={20} />
                {t('cliAuth.permissionItem1')}
              </p>
              <p className="m-0 text-base font-inter font-normal text-refly-text-1 flex items-center gap-2">
                <HiOutlineLightningBolt size={20} />
                {t('cliAuth.permissionItem2')}
              </p>
              <p className="m-0 text-base font-inter font-normal text-refly-text-1 flex items-center gap-2">
                <BsDatabase size={20} style={{ transform: 'scaleX(1.1)', strokeWidth: '0.3px' }} />
                {t('cliAuth.permissionItem3')}
              </p>
            </div>
            <div className="cli-auth-actions flex justify-between gap-4">
              <Button onClick={handleCancel} className="cli-auth-btn cli-auth-btn-cancel">
                {t('cliAuth.cancelButton')}
              </Button>
              <Button onClick={handleAuthorize} className="cli-auth-btn cli-auth-btn-authorize">
                {t('cliAuth.authorizeButton')}
              </Button>
            </div>
          </div>
        );

      case 'authorizing':
        return (
          <div className="flex flex-col gap-6 items-center text-center py-6">
            <Spin size="large" />
            <p className="m-0 text-sm text-[#666] leading-[1.6]">{t('cliAuth.authorizing')}</p>
          </div>
        );

      case 'authorized_success':
        return (
          <div className="flex flex-col gap-6 items-center text-center py-6">
            <CheckCircleFilled className="text-6xl mb-4 text-[#52c41a]" />
            <h2 className="text-lg font-semibold text-[#1c1f23] m-0 mb-2">
              {t('cliAuth.successTitle')}
            </h2>
            <p className="m-0 text-sm text-[#666] leading-[1.6]">{t('cliAuth.successMessage')}</p>
            <p className="mt-2 mb-0 text-xs text-[rgba(28,31,35,0.6)]">
              {t('cliAuth.autoCloseCountdown', { seconds: countdown })}
            </p>
          </div>
        );

      case 'authorized_cancel':
        return (
          <div className="flex flex-col gap-6 items-center text-center py-6">
            <CloseCircleFilled className="text-6xl mb-4 text-[rgba(28,31,35,0.6)]" />
            <h2 className="text-lg font-semibold text-[#1c1f23] m-0 mb-2">
              {t('cliAuth.cancelledTitle')}
            </h2>
            <p className="m-0 text-sm text-[#666] leading-[1.6]">{t('cliAuth.cancelledMessage')}</p>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col gap-6 items-center text-center py-6">
            <ExclamationCircleFilled className="text-6xl mb-4 text-[#ff4d4f]" />
            <h2 className="text-lg font-semibold text-[#1c1f23] m-0 mb-2">
              {t('cliAuth.errorTitle')}
            </h2>
            <p className="m-0 text-sm text-[#666] leading-[1.6]">{errorMessage}</p>
            <p className="m-0 text-xs text-[rgba(28,31,35,0.6)]">{t('cliAuth.errorHint')}</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-refly-bg-body-z0">
      {pageState === 'login_or_register' ? (
        <LoginCard from="cli_auth" />
      ) : (
        <div className="w-[504px] h-[612px] bg-refly-bg-body-z0 rounded-[20px] p-6 flex flex-col shadow-lg">
          <div className="p-1 px-2 rounded-lg">
            <div className="flex items-start gap-2">
              <Avatar icon={<Account />} src={userProfile?.avatar || defaultAvatar} size={46} />

              <div className="flex flex-col justify-between h-[44px] gap-[2px] opacity-100">
                <div className="max-w-40 text-base font-semibold text-refly-text-0 leading-5 truncate">
                  {userProfile?.nickname || 'No nickname'}
                </div>
                <div className="max-w-40 text-xs text-refly-text-2 leading-4 truncate">
                  {userProfile?.email ?? 'No email provided'}
                </div>
              </div>
            </div>
          </div>
          <Divider className="my-4 -mx-6 !w-[calc(100%+48px)]" />
          {/* Header */}
          <div className="flex flex-col items-center mb-6 gap-1">
            <Logo className="w-[120px] h-[32px] mb-2" />
            <h1 className="text-2xl font-semibold text-[#1c1f23] m-0 text-center leading-8">
              {t('cliAuth.title')}
            </h1>
            <p className="text-sm text-refly-text-2 m-0 text-center leading-5">
              {t('cliAuth.subtitle')}
            </p>
          </div>

          {/* Device Card */}
          <div className="mb-6">
            <DeviceCard deviceInfo={deviceInfo} loading={deviceLoading} />
          </div>

          {/* Main Content */}
          {renderContent()}
        </div>
      )}
      <VerificationModal />
      <ResetPasswordModal />
    </div>
  );
};

export default CliAuthPage;
