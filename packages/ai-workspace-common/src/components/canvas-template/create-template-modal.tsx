import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Form, Input, message, Modal } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useExportCanvasAsImage } from '@refly-packages/ai-workspace-common/hooks/use-export-canvas-as-image';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useGetPageDetail } from '@refly-packages/ai-workspace-common/queries/queries';
import { type NodeRelation } from '../../../../../apps/web/src/pages/pages/components/ArtifactRenderer';
import { NodeRenderer } from '../../../../../apps/web/src/pages/pages/components/NodeRenderer';

interface CreateTemplateModalProps {
  title: string;
  categoryId?: string;
  canvasId: string;
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

const CoverPreview = memo(
  forwardRef<
    HTMLDivElement,
    { node?: NodeRelation; isEdit?: boolean; handleCoverEdit?: () => void }
  >(({ node, isEdit, handleCoverEdit }, ref) => {
    if (!node) return null;

    return (
      <div
        id="#cover-preview"
        ref={ref}
        className={`relative w-full h-40 border border-solid border-1 border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white dark:bg-gray-900 hover:border-transparent ${
          isEdit ? 'cursor-pointer' : ''
        }`}
      >
        <div className="flex flex-col items-center justify-center h-full p-4">
          <NodeRenderer node={node} isModal={true} isMinimap={true} />
        </div>
        {isEdit && (
          <div
            className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-md"
            onClick={handleCoverEdit}
          >
            <div className="bg-white dark:bg-gray-800 rounded-md p-2">
              <EditOutlined className="text-gray-600 dark:text-gray-300" />
            </div>
          </div>
        )}
      </div>
    );
  }),
);

// Cover selector modal
const CoverSelectorModal = memo(
  ({
    visible,
    nodeRelations,
    selectedCover,
    onSelect,
    onCancel,
  }: {
    visible: boolean;
    nodeRelations: NodeRelation[];
    selectedCover?: NodeRelation;
    onSelect: (node: NodeRelation) => void;
    onCancel: () => void;
  }) => {
    const { t } = useTranslation();

    return (
      <Modal
        title={t('template.selectCover')}
        open={visible}
        onCancel={onCancel}
        footer={null}
        width={800}
        centered
      >
        <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
          {nodeRelations?.map((node, index) => (
            <div
              key={node.nodeId}
              className={`relative cursor-pointer border-[0.5px] border-solid rounded-md p-4 transition-all duration-200 hover:shadow-lg ${
                selectedCover?.nodeId === node.nodeId
                  ? '!border-1 border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-600'
              }`}
              onClick={() => onSelect(node)}
            >
              <div className="flex flex-col items-center justify-center h-32 pointer-events-none">
                <NodeRenderer node={node} isModal={true} isMinimap={true} />
                <div className="text-xs text-gray-400 mt-1">{index + 1}</div>
              </div>
              {selectedCover?.nodeId === node.nodeId && (
                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                  ✓
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>
    );
  },
);

export const CreateTemplateModal = memo(
  (props: CreateTemplateModalProps) => {
    const { canvasId, title, categoryId, visible, setVisible } = props;
    if (!visible) return null;
    const needCover = false;

    const coverElementRef = useRef<HTMLDivElement>(null);

    const { canvasPage } = useCanvasStoreShallow((state) => ({
      canvasPage: state.canvasPage,
    }));
    const pageId = canvasPage[canvasId];

    const { t, i18n } = useTranslation();
    const [form] = Form.useForm();
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [showCoverSelector, setShowCoverSelector] = useState(false);
    const { uploadCanvasCover, convertElementToImage } = useExportCanvasAsImage();

    const { data: pageDetailResponse } = useGetPageDetail(
      { path: { pageId: pageId || '' } },
      undefined,
      {
        enabled: !!pageId,
      },
    );
    const pageDetail = pageDetailResponse?.data;
    const nodeRelations = (pageDetail?.nodeRelations || []) as NodeRelation[];

    // Cover selection state
    const [selectedCover, setSelectedCover] = useState<NodeRelation | undefined>(
      nodeRelations?.[0],
    );

    // Update selected cover when nodeRelations change
    useEffect(() => {
      if (nodeRelations?.length && !selectedCover) {
        setSelectedCover(nodeRelations[0]);
      }
    }, [nodeRelations, selectedCover]);

    // Check if covers are available
    const hasCovers = useMemo(() => nodeRelations?.length > 0, [nodeRelations]);

    // Handle cover selection
    const handleCoverSelect = useCallback((node: NodeRelation) => {
      setSelectedCover(node);
      setShowCoverSelector(false);
    }, []);

    // Handle cover edit
    const handleCoverEdit = useCallback(() => {
      if (hasCovers) {
        setShowCoverSelector(true);
      }
    }, [hasCovers]);

    const convertCoverElementToImage = useCallback(async (): Promise<string | null> => {
      if (!selectedCover) return null;
      try {
        // Use the new convertNodeToImage function to convert the specific node
        if (!coverElementRef.current) return null;
        const result = await convertElementToImage(coverElementRef.current);
        return result?.storageKey ?? null;
      } catch (error) {
        console.error('Error converting node to image:', error);
        return null;
      }
    }, [selectedCover, convertElementToImage, coverElementRef]);

    const createTemplate = async ({
      title,
      description,
    }: { title: string; description: string }) => {
      if (confirmLoading) return;

      setConfirmLoading(true);
      try {
        let coverStorageKey: string;

        // Try to convert cover element to image, fallback to canvas cover
        if (needCover && hasCovers && selectedCover) {
          const nodeImageKey = await convertCoverElementToImage();
          if (nodeImageKey) {
            coverStorageKey = nodeImageKey;
          }
        }

        if (!coverStorageKey) {
          // Use canvas cover as default
          const result = await uploadCanvasCover();
          coverStorageKey = result.storageKey;
        }

        const { data } = await getClient().createCanvasTemplate({
          body: {
            title,
            description,
            language: i18n.language,
            categoryId,
            canvasId,
            coverStorageKey,
          },
        });

        if (data?.success) {
          setVisible(false);
          message.success(t('template.createSuccess'));
        }
      } catch (error) {
        console.error('Error creating template:', error);
        message.error(t('template.createError'));
      } finally {
        setConfirmLoading(false);
      }
    };

    const onSubmit = () => {
      form.validateFields().then((values) => {
        createTemplate(values);
      });
    };

    useEffect(() => {
      if (visible) {
        form.setFieldsValue({
          title,
          description: '',
        });
      }
    }, [visible, title, form]);

    return (
      <>
        <Modal
          centered
          open={visible}
          onCancel={() => setVisible(false)}
          onOk={onSubmit}
          confirmLoading={confirmLoading}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          title={t('template.createTemplate')}
          width={600}
        >
          <div className="w-full h-full pt-4 overflow-y-auto">
            <Form form={form} labelCol={{ span: 5 }}>
              <Form.Item
                required
                label={t('template.templateTitle')}
                name="title"
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Input placeholder={t('template.templateTitlePlaceholder')} />
              </Form.Item>

              {/* Cover selection */}
              {needCover && (
                <Form.Item label={t('template.templateCover')} required>
                  <div className="space-y-3">
                    {hasCovers && selectedCover ? (
                      <CoverPreview
                        node={selectedCover}
                        isEdit
                        handleCoverEdit={handleCoverEdit}
                        ref={coverElementRef}
                      />
                    ) : (
                      <div className="w-full h-40 border border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                        <div className="text-center text-gray-500 dark:text-gray-400">
                          <div className="text-lg mb-2">📷</div>
                          <div className="text-sm">{t('template.useCanvasCover')}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </Form.Item>
              )}

              <Form.Item label={t('template.templateDescription')} name="description">
                <Input.TextArea
                  autoSize={{ minRows: 3, maxRows: 6 }}
                  placeholder={t('template.templateDescriptionPlaceholder')}
                />
              </Form.Item>
            </Form>
          </div>
        </Modal>

        {/* Cover selector modal */}
        {hasCovers && (
          <CoverSelectorModal
            visible={showCoverSelector}
            nodeRelations={nodeRelations || []}
            selectedCover={selectedCover}
            onSelect={handleCoverSelect}
            onCancel={() => setShowCoverSelector(false)}
          />
        )}
      </>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.visible === nextProps.visible;
  },
);
