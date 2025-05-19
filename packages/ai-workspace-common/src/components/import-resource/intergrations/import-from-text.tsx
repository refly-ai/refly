import { Button, Input, message, Form } from 'antd';
import { useEffect, useState } from 'react';

// utils
import { useImportResourceStoreShallow } from '@refly-packages/ai-workspace-common/stores/import-resource';
// request
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { UpsertResourceRequest } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { TbClipboard } from 'react-icons/tb';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { StorageLimit } from './storageLimit';
import { getAvailableFileCount } from '@refly/utils/quota';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useUpdateSourceList } from '@refly-packages/ai-workspace-common/hooks/canvas/use-update-source-list';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';

const { TextArea } = Input;
const FormItem = Form.Item;

export const ImportFromText = () => {
  const { t } = useTranslation();
  const { copiedTextPayload, setImportResourceModalVisible, setCopiedTextPayload } =
    useImportResourceStoreShallow((state) => ({
      copiedTextPayload: state.copiedTextPayload,
      setImportResourceModalVisible: state.setImportResourceModalVisible,
      setCopiedTextPayload: state.setCopiedTextPayload,
    }));
  const { projectId, isCanvasOpen } = useGetProjectCanvasId();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(projectId || null);
  const { updateSourceList } = useUpdateSourceList();
  const { refetchUsage, storageUsage } = useSubscriptionUsage();
  const { insertNodePosition } = useImportResourceStoreShallow((state) => ({
    insertNodePosition: state.insertNodePosition,
  }));

  const [saveLoading, setSaveLoading] = useState(false);

  const canImportCount = getAvailableFileCount(storageUsage);
  const disableSave = () => {
    return !copiedTextPayload?.content || canImportCount < 1;
  };

  const handleSave = async () => {
    if (!copiedTextPayload?.content) {
      message.warning(t('resource.import.emptyText'));
      return;
    }

    const createResourceData: UpsertResourceRequest = {
      projectId: currentProjectId,
      resourceType: 'text',
      title: copiedTextPayload?.title || 'Untitled',
      content: copiedTextPayload?.content || '',
      data: {
        url: copiedTextPayload?.url || 'https://refly.ai',
        title: copiedTextPayload?.title || 'Untitled',
      },
    };
    setSaveLoading(true);
    const { data } = await getClient().createResource({
      body: createResourceData,
    });

    setSaveLoading(false);
    setCopiedTextPayload({ title: '', content: '' });
    setImportResourceModalVisible(false);

    if (data?.success) {
      refetchUsage();
      if (isCanvasOpen) {
        nodeOperationsEmitter.emit('addNode', {
          node: {
            type: 'resource',
            data: {
              title: data?.data?.title || 'Untitled',
              entityId: data?.data?.resourceId,
              contentPreview: data?.data?.contentPreview,
              metadata: {
                resourceType: 'text',
              },
            },
            position: insertNodePosition,
          },
        });
      }
      updateSourceList([data?.data], currentProjectId);
    }
  };

  useEffect(() => {
    const { title, content, url } = copiedTextPayload;
    if (title) setCopiedTextPayload({ title });
    if (content) setCopiedTextPayload({ content });
    if (url) setCopiedTextPayload({ url });

    return () => {
      /* reset and copiedTextPayload after modal hide */
      setCopiedTextPayload({ title: '', content: '', url: '' });
    };
  }, []);

  return (
    <div className="h-full flex flex-col min-w-[500px] box-border intergation-import-from-weblink">
      {/* header */}
      <div className="flex items-center gap-2 p-6">
        <span className="flex items-center justify-center">
          <TbClipboard className="text-lg" />
        </span>
        <div className="text-base font-bold">{t('resource.import.fromText')}</div>
      </div>

      {/* content */}
      <div className="flex-grow overflow-y-auto px-6 box-border">
        <Form layout="vertical">
          <FormItem label={t('resource.import.textTitlePlaceholder')}>
            <Input
              value={copiedTextPayload?.title}
              onChange={(e) => setCopiedTextPayload({ title: e.target.value })}
            />
          </FormItem>
          <FormItem label={t('resource.import.textUrlPlaceholder')}>
            <Input
              value={copiedTextPayload?.url}
              onChange={(e) => setCopiedTextPayload({ url: e.target.value })}
            />
          </FormItem>
          <FormItem required label={t('resource.import.textContentPlaceholder')}>
            <TextArea
              rows={4}
              autoSize={{
                minRows: 4,
                maxRows: 7,
              }}
              maxLength={100000}
              value={copiedTextPayload?.content}
              allowClear
              onChange={(e) => setCopiedTextPayload({ content: e.target.value })}
            />
          </FormItem>
        </Form>
      </div>

      {/* footer */}
      <div className="w-full flex justify-between items-center border-t border-solid border-[#e5e5e5] dark:border-[#2f2f2f] border-x-0 border-b-0 p-[16px] rounded-none">
        <div className="flex items-center gap-x-[8px]">
          <StorageLimit
            resourceCount={1}
            projectId={currentProjectId}
            onSelectProject={setCurrentProjectId}
          />
        </div>
        <div className="flex items-center gap-x-[8px] flex-shrink-0">
          <Button onClick={() => setImportResourceModalVisible(false)}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            loading={saveLoading}
            disabled={disableSave()}
            onClick={handleSave}
          >
            {isCanvasOpen ? t('common.saveToCanvas') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
};
