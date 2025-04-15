import { Message, Link } from '@arco-design/web-react';
import { showErrorNotification } from '@refly-packages/ai-workspace-common/utils/notification';
import type { LOCALE } from '@refly/common-types';
import type { BaseResponse } from '@refly/openapi-schema';
import { browser } from 'wxt/browser'; // 导入 browser API

import { delay } from '@refly/utils';
import { useTranslation } from 'react-i18next';

export const useSaveResourceNotify = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.languages?.[0] || 'en';

  const handleSaveResourceAndNotify = async (
    saveResource: () => Promise<{ res: BaseResponse; url: string }>,
  ) => {
    const close = Message.loading({
      content: t('resource.import.isSaving'),
      duration: 0,
      style: {
        borderRadius: 8,
        background: '#FFFFFF',
      },
    });
    const { res, url } = await saveResource();

    await delay(2000);
    close();
    await delay(200);

    if (res?.success) {
      const targetUrl = `${url}?openLibrary=true`; // 先构造好 URL
      Message.success({
        content: (
          <span>
            {t('resource.import.saveResourceSuccess.prefix')}{' '}
            <Link
              // href={targetUrl} // 移除 href
              // target="_blank" // 移除 target
              style={{ borderRadius: 4 }}
              hoverable
              onClick={() => {
                // 添加 onClick 事件
                browser.tabs.create({ url: targetUrl }); // 使用 browser API 打开链接
              }}
            >
              {t('resource.import.saveResourceSuccess.link')}
            </Link>{' '}
            {t('resource.import.saveResourceSuccess.suffix')}
          </span>
        ),
        duration: 5000,
        style: {
          borderRadius: 8,
          background: '#fff',
        },
        closable: true,
      });
    } else {
      showErrorNotification(res, locale as LOCALE);
    }
  };

  return {
    handleSaveResourceAndNotify,
  };
};
