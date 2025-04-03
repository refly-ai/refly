import { IconCopy } from '@refly-packages/ai-workspace-common/components/common/icon';

import React from 'react';
import { Button, notification } from 'antd';
import { LOCALE } from '@refly/common-types';
import { ActionResultNotFoundError, getErrorMessage } from '@refly/errors';

import { UnknownError } from '@refly/errors';
import { BaseResponse } from '@refly/openapi-schema';

const errTitle = {
  en: 'Oops, something went wrong',
  'zh-CN': '哎呀，出错了',
};

const ignoredErrorCodes = [new ActionResultNotFoundError().code];

export const showErrorNotification = (res: BaseResponse, locale: LOCALE) => {
  const { errCode, traceId, stack } = res;
  if (ignoredErrorCodes.includes(errCode)) {
    return;
  }

  const isUnknownError = !errCode || errCode === new UnknownError().code;
  const errMsg = getErrorMessage(errCode, locale);

  const description = React.createElement(
    'div',
    null,
    React.createElement(
      'div',
      {
        style: { fontSize: 14 },
      },
      errMsg,
    ),
    isUnknownError &&
      stack &&
      React.createElement(
        'pre',
        {
          style: {
            fontSize: 12,
            overflow: 'auto',
            marginTop: 8,
            border: '1px solid #eee',
            borderRadius: 8,
            padding: '10px 16px',
            color: 'black',
            backgroundColor: '#eee',
          },
        },
        stack,
      ),
    traceId &&
      React.createElement(
        'div',
        {
          style: {
            marginTop: 8,
            fontSize: 11,
            color: '#666',
            display: 'flex',
            alignItems: 'center',
          },
        },
        React.createElement('div', null, `Trace ID: ${traceId}`),
        React.createElement(
          Button,
          {
            type: 'link',
            size: 'small',
            onClick: () => {
              navigator.clipboard.writeText(traceId);
              notification.success({
                message: locale === 'zh-CN' ? '已复制' : 'Copied',
                duration: 2,
              });
            },
          },
          React.createElement(IconCopy, { style: { fontSize: 14, color: '#666' } }),
        ),
      ),
  );

  notification.error({
    message: errTitle[locale],
    description,
    duration: isUnknownError ? -1 : 5,
  });
};
