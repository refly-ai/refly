import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Divider, Spin, Avatar, message, Input } from 'antd';
import { DesktopOutlined, ExclamationCircleFilled, CheckCircleFilled } from '@ant-design/icons';
import { FaBan } from 'react-icons/fa6';
import { Account, Flow, CheckCircleBroken, Copy } from 'refly-icons';
import { BsDatabase } from 'react-icons/bs';
import { useTranslation } from 'react-i18next';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import { useGetUserSettings } from '@refly-packages/ai-workspace-common/hooks/use-get-user-settings';
import { useUserStoreShallow } from '@refly/stores';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { LoginCard } from '../../components/login-modal/login-card';
import { VerificationModal } from '../../components/verification-modal';
import { ResetPasswordModal } from '../../components/reset-password-modal';
import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar_v2.webp';
import ClockIcon from '@refly-packages/ai-workspace-common/assets/clock.svg';
import './index.scss';
import { HiOutlineLightningBolt } from 'react-icons/hi';
import { GoShieldCheck } from 'react-icons/go';
import { logEvent, updateUserProperties } from '@refly/telemetry-web';
import { serverOrigin } from '@refly/ui-kit';
// ============================================================================
// Types
// ============================================================================

type PageState =
  | 'checking_session'
  | 'login_or_register'
  | 'authorize_confirm'
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

// Get API base URL from serverOrigin (consistent with the rest of the app)
// serverOrigin checks: window.electronEnv > window.ENV.API_URL > VITE_API_URL > ''
const API_BASE = serverOrigin ? `${serverOrigin}/v1/auth/cli` : '/v1/auth/cli';

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

