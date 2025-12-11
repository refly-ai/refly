import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, message, Modal, Upload, Image, Switch, Spin, Tooltip } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import { Trans, useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import { ArrowRight, Checked, Question } from 'refly-icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { logEvent } from '@refly/telemetry-web';
import { MultiSelectResult } from './multi-select-result';
import { SelectedResultsGrid } from './selected-results-grid';
import BannerSvg from './banner.svg';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { CanvasNode, DriveFile } from '@refly/openapi-schema';
import { useGetCanvasCommissionByCanvasId } from '../../queries/queries';
import { mapDriveFilesToCanvasNodes } from '@refly/utils';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';

interface CreateWorkflowAppModalProps {
  title: string;
  canvasId: string;
  visible: boolean;
  setVisible: (visible: boolean) => void;
  onPublishSuccess?: () => void;
  appId?: string; // Optional app ID to load existing app data
}

interface SuccessMessageProps {
  shareId: string;
  onClose?: () => void;
}

// Success message shown inside antd message with share link and copy action
const SuccessMessage = memo(({ shareId, onClose }: SuccessMessageProps) => {
  const { t } = useTranslation();
  const shareLink = useMemo(() => getShareLink('workflowApp', shareId), [shareId]);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!shareLink) return;
    try {
      const ok = await copyToClipboard(shareLink);
      if (ok) {
        setCopied(true);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy link:', err);
    }
  }, [shareLink]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Auto copy link when component mounts
  useEffect(() => {
    if (shareLink) {
      // Fire and forget; internal function handles errors and success flag
      void handleCopy();
    }
  }, [shareLink, handleCopy]);

  return (
    <div className="flex items-center gap-2">
      <Checked size={20} color="var(--refly-func-success-default)" />
      <span className="text-base font-medium text-refly-text-0">
        {t('workflowApp.publishSuccess')}
      </span>
      <div className="flex items-center gap-2 border border-refly-Card-Border bg-refly-bg-content-z1 rounded-full pl-3 pr-1 py-1 max-w-[500px]">
        <span className="flex-1 text-sm text-refly-text-1 max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap">
          {shareLink}
        </span>
        <Button
          size="small"
          className="!h-[28px] !px-3 rounded-full text-sm text-refly-text-0"
          onClick={handleCopy}
        >
          {copied ? t('shareContent.linkCopied') : t('shareContent.copyLink')}
        </Button>
        <Button
          size="small"
          className="!h-[28px] !px-2 rounded-full text-sm text-refly-text-2 hover:text-refly-text-0"
          onClick={handleClose}
          type="text"
        >
          ×
        </Button>
      </div>
    </div>
  );
});

