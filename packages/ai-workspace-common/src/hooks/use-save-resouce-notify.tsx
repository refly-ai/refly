import { message } from 'antd';
import { showErrorNotification } from '@refly-packages/ai-workspace-common/utils/notification';
import type { LOCALE } from '@refly/common-types';
import type { BaseResponse } from '@refly/openapi-schema';

import { delay } from '@refly/utils';
import { useTranslation } from 'react-i18next';

export const useSaveResourceNotify = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.languages?.[0] || 'en';

  const handleSaveResourceAndNotify = async (
    saveResource: () => Promise<{ res: BaseResponse; url: string }>,
  ) => {
    const messageKey = 'saveResource';
    message.loading({
      content: t('resource.import.isSaving'),
      key: messageKey,
      duration: 0,
    });

    const { res, url } = await saveResource();

    await delay(2000);
    message.destroy(messageKey);
    await delay(200);

    if (res?.success) {
      message.success({
        content: (
          <span>
            {t('resource.import.saveResourceSuccess.prefix')}{' '}
            <a
              href={`${url}?openLibrary=true`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ borderRadius: 4 }}
            >
              {t('resource.import.saveResourceSuccess.link')}
            </a>{' '}
            {t('resource.import.saveResourceSuccess.suffix')}
          </span>
        ),
        duration: 5000,
      });
    } else {
      showErrorNotification(res, locale as LOCALE);
    }
  };

  return {
    handleSaveResourceAndNotify,
  };
};