async function authorizeDevice(
  deviceId: string,
  userCode: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/device/authorize`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_id: deviceId, user_code: userCode }),
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
  showVerificationCode?: boolean;
  verificationCode?: string;
  onVerificationCodeChange?: (code: string) => void;
  isAuthorized?: boolean;
  isSubmitting?: boolean;
}

const DeviceCard: React.FC<DeviceCardProps> = React.memo(
  ({
    deviceInfo,
    loading,
    showVerificationCode = false,
    verificationCode = '',
    onVerificationCodeChange,
    isAuthorized = false,
    isSubmitting = false,
  }) => {
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
      <div className="flex flex-col gap-2 px-4 py-3 rounded-xl bg-white border border-solid border-refly-tertiary-hover">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center flex-shrink-0">
            <DesktopOutlined size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-inter text-[rgba(28,31,35,0.6)] flex-shrink-0">
                {t('cliAuth.host')}
              </span>
              <span className="text-xs font-inter font-medium text-[#1c1f23] leading-[18px] overflow-hidden text-ellipsis whitespace-nowrap">
                {deviceInfo.host}
              </span>
            </div>
          </div>
        </div>
        {showVerificationCode && (
          <div className="flex flex-col gap-2 pt-2 border-t border-refly-tertiary-hover">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center flex-shrink-0">
                <GoShieldCheck size={18} />
              </div>
              <span className="text-xs font-medium text-refly-text-0">
                {t('cliAuth.verificationCodeLabel')}
              </span>
            </div>
            <div className="flex justify-center">
              <Input.OTP
                length={6}
                value={verificationCode}
                onChange={onVerificationCodeChange}
                disabled={isAuthorized || isSubmitting}
                size="small"
                className="cli-auth-otp-small"
              />
            </div>
          </div>
        )}
      </div>
    );
  },
);

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
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
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
          setPageState('authorized_cancel');
          return;
        }

        if (result.data.status === 'authorized') {
          setDeviceInfo(result.data);
          setIsAuthorized(true);
          setCountdown(10);
          setPageState('authorize_confirm');
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
    // Wait for login check to complete
    if (isCheckingLoginStatus) {
      console.log('[CLI Auth] Still checking login status...');
      return; // Still checking
    }

    if (deviceLoading) {
      console.log('[CLI Auth] Still loading device info...');
      return; // Still loading device info
    }

    if (pageState === 'error' || pageState === 'authorized_cancel') {
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

  // Countdown to close window after authorization
  useEffect(() => {
    if (!isAuthorized) {
      return;
    }

    if (countdown <= 0) {
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
  }, [isAuthorized, countdown]);

  // Poll device status to detect cancellation or other state changes
  useEffect(() => {
    if (!deviceId || pageState === 'error' || pageState === 'authorized_cancel') {
      return;
    }

    const pollDeviceStatus = async () => {
      try {
        const result = await fetchDeviceInit(deviceId, cliVersion, host);
        if (result.success && result.data) {
          // Check if status changed
          if (result.data.status === 'cancelled') {
            setIsCancelled(true);
            setPageState('authorized_cancel');
          } else if (result.data.status === 'expired') {
            setPageState('authorized_cancel');
          } else if (result.data.status === 'authorized' && !isAuthorized) {
            setDeviceInfo(result.data);
            setIsAuthorized(true);
            setCountdown(10);
            setPageState('authorize_confirm');
          }
        }
      } catch (error) {
        // Silently fail polling - don't interrupt user experience
        console.debug('[CLI Auth] Polling failed:', error);
      }
    };

    // Poll immediately when entering the page
    pollDeviceStatus();

    // Then poll every 3 seconds
    const pollInterval = setInterval(pollDeviceStatus, 3000);

    return () => clearInterval(pollInterval);
  }, [deviceId, cliVersion, host, pageState, isAuthorized, t]);

  // Handlers
  const handleAuthorize = useCallback(async () => {
    if (!deviceId) return;
    if (!verificationCode || verificationCode.length !== 6) {
      message.error(t('cliAuth.verificationCodePlaceholder'));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authorizeDevice(deviceId, verificationCode);

      if (result.success) {
        setIsAuthorized(true);
        setCountdown(10);
        setPageState('authorize_confirm');
        logEvent('authorize_success', null);
        updateUserProperties({ is_cli_authorize: 'true' });
      } else {
        if (result.error === 'invalid_verification_code') {
          message.error(t('cliAuth.errors.invalidVerificationCode'));
        } else {
          setPageState('error');
          setErrorMessage(t('cliAuth.errors.authorizeFailed'));
        }
      }
    } catch {
      setPageState('error');
      setErrorMessage(t('cliAuth.errors.authorizeFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }, [deviceId, verificationCode, t]);

  const handleCancel = useCallback(async () => {
    if (!deviceId) return;

    try {
      const result = await cancelDevice(deviceId);
      if (result.success) {
        setIsCancelled(true);
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
              <div className="flex flex-col gap-3">
                <p className="m-0 text-base font-inter font-normal text-refly-text-1 flex items-center gap-2">
                  <Flow size={20} />
                  {t('cliAuth.permissionItem1')}
                </p>
                <p className="m-0 text-base font-inter font-normal text-refly-text-1 flex items-center gap-2">
                  <HiOutlineLightningBolt size={20} />
                  {t('cliAuth.permissionItem2')}
                </p>
                <p className="m-0 text-base font-inter font-normal text-refly-text-1 flex items-center gap-2">
                  <BsDatabase
                    size={20}
                    style={{ transform: 'scaleX(1.1)', strokeWidth: '0.3px' }}
                  />
                  {t('cliAuth.permissionItem3')}
                </p>
              </div>
            </div>
            <div className="cli-auth-actions flex justify-between gap-4 relative">
              {isAuthorized && (
                <div className="absolute left-1/2 -top-16 -translate-x-1/2 z-10 animate-slide-in-bottom">
                  <div className="flex items-center justify-center gap-2 w-[336px] h-[52px] bg-refly-toast-fill border border-solid border-refly-Card-Border shadow-refly-m rounded-xl">
                    <CheckCircleFilled
                      className="text-refly-func-success-default"
                      style={{ fontSize: 18 }}
                    />
                    <span className="text-lg font-regular text-refly-text-0">
                      {t('cliAuth.authorizedMessage')}
                    </span>
                  </div>
                </div>
              )}
              {isCancelled && (
                <div className="absolute left-1/2 -top-16 -translate-x-1/2 z-10 animate-slide-in-bottom">
                  <div className="flex items-center justify-center gap-2 w-[336px] h-[52px] bg-refly-toast-fill border border-solid border-refly-Card-Border shadow-refly-m rounded-xl">
                    <FaBan className="text-refly-func-error-default" style={{ fontSize: 18 }} />
                    <span className="text-lg font-regular text-refly-text-0">
                      {t('cliAuth.cancelledMessage')}
                    </span>
                  </div>
                </div>
              )}
              <Button
                onClick={handleCancel}
                className="cli-auth-btn cli-auth-btn-cancel"
                disabled={isAuthorized || isSubmitting}
              >
                {t('cliAuth.cancelButton')}
              </Button>
              <Button
                onClick={handleAuthorize}
                loading={isSubmitting}
                className={`cli-auth-btn cli-auth-btn-authorize flex items-center justify-center gap-2 ${
                  isAuthorized ? 'cli-auth-btn-authorized' : ''
                }`}
                disabled={isAuthorized}
              >
                {isAuthorized && (
                  <CheckCircleBroken size={20} color="var(--refly-primary-default)" />
                )}
                {isAuthorized
                  ? `${t('cliAuth.authorizedButton', 'Authorized')} (${countdown}s)`
                  : t('cliAuth.authorizeButton')}
              </Button>
            </div>
          </div>
        );

      case 'authorized_cancel':
        return (
          <div className="flex flex-col items-center text-center w-full mt-16">
            <div className="w-[56px] h-[56px] rounded-full bg-[#FFF4EB] flex items-center justify-center mb-4">
              <img src={ClockIcon} alt="Clock" className="w-[20px] h-[20px]" />
            </div>

            <h2 className="text-xl font-bold text-[#1c1f23] m-0 mb-2 leading-tight">
              {t('cliAuth.cancelledTitle')}
            </h2>

            <p className="m-0 text-sm text-[rgba(28,31,35,0.6)] leading-relaxed mb-6">
              {t('cliAuth.cancelledMessage')}
            </p>

            <div className="bg-[#F3F4F6] rounded-[4px] px-4 py-1 flex items-center justify-between mb-6 relative overflow-hidden group w-[111px] h-6 gap-2">
              <span className="text-[14px] font-medium text-[#1c1f23] font-inter leading-[21px] whitespace-nowrap">
                refly init
              </span>
              <Button
                type="text"
                icon={<Copy size={14} />}
                className="hover:bg-transparent p-0 w-[24px] h-[18px] flex items-center border-none shadow-none"
                onClick={() => {
                  navigator.clipboard.writeText('refly init');
                  message.success(t('cliAuth.copied', 'Copied!'));
                }}
              />
            </div>

            <Button
              size="large"
              className="cli-auth-btn-close"
              onClick={() => {
                try {
                  window.close();
                } catch {
                  // Fallback
                }
              }}
            >
              {t('cliAuth.closeWindow')}
            </Button>
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
        <div className="w-[504px] h-[697px] bg-refly-bg-body-z0 rounded-[20px] p-6 flex flex-col shadow-lg">
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

          {/* Device Card - Hide when cancelled */}
          {pageState !== 'authorized_cancel' && (
            <div className="mb-6">
              <DeviceCard
                deviceInfo={deviceInfo}
                loading={deviceLoading}
                showVerificationCode={pageState === 'authorize_confirm'}
                verificationCode={verificationCode}
                onVerificationCodeChange={setVerificationCode}
                isAuthorized={isAuthorized}
                isSubmitting={isSubmitting}
              />
            </div>
          )}

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
