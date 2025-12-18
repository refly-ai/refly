import { useSearchParams, useNavigate } from 'react-router-dom';
import { Modal } from 'antd';
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { logEvent } from '@refly/telemetry-web';
import {
  getPendingRedirect,
  clearPendingRedirect,
  isOnWorkspacePage,
} from './use-pending-redirect';

export const useHandleUrlParamsCallback = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userProfile = localStorage.getItem('refly-user-profile');
  const [showModal, setShowModal] = useState(false);
  const okButtonProps = { style: { backgroundColor: '#0E9F77' } };
  const hasCheckedPendingRedirect = useRef(false);

  // Check for pending redirect after OAuth login or Stripe payment callback
  useEffect(() => {
    // Only check once per mount and only when user is logged in and on workspace page
    if (hasCheckedPendingRedirect.current || !userProfile || !isOnWorkspacePage()) {
      return;
    }

    const pendingRedirect = getPendingRedirect();
    if (pendingRedirect) {
      hasCheckedPendingRedirect.current = true;
      clearPendingRedirect();
      // Use setTimeout to ensure this runs after any other redirects
      setTimeout(() => {
        navigate(pendingRedirect, { replace: true });
      }, 0);
    }
  }, [userProfile, navigate]);

  useEffect(() => {
    if (showModal) return;

    if (!userProfile) {
      const loginFailed = searchParams.get('loginFailed');
      if (loginFailed) {
        setShowModal(true);
        Modal.error({
          centered: true,
          title: t('landingPage.loginFailed.title'),
          content: t('landingPage.loginFailed.content'),
          okText: t('common.confirm'),
          okButtonProps,
          autoFocusButton: null,
          onOk: () => {
            setShowModal(false);
            // Remove loginFailed parameter from URL
            searchParams.delete('loginFailed');
            navigate(`${window.location.pathname}?${searchParams.toString()}`, {
              replace: true,
            });
          },
          onCancel: () => {
            setShowModal(false);
            // Remove loginFailed parameter from URL
            searchParams.delete('loginFailed');
            navigate(`${window.location.pathname}?${searchParams.toString()}`, {
              replace: true,
            });
          },
        });
      }
      return;
    }

    const paySuccess = searchParams.get('paySuccess');
    const payCancel = searchParams.get('payCancel');
    if (paySuccess || payCancel) {
      setShowModal(true);
      setTimeout(() => {
        const title = paySuccess
          ? t('settings.action.paySuccessNotify')
          : t('settings.action.payCancelNotify');
        const description = paySuccess
          ? t('settings.action.paySuccessDescription')
          : t('settings.action.payCancelDescription');
        if (paySuccess) {
          logEvent('subscription::pay_success');

          Modal.success({
            centered: true,
            title,
            content: description,
            okButtonProps,
            autoFocusButton: null,
            onOk: () => {
              setShowModal(false);
            },
            onCancel: () => {
              setShowModal(false);
            },
          });
        } else {
          logEvent('subscription::pay_cancel');

          Modal.error({
            centered: true,
            title,
            content: description,
            okButtonProps,
            autoFocusButton: null,
            onOk: () => {
              setShowModal(false);
            },
            onCancel: () => {
              setShowModal(false);
            },
          });
        }

        // Remove payment params and check for pending redirect
        searchParams.delete('paySuccess');
        searchParams.delete('payCancel');

        // Check for pending redirect after payment callback
        const pendingRedirect = getPendingRedirect();
        if (pendingRedirect) {
          clearPendingRedirect();
          navigate(pendingRedirect, { replace: true });
        } else {
          navigate(`${window.location.pathname}?${searchParams.toString()}`, {
            replace: true,
          });
        }
      }, 1);
    }
  }, [searchParams, t, navigate, showModal]);
};
