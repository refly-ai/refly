import './index.scss';
import { Tooltip } from 'antd';
import { Popover } from 'antd';

import { Source } from '@refly/openapi-schema';
// 请求
import { safeParseURL } from '@refly/utils/url';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';

import { memo } from 'react';
import { getRuntime } from '@refly/utils/env';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';

interface SourceDetailItemProps {
  item: Source;
  collectionId?: string;
  index: number;
  showUtil?: boolean;
  showDesc?: boolean;
  showBtn?: { summary: boolean; markdown: boolean; externalOrigin: boolean };
  canDelete?: boolean;
  small?: boolean;
  btnProps?: { defaultActiveKeys: string[] };
  handleItemClick: (source: Source) => void;
}

export const SourceDetailItem = memo((props: SourceDetailItemProps) => {
  const { item, index, showDesc = true, small = false } = props;

  return (
    <div
      className={'source-detail-item'}
      style={
        small
          ? {
              width: 48,
              height: 48,
              borderRadius: 8,
            }
          : {}
      }
      key={index}
      onClick={() => {
        props?.handleItemClick(item);
      }}
    >
      <div className="knowledge-base-directory-site-intro">
        <Tooltip
          placement="right"
          color="white"
          title={small ? <div style={{ color: '#000' }}>{item?.title}</div> : null}
        >
          <div className="site-intro-icon">
            <img
              style={small ? { width: 24, height: 24 } : {}}
              src={`https://www.google.com/s2/favicons?domain=${safeParseURL(item?.url as string)}&sz=${small ? 24 : 32}`}
              alt={item?.url}
            />
          </div>
        </Tooltip>
        {!small && (
          <div className="site-intro-content">
            <p className="">{item.title}</p>
            <a className="site-intro-site-url" href={item.url} target="_blank" rel="noreferrer">
              {item.url}
            </a>
          </div>
        )}
      </div>
      {!small && (
        <>
          <div className="knowledge-base-directory-title">{item.title}</div>

          {showDesc ? (
            <div style={{ maxHeight: 200, overflowY: 'scroll' }}>
              <Markdown content={item?.pageContent || ''} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
});

const renderPopoverContent = (item: Source) => (
  <div className="search-result-popover-content">
    <h4>{item.title}</h4>
    <div className="content-body">{item.pageContent}</div>
  </div>
);

export const SourceDetailItemWrapper = memo((props: SourceDetailItemProps) => {
  const runtime = getRuntime();
  const isWeb = runtime === 'web';
  return (
    <Popover
      title={null}
      content={renderPopoverContent(props.item)}
      placement={isWeb ? 'left' : 'bottom'}
      trigger="hover"
      align={isWeb ? { offset: [-15, 0] } : {}}
      mouseEnterDelay={0.5}
      getPopupContainer={(_node: Element) => {
        const container = getPopupContainer();
        return (
          !isWeb ? (container.querySelector('.ai-copilot-container') as Element) : container
        ) as HTMLElement;
      }}
    >
      <div>
        <SourceDetailItem {...props} />
      </div>
    </Popover>
  );
});
