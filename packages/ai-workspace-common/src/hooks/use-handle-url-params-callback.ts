import { useSearchParams, useNavigate } from 'react-router-dom';
import { Modal } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const useHandleUrlParamsCallback = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userProfile = localStorage.getItem('refly-user-profile');
  const [showModal, setShowModal] = useState(false);
  const okButtonProps = { style: { backgroundColor: '#00968F' } };

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
          },
          onCancel: () => {
            setShowModal(false);
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
        const title = paySuccess ? t('settings.action.paySuccessNotify') : t('settings.action.payCancelNotify');
        const description = paySuccess
          ? t('settings.action.paySuccessDescription')
          : t('settings.action.payCancelDescription');
        if (paySuccess) {
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

        // 删除支付相关参数但保持在当前页面
        searchParams.delete('paySuccess');
        searchParams.delete('payCancel');
        navigate(`${window.location.pathname}?${searchParams.toString()}`, {
          replace: true,
        });
      }, 1);
    }
  }, [searchParams, t, navigate, showModal]);
};
