import { useState } from 'react';
import { Avatar, Button, Input, List, message, Empty } from 'antd';
import { HiLink } from 'react-icons/hi';
import { HiOutlineXMark } from 'react-icons/hi2';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { isUrl } from '@refly/utils/isUrl';
import { genUniqueId } from '@refly/utils/id';
import {
  LinkMeta,
  useImportResourceStore,
  useImportResourceStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/import-resource';
// request
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { UpsertResourceRequest } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { StorageLimit } from './storageLimit';
import { getAvailableFileCount } from '@refly/utils/quota';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useUpdateSourceList } from '@refly-packages/ai-workspace-common/hooks/canvas/use-update-source-list';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';

const { TextArea } = Input;

export const ImportFromWeblink = () => {
  const { t } = useTranslation();
  const [linkStr, setLinkStr] = useState('');
  const { scrapeLinks, setScrapeLinks, setImportResourceModalVisible, insertNodePosition } =
    useImportResourceStoreShallow((state) => ({
      scrapeLinks: state.scrapeLinks,
      setScrapeLinks: state.setScrapeLinks,
      setImportResourceModalVisible: state.setImportResourceModalVisible,
      insertNodePosition: state.insertNodePosition,
    }));

  const { projectId, isCanvasOpen } = useGetProjectCanvasId();

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(projectId || null);
  const { updateSourceList } = useUpdateSourceList();

  const { refetchUsage, storageUsage } = useSubscriptionUsage();

  const [saveLoading, setSaveLoading] = useState(false);

  const scrapeSingleUrl = async (key: string, url: string) => {
    const { scrapeLinks } = useImportResourceStore.getState();
    try {
      const { data, error } = await getClient().scrape({ body: { url } });

      if (error) {
        throw error;
      }

      const { title, description, image } = data?.data ?? {};

      const newLinks = scrapeLinks.map((link) => {
        if (link?.key === key) {
          link.title = title;
          link.description = description;
          link.image = image;
          link.isHandled = true;
        }

        return link;
      });
      setScrapeLinks(newLinks);
    } catch (err) {
      console.log('fetch url error, silent ignore', err);
      const newLinks = scrapeLinks.map((link) => {
        if (link?.key === key) {
          link.isError = true;
        }

        return link;
      });
      setScrapeLinks(newLinks);
    }
  };

  const scrapeLink = async (linkStr: string) => {
    try {
      const links: LinkMeta[] = linkStr
        .split('\n')
        .filter((str) => str && isUrl(str))
        .map((url) => ({
          url: url.trim(),
          key: genUniqueId(),
          isHandled: false,
        }));

      if (links?.length === 0) {
        message.warning(t('resource.import.linkFormatError'));
        return;
      }

      const { scrapeLinks } = useImportResourceStore.getState();
      setScrapeLinks(scrapeLinks.concat(links));
      setLinkStr('');

      // Scrape the link information
      await Promise.all(links.map((link) => scrapeSingleUrl(link.key, link.url)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    const { scrapeLinks } = useImportResourceStore.getState();

    if (scrapeLinks?.length === 0) {
      message.warning(t('resource.import.emptyLink'));
      return;
    }

    const batchCreateResourceData: UpsertResourceRequest[] = scrapeLinks.map((link) => {
      return {
        projectId: currentProjectId,
        resourceType: 'weblink',
        title: link?.title,
        data: {
          url: link?.url,
          title: link?.title,
        },
      };
    });

    setSaveLoading(true);
    const { data } = await getClient().batchCreateResource({
      body: batchCreateResourceData,
    });
    setSaveLoading(false);

    if (!data?.success) {
      return;
    }

    refetchUsage();
    message.success(t('common.putSuccess'));
    setScrapeLinks([]);
    setImportResourceModalVisible(false);
    setLinkStr('');

    if (isCanvasOpen) {
      const resources =
        data && Array.isArray(data.data)
          ? data.data.map((resource) => ({
              id: resource.resourceId,
              title: resource.title,
              domain: 'resource',
              contentPreview: resource.contentPreview,
            }))
          : [];
      resources.forEach((resource, index) => {
        const nodePosition = insertNodePosition
          ? {
              x: insertNodePosition?.x + index * 300,
              y: insertNodePosition?.y,
            }
          : null;

        nodeOperationsEmitter.emit('addNode', {
          node: {
            type: 'resource',
            data: {
              title: resource.title,
              entityId: resource.id,
              contentPreview: resource.contentPreview,
            },
            position: nodePosition,
          },
        });
      });
    }

    updateSourceList(data && Array.isArray(data.data) ? data.data : [], currentProjectId);
  };

  const canImportCount = getAvailableFileCount(storageUsage);
  const disableSave = () => {
    return scrapeLinks.length === 0 || scrapeLinks.length > canImportCount;
  };

  return (
    <div className="h-full flex flex-col min-w-[500px] box-border intergation-import-from-weblink">
      {/* header */}
      <div className="flex items-center gap-x-[8px] pt-6 px-6">
        <span className="flex items-center justify-center">
          <HiLink className="text-lg" />
        </span>
        <div className="text-base font-bold">{t('resource.import.fromWeblink')}</div>
      </div>

      {/* content */}
      <div className="flex-grow overflow-y-auto p-6 box-border">
        <div className="w-full">
          <TextArea
            placeholder={t('resource.import.webLinkPlaceholer')}
            rows={4}
            autoSize={{
              minRows: 4,
              maxRows: 4,
            }}
            value={linkStr}
            onChange={(e) => setLinkStr(e.target.value)}
          />
          <Button
            type="primary"
            style={{ marginTop: 16 }}
            className="w-full"
            disabled={!linkStr}
            onClick={() => {
              scrapeLink(linkStr);
            }}
          >
            {t('common.add')}
          </Button>
        </div>

        <div className="mt-[24px]">
          <h2 className="text-sm font-bold text-[#00000080] dark:text-[#ffffff80]">
            {t('resource.import.waitingList')}
          </h2>
          <div className="mt-[12px]">
            {scrapeLinks?.length > 0 ? (
              <List
                style={{ marginBottom: 48, border: 'none' }}
                dataSource={scrapeLinks}
                renderItem={(item, index) => <RenderItem item={item} key={index} />}
              />
            ) : (
              <Empty description={t('resource.import.emptyLink')} />
            )}
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="w-full flex justify-between items-center border-t border-solid border-[#e5e5e5] dark:border-[#2f2f2f] border-x-0 border-b-0 p-[16px] rounded-none">
        <div className="flex items-center gap-x-[8px]">
          <p className="font-bold whitespace-nowrap text-md text-[#00968f]">
            {t('resource.import.linkCount', { count: scrapeLinks?.length || 0 })}
          </p>
          <StorageLimit
            resourceCount={scrapeLinks?.length || 0}
            projectId={currentProjectId}
            onSelectProject={setCurrentProjectId}
          />
        </div>

        <div className="flex items-center gap-x-[8px] flex-shrink-0">
          <Button onClick={() => setImportResourceModalVisible(false)}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            onClick={handleSave}
            disabled={disableSave()}
            loading={saveLoading}
          >
            {isCanvasOpen ? t('common.saveToCanvas') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
};

const RenderItem = (props: { item: LinkMeta }) => {
  const importResourceStore = useImportResourceStore();
  const { item } = props;
  const { t } = useTranslation();

  return (
    <Spin spinning={!item.isHandled && !item.isError} style={{ width: '100%', minHeight: 80 }}>
      <List.Item
        actions={[
          <Button
            key={item.key}
            type="text"
            className="assist-action-item"
            onClick={() => {
              window.open(item?.url, '_blank');
            }}
          >
            <HiLink />
          </Button>,
          <Button
            key={item.key}
            type="text"
            className="assist-action-item"
            onClick={() => {
              const newLinks = importResourceStore?.scrapeLinks?.filter((link) => {
                return link?.key !== item?.key;
              });

              importResourceStore.setScrapeLinks(newLinks);
            }}
          >
            <HiOutlineXMark strokeWidth={2} />
          </Button>,
        ]}
        className="intergation-result-list-item !border-[#f1f1f0] dark:!border-[#2f2f2f]"
      >
        <List.Item.Meta
          avatar={<Avatar src={item.image} />}
          title={
            <div className="intergation-result-intro">
              <p>
                <span
                  className="intergation-result-url dark:text-[#ffffff80] text-[#00000080]"
                  onClick={() => window.open(item?.url, '_blank')}
                >
                  {item?.url}
                </span>
              </p>
              <p>
                {item?.isError ? (
                  <span className="text-red-500">{t('resource.import.scrapeError')}</span>
                ) : (
                  item?.title
                )}
              </p>
            </div>
          }
          description={item.description}
        />
      </List.Item>
    </Spin>
  );
};
