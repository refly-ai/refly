import { Button, Alert } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingOutlined, ReloadOutlined } from '@ant-design/icons';

import { ResourceIcon } from '@refly-packages/ai-workspace-common/components/common/resourceIcon';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { Resource } from '@refly/openapi-schema';

interface ResourceMetaProps {
  resourceDetail: Resource;
  isReindexing: boolean;
  onReindex: (resourceId: string) => void;
}

export const ResourceMeta = memo(
  ({ resourceDetail, isReindexing, onReindex }: ResourceMetaProps) => {
    const { t, i18n } = useTranslation();
    const language = i18n.languages?.[0];
    const indexStatus = resourceDetail?.indexStatus ?? 'finish';

    return (
      <div className="knowledge-base-resource-meta">
        {['wait_parse', 'wait_index', 'index_failed'].includes(indexStatus) && (
          <Alert
            className="py-[8px] px-[15px] !items-center"
            style={{ marginBottom: 16 }}
            type={['wait_index', 'wait_parse'].includes(indexStatus) ? 'warning' : 'error'}
            showIcon
            icon={['wait_index', 'wait_parse'].includes(indexStatus) ? <LoadingOutlined /> : null}
            description={
              t(`resource.${indexStatus}`) +
              (['wait_index', 'index_failed'].includes(indexStatus)
                ? `: ${t(`resource.${indexStatus}_tip`)}`
                : '')
            }
            action={
              ['index_failed'].includes(indexStatus) ? (
                <Button
                  size="small"
                  loading={isReindexing}
                  icon={<ReloadOutlined />}
                  className="retry-btn"
                  onClick={() => onReindex(resourceDetail.resourceId)}
                >
                  {t('common.retry')}
                </Button>
              ) : null
            }
          />
        )}

        <div className="knowledge-base-directory-site-intro">
          <div className="site-intro-icon flex justify-center items-center">
            <ResourceIcon
              url={resourceDetail?.data?.url ?? ''}
              resourceType={resourceDetail?.resourceType}
              resourceMeta={resourceDetail?.data}
              size={24}
            />
          </div>
          <div className="site-intro-content flex flex-col justify-center">
            {resourceDetail?.title && (
              <p className="text-gray-700 font-medium">{resourceDetail?.title}</p>
            )}
            {resourceDetail?.data?.url && (
              <a
                className="site-intro-site-url no-underline text-[#0E9F77]"
                href={resourceDetail?.data?.url}
                target="_blank"
                rel="noreferrer"
              >
                {resourceDetail?.data?.url}
              </a>
            )}
            {resourceDetail?.createdAt && (
              <p className="text-gray-400">
                {time(resourceDetail?.createdAt, language as LOCALE)
                  .utc()
                  .fromNow()}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  },
);
