import { useAddNodesToCanvasPage } from '@refly-packages/ai-workspace-common/queries/queries';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Form, message, Typography } from 'antd';
import { CheckboxChangeEvent } from 'antd/es/checkbox';
import { useCanvasStoreShallow } from '@refly/stores';
import { getContextItemIcon } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager/utils/icon';
import React from 'react';
import { logEvent } from '@refly/telemetry-web';

const { Text } = Typography;

interface CreatePageFromCanvasProps {
  canvasId: string;
  afterCreate: (pageId: string) => void;
}

export const CreatePageFromCanvas = memo(({ canvasId, afterCreate }: CreatePageFromCanvasProps) => {
  const { t } = useTranslation();
  const [_title, setTitle] = useState('');
  const [nodeIds, setNodeIds] = useState<string[]>([]);
  const [loadingCanvasData, setLoadingCanvasData] = useState(false);
  const [availableNodes, setAvailableNodes] = useState<any[]>([]);
  const { setCanvasPage } = useCanvasStoreShallow((state) => ({
    setCanvasPage: state.setCanvasPage,
  }));

  const { mutate: addNodes, isPending } = useAddNodesToCanvasPage(undefined, {
    onSuccess: (response: any) => {
      const pageId = response?.data?.data?.page?.pageId;
      if (pageId) {
        setTitle('');
        setNodeIds([]);
        setCanvasPage(canvasId, pageId);
        message.success(t('pages.new.pageCreatedSuccess'));
        afterCreate?.(pageId);
      }
    },
    onError: (error) => {
      console.error('Failed to add nodes:', error);
    },
  });

  const getCanvasData = useCallback(async () => {
    if (!canvasId?.trim()) {
      return;
    }

    setLoadingCanvasData(true);
    const response = await getClient().getCanvasData({
      query: {
        canvasId,
      },
    });
    setLoadingCanvasData(false);

    if (response?.data?.success) {
      setAvailableNodes(
        (response?.data?.data?.nodes || []).filter(
          (node: any) => !['skill', 'group'].includes(node?.type),
        ),
      );
    }
  }, [canvasId]);

  const checkedAll = useMemo(
    () => nodeIds?.length === availableNodes?.length && availableNodes?.length > 0,
    [nodeIds, availableNodes],
  );

  const indeterminate = useMemo(
    () => (nodeIds?.length ?? 0) > 0 && (nodeIds?.length ?? 0) < (availableNodes?.length ?? 0),
    [nodeIds, availableNodes],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!canvasId?.trim()) {
        return;
      }

      if (nodeIds?.length === 0) {
        message.error(t('pages.new.pleaseSelectAtLeastOneNode'));
        return;
      }

      addNodes({
        path: { canvasId },
        body: { nodeIds },
      });
    },
    [canvasId, nodeIds, t, addNodes],
  );

  const handleCheckAll = useCallback(
    (e: CheckboxChangeEvent) => {
      const newNodeIds = e.target.checked
        ? availableNodes?.map((node) => node?.data?.entityId).filter(Boolean)
        : [];
      setNodeIds(newNodeIds);
    },
    [availableNodes],
  );

  const handleNodeIdsChange = useCallback((values: string[]) => {
    setNodeIds(values);
  }, []);

  useEffect(() => {
    getCanvasData();
    return () => {
      setNodeIds([]);
    };
  }, [canvasId]);

  return (
    <div className="w-full h-[60vh] overflow-hidden">
      <div className="mx-auto flex flex-col w-full h-full max-w-3xl">
        {availableNodes?.length > 0 ? (
          <Form className="flex flex-col flex-1 min-h-20 pt-6">
            <div className="flex-1 overflow-hidden px-6 border border-dashed border-gray-200 rounded-md">
              <div className="flex items-center h-8">
                <span className="text-red-500 mr-1">*</span>
                {t('pages.new.selectNodesToInclude')}
              </div>

              <Form.Item
                className="page-node-list flex-grow h-full min-h-10"
                name="nodeIds"
                required={true}
              >
                <div className="mb-2 pt-1">
                  <Checkbox
                    checked={checkedAll}
                    indeterminate={indeterminate}
                    onChange={handleCheckAll}
                  >
                    {t('pages.new.selectAll')}
                  </Checkbox>
                </div>
                <div className="list">
                  <Checkbox.Group
                    className="w-full flex flex-col gap-2"
                    value={nodeIds}
                    onChange={handleNodeIdsChange}
                  >
                    {availableNodes?.map((node) => (
                      <Checkbox
                        className="w-full node-option"
                        key={node?.data?.entityId}
                        value={node?.data?.entityId}
                      >
                        <div className="w-full flex items-center justify-between">
                          <div className="flex-shrink-0 mr-2">
                            {getContextItemIcon(node?.type, {
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              transform: 'translateY(1px)',
                            })}
                          </div>
                          <Text ellipsis={{ tooltip: true }}>
                            {node?.data?.title || t('common.untitled')}
                          </Text>
                        </div>
                      </Checkbox>
                    ))}
                  </Checkbox.Group>
                </div>
              </Form.Item>
            </div>
            <div className="w-full flex gap-2 justify-end py-4 border-t">
              <Button type="default" onClick={() => getCanvasData()} loading={loadingCanvasData}>
                {t('pages.new.refresh')}
              </Button>
              <Button
                type="primary"
                onClick={(e) => {
                  logEvent('canvas::canvas_demo_play', Date.now(), {
                    canvas_id: canvasId,
                  });
                  handleSubmit(e);
                }}
                loading={isPending}
                disabled={nodeIds?.length === 0}
              >
                {t('pages.new.createPage')}
              </Button>
            </div>
          </Form>
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] px-12">
            <Text className="text-gray-400">{t('pages.new.noNodesFound')}</Text>
            <Button className="mt-4" onClick={() => getCanvasData()} loading={loadingCanvasData}>
              {t('pages.new.refresh')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});
