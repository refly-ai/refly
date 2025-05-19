import { useTranslation } from 'react-i18next';
import { Dropdown, MenuProps, message } from 'antd';
import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { safeStringifyJSON } from '@refly-packages/ai-workspace-common/utils/parse';
import { LOCALE } from '@refly/common-types';
// request
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import {
  OutputLocale,
  enLocale,
  localeToLanguageName,
} from '@refly-packages/ai-workspace-common/utils/i18n';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';
import { DownOutlined, TranslationOutlined } from '@ant-design/icons';
import classNames from 'classnames';

export const OutputLocaleList = (props: {
  children?: any;
  width?: number;
  position?: 'tl' | 'tr' | 'bl' | 'br';
  onChange?: (lng: OutputLocale) => void;
}) => {
  // i18n
  const { t, i18n } = useTranslation();
  const uiLocale = i18n?.languages?.[0] as LOCALE;

  const userStore = useUserStore();
  let { outputLocale } = userStore?.localSettings || {};
  outputLocale = outputLocale || 'auto';

  const changeLang = async (lng: OutputLocale) => {
    const { localSettings, userProfile } = useUserStore.getState();

    userStore.setLocalSettings({ ...localSettings, outputLocale: lng });
    userStore.setUserProfile({ ...userProfile, outputLocale: lng });
    localStorage.setItem(
      'refly-local-settings',
      safeStringifyJSON({ ...localSettings, outputLocale: lng }),
    );

    const { data: res, error } = await getClient().updateSettings({
      body: { outputLocale: lng, uiLocale: localSettings.uiLocale },
    });

    if (error || !res?.success) {
      message.error(t('settings.action.putErrorNotify'));
      return;
    }

    props.onChange?.(lng);
  };

  const dropList: MenuProps['items'] = enLocale.map((item: OutputLocale) => ({
    key: item,
    label: localeToLanguageName?.[uiLocale]?.[item],
    onClick: () => changeLang(item),
  }));

  const displayLocale =
    outputLocale === 'auto'
      ? t('settings.language.outputLocale.auto')
      : localeToLanguageName?.[uiLocale]?.[outputLocale];

  return (
    <Dropdown
      menu={{
        items: dropList,
        selectedKeys: [outputLocale],
        style: { width: props?.width, maxHeight: 250 },
      }}
      trigger={['click']}
      getPopupContainer={getPopupContainer}
    >
      {props.children || (
        <span className={classNames('output-locale-list-btn', 'chat-action-item')}>
          <DownOutlined /> {displayLocale}{' '}
          {outputLocale === 'auto' && <TranslationOutlined style={{ marginLeft: 4 }} />}
        </span>
      )}
    </Dropdown>
  );
};
