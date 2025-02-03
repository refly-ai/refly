import { Button } from 'antd';
import { useTranslation } from 'react-i18next';

import { getClientOrigin } from '@refly/utils/url';

import { browser } from 'wxt/browser';

export const NotLogged = () => {
  const { t } = useTranslation();

  return (
    <div>
      <p className="content-title">{t('extension.popup.welcome')}</p>
      <p className="state">{t('extension.popup.pleaseLogin')}</p>
      <Button
        block
        type="primary"
        onClick={() => {
          browser.tabs.create({
            url: `${getClientOrigin()}/login?from=refly-extension-login`,
          });
        }}
      >
        {t('extension.popup.loginRegister')}
      </Button>
    </div>
  );
};