SuccessMessage.displayName = 'SuccessMessage';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export const CreateWorkflowAppModal = ({
  canvasId,
  title,
  visible,
  setVisible,
  onPublishSuccess,
  appId,
}: CreateWorkflowAppModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const showRemix = false;

  // Cover image upload state
  const [coverFileList, setCoverFileList] = useState<UploadFile[]>([]);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverStorageKey, setCoverStorageKey] = useState<string | undefined>(undefined);

  // Preview state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('');

  // App data loading state
  const [appData, setAppData] = useState<any>(null);
  const [loadingAppData, setLoadingAppData] = useState(false);

  // Run result selection state
  const [selectedResults, setSelectedResults] = useState<string[]>([]);

  // Drive files state
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);

  // Copy share link state
  const [linkCopied, setLinkCopied] = useState(false);

  // Initial form data state for change detection
  const [initialFormData, setInitialFormData] = useState<{
    publishToCommunity: boolean;
    title: string;
    description: string;
    selectedResults: string[];
    coverStorageKey: string | undefined;
  } | null>(null);

  // Flag to track if initial data has been saved (to prevent overwriting)
  const [initialDataSaved, setInitialDataSaved] = useState(false);

  const { data: workflowVariables } = useVariablesManagement(canvasId);
  const { nodes } = useRealtimeCanvasData();

  const skillResponseNodes = nodes.filter((node) => node.type === 'skillResponse');
  const activeResultIdSet = new Set(
    skillResponseNodes.map((node) => node.data?.entityId).filter(Boolean),
  );

  const { forceSyncState } = useCanvasContext();

  // Fetch credit usage data when modal is visible
  const { data: creditUsageData } = useGetCanvasCommissionByCanvasId(
    {
      query: { canvasId },
    },
    undefined,
    {
      enabled: visible,
    },
  );

  // Calculate credit earnings per run, default to 0
  const creditEarningsPerRun = useMemo(() => {
    const total = creditUsageData?.data?.total ?? 0;
    return total;
  }, [creditUsageData]);

  // Fetch drive files when modal is visible
  useEffect(() => {
    if (!visible || !canvasId) {
      return;
    }

    const fetchDriveFiles = async () => {
      try {
        const allFiles: DriveFile[] = [];
        let page = 1;
        const pageSize = 100;
        const MAX_PAGES = 100; // Safety limit: max 10000 files

        // Paginate through all drive files
        while (page <= MAX_PAGES) {
          const { data } = await getClient().listDriveFiles({
            query: {
              canvasId,
              source: 'agent',
              scope: 'present',
              page,
              pageSize,
            },
          });

          const files = data?.data ?? [];
          allFiles.push(...files.filter((file) => activeResultIdSet.has(file.resultId)));

          if (files.length < pageSize) {
            break;
          }
          page++;
        }

        setDriveFiles(allFiles);
      } catch (error) {
        console.error('Failed to fetch drive files:', error);
        // Silently degrade - continue with empty drive files
      }
    };

    fetchDriveFiles();
  }, [visible, canvasId]);

  // Map drive files to virtual CanvasNodes
  const driveFileNodes: CanvasNode[] = useMemo(() => {
    const serverOrigin = window.location.origin;
    return mapDriveFilesToCanvasNodes(driveFiles, serverOrigin) as any;
  }, [driveFiles]);

  // Filter nodes for legacy product nodes (backward compatibility)
  // Keep product nodes that may still exist in canvas (before migration to drive_files)
  const resultNodes: CanvasNode[] = useMemo(() => {
    if (!nodes?.length) {
      return [] as unknown as CanvasNode[];
    }

    return nodes.filter(
      (node) =>
        ['document', 'codeArtifact', 'website', 'video', 'audio'].includes(node.type) ||
        (node.type === 'image' && !!node.data?.metadata?.resultId),
    ) as unknown as CanvasNode[];
  }, [nodes]);

  // Merge all node types: driveFileNodes + resultNodes + skillResponseNodes
  const displayNodes: CanvasNode[] = useMemo(() => {
    // Priority: resultNodes (legacy canvas nodes) > driveFileNodes > skillResponseNodes
    // This ensures legacy product nodes take precedence over drive file duplicates
    const allNodes = [
      ...(resultNodes ?? []), // Legacy product nodes first
      ...(driveFileNodes ?? []), // Drive file nodes second
      ...(skillResponseNodes ?? []), // Skill response nodes last
    ];

    // Deduplicate by node ID
    const uniqueMap = new Map<string, any>();

    for (const node of allNodes) {
      if (!node?.id) continue;

      // Skip if already added by node ID
      if (uniqueMap.has(node.id as string)) continue;

      uniqueMap.set(node.id as string, node);
    }

    return Array.from(uniqueMap.values()) as CanvasNode[];
  }, [driveFileNodes, resultNodes, skillResponseNodes]);

  // Load existing app data
  const loadAppData = useCallback(async (appId: string) => {
    if (!appId) return;

    setLoadingAppData(true);
    try {
      const { data } = await getClient().getWorkflowAppDetail({
        query: { appId },
      });

      if (data?.success && data?.data) {
        setAppData(data.data);
        // Note: selectedResults will be set separately in useEffect when displayNodes is ready
      }
    } catch (error) {
      console.error('Failed to load app data:', error);
    } finally {
      setLoadingAppData(false);
    }
  }, []);

  // Handle cover image upload
  const uploadCoverImage = async (file: File): Promise<string> => {
    try {
      const { data } = await getClient().upload({
        body: {
          file,
          entityType: 'workflowApp',
          visibility: 'public',
        },
      });

      if (data?.success && data?.data?.storageKey) {
        return data.data.storageKey;
      }
      throw new Error('Upload failed');
    } catch (error) {
      console.error('Error uploading cover image:', error);
      throw error;
    }
  };

  // Handle cover upload change
  const handleCoverUploadChange: UploadProps['onChange'] = (info) => {
    setCoverFileList(info.fileList);

    // Clear storage key when all files are removed
    if (info.fileList.length === 0) {
      setCoverStorageKey('');
    }
  };

  // Custom upload request for cover image
  const customUploadRequest: UploadProps['customRequest'] = async ({
    file,
    onSuccess,
    onError,
  }) => {
    setCoverUploading(true);
    try {
      const storageKey = await uploadCoverImage(file as File);
      setCoverStorageKey(storageKey);
      onSuccess?.(storageKey);
      message.success(t('common.uploadSuccess'));
    } catch (error) {
      onError?.(error as Error);
      message.error(t('common.uploadFailed'));
    } finally {
      setCoverUploading(false);
    }
  };

  // Before upload validation
  const beforeUpload = (file: File) => {
    const isAllowedType = ALLOWED_IMAGE_TYPES.includes(file.type);
    if (!isAllowedType) {
      message.error(t('workflowApp.invalidImageType'));
      return false;
    }

    const isLt30M = file.size / 1024 / 1024 < 30;
    if (!isLt30M) {
      message.error(t('workflowApp.imageTooLarge'));
      return false;
    }

    return true;
  };

  // Custom preview handler
  const handlePreview = useCallback(async (file: UploadFile) => {
    if (!file.url && !file.preview) {
      // Generate preview for local file
      file.preview = await getBase64(file.originFileObj as File);
    }

    setPreviewImage(file.url ?? file.preview ?? '');
    setPreviewTitle(file.name ?? file.fileName ?? 'Cover Image');
    setPreviewVisible(true);
  }, []);

  // Helper function to convert file to base64
  const getBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  // Handle preview modal close
  const handlePreviewCancel = useCallback(() => {
    setPreviewVisible(false);
  }, []);

  const createWorkflowApp = async ({
    title,
    description,
    remixEnabled,
    publishToCommunity,
  }: {
    title: string;
    description: string;
    remixEnabled: boolean;
    publishToCommunity: boolean;
  }) => {
    if (confirmLoading) return;

    setConfirmLoading(true);

    try {
      const { data } = await getClient().createWorkflowApp({
        body: {
          title,
          description,
          canvasId,
          query: '', // TODO: support query edit
          variables: workflowVariables ?? [],
          coverStorageKey,
          remixEnabled,
          publishToCommunity: publishToCommunity ?? false,
          resultNodeIds: selectedResults,
        } as any, // TODO: Remove type assertion after running pnpm codegen in packages/openapi-schema
      });

      const shareId = data?.data?.shareId ?? '';

      if (data?.success && shareId) {
        const workflowAppLink = getShareLink('workflowApp', shareId);

        // Copy to clipboard immediately after creation
        const copied = await copyToClipboard(workflowAppLink).catch(() => false);
        if (!copied) {
          message.error('Failed to copy link to clipboard');
        }

        setVisible(false);

        const messageInstance = messageApi.open({
          content: <SuccessMessage shareId={shareId} onClose={() => messageInstance()} />,
          duration: 2000, // Auto close after 3000ms
        });

        // Ensure the message closes after 3000ms
        setTimeout(() => {
          messageInstance();
        }, 2000);

        onPublishSuccess?.();
      } else if (!data?.success) {
        message.error(t('common.operationFailed'));
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error creating workflow app', error);
      message.error(t('common.operationFailed'));
    } finally {
      setConfirmLoading(false);
    }
  };

  const onSubmit = async () => {
    // Prevent concurrent submissions
    if (confirmLoading) {
      return;
    }

    const eventName = isUpdate ? 'update_template' : 'publish_template';

    logEvent(eventName, Date.now(), {
      canvas_id: canvasId,
    });

    try {
      // Make sure the canvas data is synced to the remote
      await forceSyncState({ syncRemote: true });

      // Validate run result selection before publishing
      if (!selectedResults || selectedResults.length === 0) {
        message.error(t('workflowApp.runResultRequired'));
        return;
      }

      const values = await form.validateFields();
      await createWorkflowApp({
        ...values,
        title: values.title,
        description: values.description ?? '',
        remixEnabled: showRemix ? (values.remixEnabled ?? false) : false,
        publishToCommunity: values.publishToCommunity ?? false,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error validating form fields', error);
    }
  };

  // Reset form state when modal opens
  useEffect(() => {
    if (visible) {
      // Reset initial form data and saved flag
      setInitialFormData(null);
      setInitialDataSaved(false);

      // Load existing app data if appId is provided
      if (appId) {
        loadAppData(appId);
      } else {
        // Reset to default values when creating new app
        form.setFieldsValue({
          title,
          description: '',
          remixEnabled: false, // Default to false (remix disabled)
          publishToCommunity: false, // Default to false (not published to community)
        });
        setCoverFileList([]);
        setCoverStorageKey(undefined);
        setAppData(null);
        setSelectedResults([]);
      }

      // Reset preview state
      setPreviewVisible(false);
      setPreviewImage('');
      setPreviewTitle('');

      // Reset copy state
      setLinkCopied(false);
    }
  }, [visible, title, appId, loadAppData, form]);

  // Populate form with loaded app data
  useEffect(() => {
    if (appData && visible) {
      form.setFieldsValue({
        title: appData.title ?? title,
        description: appData.description ?? '',
        remixEnabled: appData.remixEnabled ?? false,
        publishToCommunity: appData.publishToCommunity ?? false,
      });

      // Set cover image if exists
      if (appData.coverUrl) {
        setCoverFileList([
          {
            uid: '1',
            name: 'cover.jpg',
            status: 'done',
            url: appData.coverUrl,
          },
        ]);
        setCoverStorageKey(appData?.coverStorageKey ?? undefined);
      } else {
        setCoverFileList([]);
        setCoverStorageKey(undefined);
      }
    }
  }, [appData, visible, title, form]);

  // Save initial form data after appData and displayNodes are ready (for editing existing app)
  useEffect(() => {
    if (visible && appData && displayNodes.length > 0 && !initialDataSaved) {
      // Get initial selectedResults from appData, filtered by valid node IDs
      const savedNodeIds = appData?.resultNodeIds ?? [];
      const validNodeIds =
        displayNodes.filter((node): node is CanvasNode => !!node?.id)?.map((node) => node.id) ?? [];
      const initialSelectedResults = savedNodeIds.filter((id) => validNodeIds.includes(id));

      setInitialFormData({
        publishToCommunity: appData.publishToCommunity ?? false,
        title: appData.title ?? title,
        description: appData.description ?? '',
        selectedResults: [...initialSelectedResults].sort(),
        coverStorageKey: appData?.coverStorageKey ?? undefined,
      });
      setInitialDataSaved(true);
    }
  }, [visible, appData, displayNodes.length, title, initialDataSaved]);

  // Save initial form data for new apps
  useEffect(() => {
    if (visible && !appId && displayNodes.length > 0 && !initialDataSaved) {
      const formValues = form.getFieldsValue();
      // Calculate initial selectedResults same as auto-select logic
      const validNodeIds =
        displayNodes
          .filter((node): node is CanvasNode => !!node?.id)
          ?.filter((node) => node.type !== 'skillResponse')
          ?.map((node) => node.id) ?? [];

      setInitialFormData({
        publishToCommunity: formValues.publishToCommunity ?? false,
        title: formValues.title ?? title,
        description: formValues.description ?? '',
        selectedResults: [...validNodeIds].sort(),
        coverStorageKey: undefined,
      });
      setInitialDataSaved(true);
    }
  }, [visible, appId, displayNodes.length, form, title, initialDataSaved]);

  // Sync selected results when appData loads and displayNodes is ready (for editing existing app)
  // Use displayNodes.length as dependency instead of displayNodes to avoid infinite loop
  useEffect(() => {
    if (appData && visible && displayNodes.length > 0) {
      const savedNodeIds = appData?.resultNodeIds ?? [];
      const validNodeIds =
        displayNodes.filter((node): node is CanvasNode => !!node?.id)?.map((node) => node.id) ?? [];
      const intersectedNodeIds = savedNodeIds.filter((id) => validNodeIds.includes(id));

      // Only update if different to avoid unnecessary re-renders
      setSelectedResults((prev) => {
        const prevSet = new Set(prev);
        const newSet = new Set(intersectedNodeIds);
        if (prevSet.size === newSet.size && [...prevSet].every((id) => newSet.has(id))) {
          return prev; // No change, return previous reference
        }
        return intersectedNodeIds;
      });
    }
  }, [appData, visible, displayNodes.length]);

  // Auto-select all result nodes when creating a new app or loading existing app
  useEffect(() => {
    if (visible) {
      if (!appId) {
        // When creating new app, select all display nodes
        const validNodeIds =
          displayNodes
            .filter((node): node is CanvasNode => !!node?.id)
            // Exclude skillResponse nodes by default
            ?.filter((node) => node.type !== 'skillResponse')
            ?.map((node) => node.id) ?? [];

        setSelectedResults(validNodeIds);
      }
    }
  }, [visible, appId, displayNodes?.length, appData]);

  // Upload button component
  const uploadButton = (
    <div>
      {coverUploading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>{t('workflowApp.uploadCover')}</div>
    </div>
  );

  // Check if upload is in progress
  const isUploading = useMemo(() => {
    return coverUploading || coverFileList.some((file) => file.status === 'uploading');
  }, [coverUploading, coverFileList]);

  // Determine if this is an update (existing app) or new publish
  const isUpdate = useMemo(() => {
    return !!appId || !!appData;
  }, [appId, appData]);

  // Determine if publishToCommunity switch should be disabled
  // Disable when updating an app that was already published to community
  const isPublishToCommunityDisabled = useMemo(() => {
    return isUpdate && appData?.publishToCommunity === true;
  }, [isUpdate, appData?.publishToCommunity]);

  // Get title and button text based on whether it's an update or new publish
  const modalTitle = useMemo(() => {
    return isUpdate ? t('workflowApp.updatePublish') : t('workflowApp.publish');
  }, [isUpdate, t]);

  const okButtonText = useMemo(() => {
    return isUpdate ? t('workflowApp.updatePublish') : t('workflowApp.publish');
  }, [isUpdate, t]);

  // Calculate current share link
  const currentShareLink = useMemo(() => {
    if (appData?.shareId) {
      return getShareLink('workflowApp', appData.shareId);
    }
    return '';
  }, [appData?.shareId]);

  // Handle copy share link
  const handleCopyShareLink = useCallback(async () => {
    if (!currentShareLink) {
      return;
    }

    try {
      const ok = await copyToClipboard(currentShareLink);
      if (ok) {
        setLinkCopied(true);
        message.success(t('shareContent.linkCopied'));
        // Reset copied state after 2 seconds
        setTimeout(() => {
          setLinkCopied(false);
        }, 2000);
      } else {
        message.error(t('common.operationFailed'));
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy link:', error);
      message.error(t('common.operationFailed'));
    }
  }, [currentShareLink, t]);

  // Check if form data has been modified
  const hasFormDataChanged = useCallback((): boolean => {
    if (!initialFormData) {
      // If no initial data, consider it unchanged (for new apps)
      return false;
    }

    const formValues = form.getFieldsValue();
    const currentTitle = formValues.title ?? '';
    const currentDescription = formValues.description ?? '';
    const currentPublishToCommunity = formValues.publishToCommunity ?? false;

    // Compare title
    if (currentTitle !== initialFormData.title) {
      return true;
    }

    // Compare description
    if (currentDescription !== initialFormData.description) {
      return true;
    }

    // Compare publishToCommunity
    if (currentPublishToCommunity !== initialFormData.publishToCommunity) {
      return true;
    }

    // Compare selectedResults (sorted comparison)
    const currentResultsSorted = [...selectedResults].sort();
    const initialResultsSorted = [...initialFormData.selectedResults].sort();
    if (
      currentResultsSorted.length !== initialResultsSorted.length ||
      !currentResultsSorted.every((id, index) => id === initialResultsSorted[index])
    ) {
      return true;
    }

    // Compare coverStorageKey
    const currentCoverKey = coverStorageKey ?? undefined;
    const initialCoverKey = initialFormData.coverStorageKey ?? undefined;
    if (currentCoverKey !== initialCoverKey) {
      return true;
    }

    return false;
  }, [initialFormData, form, selectedResults, coverStorageKey]);

  // Handle modal close with confirmation
  const handleModalClose = useCallback(() => {
    if (confirmLoading || isUploading) {
      return;
    }

    // Check if form data has been modified
    const hasChanged = hasFormDataChanged();

    // Only show confirmation dialog if data has been modified
    if (hasChanged) {
      Modal.confirm({
        title: t('common.confirmClose'),
        content: t('workflowApp.confirmCloseContent'),
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        okButtonProps: {
          className:
            '!bg-[var(--refly-primary-default)] !border-[var(--refly-primary-default)] !text-white hover:!bg-[var(--refly-primary-hover)] hover:!border-[var(--refly-primary-hover)] active:!bg-[var(--refly-primary-active)] active:!border-[var(--refly-primary-active)]',
        },
        onOk: () => {
          setVisible(false);
        },
      });
    } else {
      // No changes, close directly
      setVisible(false);
    }
  }, [confirmLoading, isUploading, setVisible, t, hasFormDataChanged]);

  // Custom footer with copy button and original buttons
  const modalFooter = useMemo(() => {
    return (
      <div className="flex items-center justify-end w-full">
        <div className="flex items-center gap-2">
          <Button onClick={handleModalClose} disabled={confirmLoading}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" onClick={onSubmit} loading={confirmLoading} disabled={isUploading}>
            {okButtonText}
          </Button>
        </div>
      </div>
    );
  }, [
    currentShareLink,
    handleCopyShareLink,
    linkCopied,
    isUploading,
    confirmLoading,
    okButtonText,
    onSubmit,
    handleModalClose,
    t,
  ]);

  return (
    <>
      {contextHolder}
      <Modal
        centered
        open={visible}
        onCancel={handleModalClose}
        footer={modalFooter}
        title={modalTitle}
        styles={{
          body: {
            maxHeight: '70vh',
            overflowY: 'auto',
            padding: 0,
            paddingInline: 8,
            scrollbarGutter: 'stable both-edges',
          },
        }}
        destroyOnClose={true}
      >
        <div className="w-full pt-4">
          {loadingAppData ? (
            <div className="flex items-center justify-center py-8">
              <Spin size="large" />
            </div>
          ) : (
            <Form form={form}>
              {/* Revenue Sharing Info Card */}
              {/* Publish to Community Switch */}
              <div className="w-full mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M7.55912 1.62549C8.81738 1.46239 9.83842 2.09438 10.2856 3.17257C10.421 3.49907 10.266 3.87363 9.93953 4.00902C9.62322 4.14013 9.26194 3.99881 9.11661 3.69298L9.10328 3.66298L9.0812 3.61215C8.84594 3.09528 8.38206 2.80894 7.72245 2.89486L7.72016 2.89528L4.24871 3.33548L4.2485 3.33528C3.79774 3.39344 3.49984 3.58977 3.32038 3.84007C3.14817 4.08025 3.04912 4.42147 3.08788 4.8509L3.09746 4.93798L3.09767 4.93944L3.92308 11.4048L3.93621 11.4923C4.0089 11.9217 4.19158 12.2271 4.41788 12.415C4.65329 12.6106 4.98944 12.7244 5.44079 12.6669L6.76641 12.4919C7.11682 12.4457 7.43828 12.6923 7.48453 13.0428C7.53079 13.3932 7.28432 13.7148 6.93391 13.7611L5.60829 13.9359L5.606 13.9363C4.84118 14.0345 4.1384 13.8471 3.59975 13.3996C3.06669 12.9568 2.74903 12.3053 2.65371 11.5692L2.6535 11.5682L1.82788 5.10152L1.82809 5.10131C1.73291 4.36702 1.87656 3.65716 2.28017 3.09423C2.68819 2.52518 3.32098 2.16403 4.08683 2.0657L4.08767 2.06549L7.55912 1.62549Z"
                        fill="var(--refly-text-1)"
                      />
                      <path
                        d="M6.95485 3.26692C7.46902 2.84004 8.13883 2.66074 8.86339 2.7538L8.86318 2.75401L12.1178 3.17109C12.8435 3.26404 13.4466 3.60615 13.8363 4.14942C14.2219 4.68699 14.3581 5.36425 14.2684 6.06358L13.4919 12.119C13.4023 12.8184 13.1 13.4395 12.5913 13.8625C12.0771 14.2901 11.4071 14.4689 10.6813 14.3761L7.42631 13.9581C6.70078 13.8652 6.09776 13.5231 5.70819 12.9798C5.32276 12.4423 5.18692 11.7652 5.27652 11.0659L6.05236 5.01025L6.07173 4.88005C6.18094 4.23344 6.47773 3.66307 6.95485 3.26692ZM8.70027 4.02338C8.29043 3.97074 7.98566 4.07482 7.77256 4.25171C7.5542 4.43301 7.37789 4.73686 7.32194 5.17317L6.54611 11.2286C6.49005 11.6661 6.58361 12.0042 6.7484 12.234C6.90906 12.4581 7.17708 12.6358 7.58902 12.6886L10.8436 13.1063C11.256 13.159 11.5606 13.0547 11.7728 12.8784C11.9903 12.6974 12.1663 12.3938 12.2223 11.9563L12.9988 5.90067C13.0548 5.46364 12.9613 5.12549 12.7963 4.89546C12.6354 4.67117 12.3671 4.49344 11.9553 4.44067L8.70027 4.02338ZM9.81297 10.3852C9.60536 10.4518 9.37814 10.408 9.21006 10.2692L9.61776 9.77566L9.81297 10.3852ZM9.21443 6.04046C9.59681 5.99569 9.97786 6.08668 10.2955 6.28942C10.6318 6.22751 10.982 6.27004 11.2965 6.41671L11.3848 6.46129L11.3886 6.46338C12.3301 6.98096 12.3899 8.0898 11.9878 8.82358L11.9876 8.82337C11.6706 9.40579 11.0772 9.79396 10.6565 10.019C10.4324 10.1389 10.2256 10.2288 10.0748 10.289C9.99905 10.3193 9.93631 10.3424 9.89131 10.3584C9.86878 10.3664 9.85058 10.3727 9.83735 10.3771C9.83075 10.3793 9.82539 10.3812 9.82131 10.3825C9.81926 10.3832 9.81749 10.3837 9.8161 10.3842L9.81297 10.3852L9.61776 9.77566L9.20985 10.269L9.20943 10.2688C9.20926 10.2686 9.20921 10.2683 9.20902 10.2682C9.20858 10.2678 9.20791 10.2674 9.20735 10.2669C9.20623 10.266 9.20479 10.2649 9.20318 10.2636C9.19988 10.2608 9.19557 10.2571 9.19027 10.2525C9.17966 10.2435 9.16519 10.231 9.14735 10.2152C9.11168 10.1838 9.06237 10.1392 9.0036 10.0832C8.88663 9.97164 8.72903 9.81162 8.56631 9.61712C8.25927 9.25011 7.85576 8.66918 7.7761 8.00712L7.77589 8.00608C7.67765 7.17726 8.14459 6.16892 9.21256 6.04067L9.21443 6.04046ZM9.42151 9.16649L9.4211 9.1667C9.4211 9.1667 9.42146 9.16665 9.42193 9.16649H9.42151ZM9.36422 7.3115C9.25943 7.32433 9.18451 7.37501 9.12839 7.46087C9.06603 7.5563 9.02855 7.69864 9.04714 7.85546C9.08123 8.13525 9.28064 8.47633 9.54797 8.79587C9.62169 8.88398 9.69501 8.96332 9.76131 9.0317C9.84993 8.99235 9.94957 8.94544 10.0528 8.89024C10.4243 8.69152 10.7341 8.45032 10.864 8.21087L10.8653 8.20837L10.8909 8.1565C10.9448 8.03456 10.9564 7.91078 10.9369 7.81296C10.9169 7.71269 10.8662 7.63767 10.774 7.58629C10.6678 7.52948 10.5409 7.52658 10.4328 7.57837C10.1776 7.70055 9.87246 7.64075 9.68235 7.43129C9.60182 7.34256 9.48342 7.29784 9.36422 7.3115Z"
                        fill="var(--refly-text-1)"
                      />
                    </svg>

                    <span className="text-sm text-refly-text-0 leading-[1.43]">
                      {t('workflowApp.publishToCommunity.label')}
                    </span>
                    <Tooltip title={t('workflowApp.publishToCommunity.help')} arrow={false}>
                      <Question
                        size={14}
                        color="var(--refly-question-icon-color, #888D92)"
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    </Tooltip>
                  </div>
                  <Form.Item name="publishToCommunity" valuePropName="checked" className="mb-0">
                    <Switch size="small" disabled={isPublishToCommunityDisabled} />
                  </Form.Item>
                </div>
              </div>

              <div className="w-full mb-4">
                <div
                  className="rounded-lg p-3.5 border border-orange-200/30 bg-cover bg-center bg-no-repeat"
                  style={{
                    backgroundImage: `url(${BannerSvg})`,
                  }}
                >
                  <div className="flex flex-col gap-2.5">
                    {/* Main Title */}
                    <div className="text-sm font-semibold text-black leading-[1.43]">
                      {t('workflowApp.revenueSharing.title')}
                    </div>

                    {/* Bottom Row */}
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-black/50 leading-[1.67]">
                        <Trans
                          i18nKey="workflowApp.revenueSharing.earningsHint"
                          values={{ creditEarningsPerRun }}
                          components={{
                            num: (
                              <span className="mx-1 text-base font-extrabold text-black leading-none" />
                            ),
                          }}
                        />
                      </div>
                      <div
                        className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() =>
                          window.open(
                            'https://reflydoc.notion.site/Template-Revenue-Sharing-Program-2a0d62ce60718011b2bef9bc8a9ac1f0',
                            '_blank',
                          )
                        }
                      >
                        <span className="text-xs text-black/30 leading-[1.82]">
                          {t('workflowApp.revenueSharing.howToEarn')}
                        </span>
                        <ArrowRight size={12} color="rgba(0, 0, 0, 0.3)" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {/* Template Content */}
                {/* Title Field */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="title-input"
                    className="text-xs font-semibold text-refly-text-0 leading-[1.33]"
                  >
                    {t('workflowApp.title')}
                    <span className="text-refly-func-danger-default ml-1">*</span>
                  </label>
                  <Form.Item
                    name="title"
                    rules={[{ required: true, message: t('common.required') }]}
                    className="mb-0"
                  >
                    <Input
                      id="title-input"
                      placeholder={t('workflowApp.titlePlaceholder')}
                      className="h-8 rounded-lg border-0 bg-refly-bg-control-z0 px-3 text-sm font-normal text-refly-text-0 placeholder:text-refly-text-3 hover:bg-refly-bg-control-z0 focus:bg-refly-bg-control-z0 focus:shadow-sm"
                    />
                  </Form.Item>
                </div>
                {/* Description Field */}
                <div className="flex flex-col gap-2 mt-5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="description-input"
                      className="text-xs font-semibold text-refly-text-0 leading-[1.33]"
                    >
                      {t('workflowApp.description')}
                    </label>
                  </div>
                  <Form.Item name="description" className="mb-0">
                    <Input.TextArea
                      id="description-input"
                      placeholder={t('workflowApp.descriptionPlaceholder')}
                      className="min-h-[80px] rounded-lg border-0 bg-refly-bg-control-z0 px-3 py-2 text-sm font-normal text-refly-text-0 placeholder:text-refly-text-3 hover:bg-refly-bg-control-z0 focus:bg-refly-bg-control-z0 focus:shadow-sm"
                      autoSize={{ minRows: 3, maxRows: 6 }}
                    />
                  </Form.Item>
                </div>
                {/* Run Result */}
                <div className="flex flex-col gap-2 mt-5">
                  <div className="flex items-center justify-between h-4">
                    <div className={'text-xs font-semibold leading-[1.33]'}>
                      {t('workflowApp.runResult')}
                    </div>
                    <MultiSelectResult
                      selectedResults={selectedResults}
                      onSelectionChange={setSelectedResults}
                      options={displayNodes}
                    />
                  </div>

                  <div
                    className="w-full rounded-lg border border-solid p-3 bg-[#FBFBFB] dark:bg-[var(--refly-bg-main-z1)]"
                    style={{
                      borderColor: 'var(--refly-Card-Border)',
                    }}
                  >
                    <SelectedResultsGrid
                      selectedResults={selectedResults}
                      options={displayNodes as unknown as CanvasNode[]}
                    />
                  </div>
                </div>
                {/* Remix Settings */}
                {showRemix && (
                  <div className="flex flex-col gap-2 mt-5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="remix-enabled-switch"
                        className="text-xs font-semibold text-refly-text-0 leading-[1.33]"
                      >
                        {t('workflowApp.enableRemix')}
                      </label>
                      <Form.Item name="remixEnabled" valuePropName="checked" className="mb-0">
                        <Switch id="remix-enabled-switch" size="small" className="" />
                      </Form.Item>
                    </div>
                    <div className="text-xs text-refly-text-2">{t('workflowApp.remixHint')}</div>
                  </div>
                )}

                {/* Cover Image Upload */}
                <div className="flex flex-col gap-2 mt-5">
                  <div className="text-xs font-semibold text-refly-text-0 leading-[1.33]">
                    {t('workflowApp.coverImage')}
                  </div>
                  <div className="w-full">
                    <Upload
                      customRequest={customUploadRequest}
                      listType="picture-card"
                      fileList={coverFileList}
                      onChange={handleCoverUploadChange}
                      beforeUpload={beforeUpload}
                      onPreview={handlePreview}
                      accept={ALLOWED_IMAGE_TYPES.join(',')}
                      maxCount={1}
                      showUploadList={{
                        showPreviewIcon: true,
                        showRemoveIcon: true,
                        showDownloadIcon: false,
                      }}
                      className="cover-upload"
                      style={
                        {
                          // Custom styles for cover upload
                          '--upload-card-width': '100px',
                          '--upload-card-height': '100px',
                        } as React.CSSProperties
                      }
                    >
                      {coverFileList.length >= 1 ? null : uploadButton}
                    </Upload>
                    <div className="text-xs text-refly-text-2 mt-1">
                      {t('workflowApp.coverImageHint')}
                    </div>
                  </div>
                </div>
              </div>
            </Form>
          )}
        </div>

        {/* Preview Modal */}
        <Modal
          open={previewVisible}
          title={previewTitle}
          footer={null}
          onCancel={handlePreviewCancel}
          centered
          width="auto"
          style={{ maxWidth: '90vw' }}
        >
          <Image
            alt="Cover Preview"
            style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
            src={previewImage}
            preview={false}
          />
        </Modal>
      </Modal>
    </>
  );
};
