import { Modal, Message as message } from '@arco-design/web-react';

import { useState } from 'react';
import { delay } from '@/utils/delay';
// utils
import { v4 as uuidV4 } from 'uuid';
import { useWeblinkStore } from '@/stores/weblink';
import { retryify } from '@/utils/retry';
import type { WebLinkItem } from '@/components/weblink-list/types';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/requests/apiRequest';
import { Weblink } from '@refly/openapi-schema';
import { getReadabilityHtml } from '@refly/utils/html2md';

export const useStoreWeblink = () => {
  // 网页索引状态
  const [uploadingStatus, setUploadingStatus] = useState<
    'normal' | 'loading' | 'failed' | 'success'
  >('normal');
  const { t } = useTranslation();

  const handleClientUploadHtml = async (url: string) => {
    const pageContent = getReadabilityHtml(document);

    // 先上传到 worker 获取 storageKey
    const uniqueId = uuidV4();
    const uploadRes = await apiRequest({
      name: 'uploadHtml',
      method: 'POST',
      body: { url, pageContent, fileName: `${uniqueId}.html` },
    });

    return uploadRes;
  };

  const handleClientStore = async (url: string) => {
    const uploadRes = await handleClientUploadHtml(url);
    const description = document.head.querySelector('meta[name="description"]');

    const res = await apiRequest({
      name: 'storeWeblink',
      method: 'POST',
      body: {
        url,
        origin: location?.origin || '', // 冗余存储策略，for 后续能够基于 origin 进行归类归档
        originPageTitle: document?.title || '',
        originPageUrl: location.href,
        originPageDescription: (description as any)?.content || '',
        storageKey: uploadRes?.data?.storageKey || '', // 上传 HTML String 用于后续的操作
      },
    });

    // 将通知逻辑也涵盖了
    if (!res?.success) {
      message.error(t('extension.loggedHomePage.homePage.status.contentHandleFailedNotify'));
    } else {
      message.success(t('extension.loggedHomePage.homePage.status.contentHandleSuccessNotify'));
    }

    return {
      success: res?.success,
      data: {
        title: document?.title || '',
        url: location.href,
        linkId: res?.linkId || '',
        storageKey: uploadRes?.data?.storageKey || '',
      },
    };
  };

  // TODO:

  const _handleGetWeblinkStatus = () => {};

  const confirmToClientUpload = async (url: string) => {
    Modal.confirm({
      title: '确定上传当前网页内容吗？',
      content: '上传此内容可能会造成隐私安全问题，请谨慎操作',
      okButtonProps: {
        status: 'warning',
      },
      onOk: async () => {
        await handleClientStore(url);
      },
    });
  };

  const preCheckForUploadWebsite = async (url: string) => {
    const { currentWeblink } = useWeblinkStore.getState();
    const isProcessingParse =
      !currentWeblink || ['init', 'processing'].includes(currentWeblink?.parseStatus!);
    const isFailedToServerCrawl = currentWeblink?.parseStatus === 'failed';

    // 直接遇到服务端爬取失败，则弹框提示用户
    if (isFailedToServerCrawl) {
      confirmToClientUpload(url);

      return {
        success: false,
        errMsg: 'Server crawl failed, use client upload, confirm for user access',
      };
    }

    let pingData: WebLinkItem = currentWeblink;

    // 如果还在处理，则获取一下
    if (isProcessingParse) {
      // 先 ping 一下，如果已经上传就不传了
      const pingRes = await apiRequest({
        name: 'pingWebLinkStatus',
        method: 'GET',
        body: {
          url,
        },
      });

      if (!pingRes?.success) {
        throw new Error('Weblink interface failed...');
      }

      pingData = pingRes?.data as WebLinkItem;
    }

    // 如果还在上传中，直接报错，进行重试，并重试 5 秒/10 次
    const isCurrentWeblinkStatusNotComplete = ['init', 'processing'].includes(
      pingData?.parseStatus!,
    );
    if (isCurrentWeblinkStatusNotComplete) {
      throw new Error('Weblink is processing...');
    }

    if (pingData?.parseStatus === 'failed') {
      confirmToClientUpload(url);

      return {
        success: false,
        errMsg: 'Server crawl failed, use client upload, confirm for user access',
      };
    }

    return { success: true, data: pingData };
  };

  const handleUploadWebsite = async (url: string, needSave = false) => {
    let pingRes: ReturnType<Weblink>;
    let res: ReturnType<any> = null as any;

    // setIsUpdatingWebiste(true)
    setUploadingStatus('loading'); // 标识处理过程
    const messageClose = message.loading({
      content: t('extension.loggedHomePage.homePage.status.contentHandling'),
      duration: 0,
    });

    /**
     * 重试形态进行 ping：
     *
     * 1. 如果报错，直接重试，直到失败
     */
    try {
      pingRes = (await retryify(
        async () => {
          const res = await preCheckForUploadWebsite(url);
          return res;
        },
        {
          maxRetries: 10,
          maxTimeout: 5000,
        },
      )) as ReturnType<WebLinkItem>;

      // 如果有返回得到 success 为 false，代表需要确认，则由确认处理状态通知
      if (!pingRes?.success) {
        messageClose();

        setUploadingStatus('normal');
        return { success: false };
      }
    } catch (err) {
      // 否则直接出错，进行状态通知
      console.log('Retry preCheckForUploadWebsite failed', err);
      messageClose();
      message.error(t('extension.loggedHomePage.homePage.status.contentHandleFailedNotify'));

      setUploadingStatus('normal');
      return { success: false };
    }

    const pingData = pingRes?.data;

    // 如果处理成功，就直接直接 storeLink
    // needSave 则只针对 「保存时」使用，不针对 chat/quickAction 时使用
    if (pingData?.parseStatus === 'finish' && needSave) {
      const description = document.head.querySelector('meta[name="description"]');
      // 如果能够
      res = await apiRequest({
        name: 'storeWeblink',
        method: 'POST',
        body: {
          url,
          origin: location?.origin || '', // 冗余存储策略，for 后续能够基于 origin 进行归类归档
          originPageTitle: document?.title || '',
          originPageUrl: location.href,
          originPageDescription: (description as any)?.content || '',
        },
      });
    }

    console.log('storeWeblink', res);

    await delay(1000);

    setUploadingStatus('normal');

    messageClose();
    message.success(t('extension.loggedHomePage.homePage.status.contentHandleSuccessNotify'));
    return res;
  };

  // 这里用户手动保存时，进行重试尝试
  const retryUploadWebsite = async (
    url: string,
    needSave = true,
    retryCnt = 10, // 默认重试次数
    maxTimeout = 5000, // 默认 5 秒会失败
  ): Promise<{ success: boolean; data?: any; errMsg?: any }> => {
    try {
      const res = await retryify(
        async () => {
          const res = await handleUploadWebsite(url, needSave);
          return res;
        },
        {
          maxRetries: retryCnt,
          maxTimeout,
        },
      );

      return res as { success: boolean; data?: any };
    } catch (err) {
      console.log('retryUploadWebsite err', err);
      return { success: false, errMsg: String(err) };
    }
  };

  return {
    uploadingStatus,
    handleUploadWebsite,
    handleClientUploadHtml,
    handleClientStore,
    retryUploadWebsite,
  };
};
