import { FiRefreshCw, FiDownload, FiCopy, FiCode, FiEye, FiShare2 } from 'react-icons/fi';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Button, Tooltip, Divider, message, Select } from 'antd';
import Renderer from './render';
import MonacoEditor from './monaco-editor';
import { useTranslation } from 'react-i18next';
import { CodeArtifactType } from '@refly/openapi-schema';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import {
  getFileExtensionFromType,
  getArtifactTypeOptions,
  getSimpleTypeDescription,
} from '@refly/utils';
import { GoColumns } from 'react-icons/go';

export default memo(
  function CodeViewer({
    code,
    language,
    title,
    entityId,
    isGenerating,
    activeTab,
    onTabChange,
    onClose: _onClose,
    onRequestFix,
    onChange,
    readOnly = false,
    canvasReadOnly = false,
    type = 'text/html',
    onTypeChange,
  }: {
    code: string;
    language: string;
    title: string;
    entityId: string;
    isGenerating: boolean;
    activeTab: string;
    onTabChange: (v: 'code' | 'preview') => void;
    onClose: () => void;
    onRequestFix: (e: string) => void;
    onChange?: (code: string) => void;
    readOnly?: boolean;
    canvasReadOnly?: boolean;
    type?: CodeArtifactType;
    onTypeChange?: (type: CodeArtifactType) => void;
  }) {
    const { t } = useTranslation();
    const [refresh, setRefresh] = useState(0);
    // Track editor content for controlled updates
    const [editorContent, setEditorContent] = useState(code);
    // Layout mode: 'tabs' (default) or 'split'
    const [layoutMode, setLayoutMode] = useState<'tabs' | 'split'>('tabs');

    // Update editor content when code prop changes
    useEffect(() => {
      setEditorContent(code);
    }, [code]);

    const handleCopyCode = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        navigator.clipboard
          .writeText(editorContent)
          .then(() => {
            message.success(t('codeArtifact.copySuccess'));
          })
          .catch((error) => {
            console.error('Failed to copy code:', error);
            message.error(t('codeArtifact.copyError'));
          });
      },
      [editorContent, t],
    );

    const handleDownload = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        const fileExtension = getFileExtensionFromType(type);
        const fileName = `${title}.${fileExtension}`;
        try {
          const blob = new Blob([editorContent], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          message.success(t('codeArtifact.downloadSuccess', { fileName }));
        } catch (error) {
          console.error('Failed to download file:', error);
          message.error(t('codeArtifact.downloadError'));
        }
      },
      [type, editorContent, title, t],
    );

    // Handle content changes from editor
    const handleEditorChange = useCallback(
      (value: string | undefined) => {
        if (value !== undefined) {
          setEditorContent(value);
          onChange?.(value);
        }
      },
      [onChange],
    );

    const handleRefresh = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        setRefresh((r) => r + 1);
        message.info(t('codeArtifact.refreshing'));
      },
      [t],
    );

    const getFileExtensionForLanguage = useMemo(
      () =>
        (lang: string): string => {
          // First check if we have a type-specific extension
          const typeExtension = getFileExtensionFromType(type);
          if (typeExtension) {
            return typeExtension;
          }

          // Fall back to language-based extension
          const extensionMap: Record<string, string> = {
            javascript: 'js',
            typescript: 'ts',
            python: 'py',
            html: 'html',
            css: 'css',
            java: 'java',
            csharp: 'cs',
            php: 'php',
            go: 'go',
            ruby: 'rb',
            rust: 'rs',
            jsx: 'jsx',
            tsx: 'tsx',
            markdown: 'md',
            xml: 'xml',
          };

          return extensionMap[lang.toLowerCase()] || 'txt';
        },
      [type],
    );

    const handleShare = useCallback(
      async (event: React.MouseEvent) => {
        event.stopPropagation();
        const loadingMessage = message.loading(t('codeArtifact.sharing'), 0);

        try {
          // Create the share
          const { data, error } = await getClient().createShare({
            body: {
              entityId,
              entityType: 'codeArtifact',
            },
          });

          if (!data?.success || error) {
            throw new Error(typeof error === 'string' ? error : 'Failed to create share');
          }

          // Generate and copy the share link
          const shareId = data.data?.shareId ?? '';
          const shareLink = getShareLink('codeArtifact', shareId);

          // Copy the sharing link to clipboard
          copyToClipboard(shareLink);

          // Clear loading message and show success
          loadingMessage();
          message.success(t('codeArtifact.shareSuccess'));
        } catch (error) {
          // Handle any errors that occurred during the process
          loadingMessage();
          console.error('Failed to share code:', error);
          message.error(t('codeArtifact.shareError'));
        }
      },
      [editorContent, type, title, language, t, entityId],
    );

    // Toggle layout mode between tabs and split
    const toggleLayoutMode = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        setLayoutMode((current) => (current === 'tabs' ? 'split' : 'tabs'));
        message.info(
          t(
            layoutMode === 'tabs'
              ? 'codeArtifact.layoutChanged.split'
              : 'codeArtifact.layoutChanged.tabs',
          ),
        );
      },
      [layoutMode, t],
    );

    // Memoize the render tabs
    const renderTabs = useMemo(
      () => (
        <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
          {layoutMode === 'tabs' && (
            <>
              <Button
                type={activeTab === 'preview' ? 'primary' : 'text'}
                icon={<FiEye className="size-4 mr-1" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabChange?.('preview');
                }}
                className={`${activeTab === 'preview' ? 'bg-green-600 dark:bg-green-500' : 'text-gray-600 dark:text-gray-300'}`}
                size="small"
              >
                {t('codeArtifact.tabs.preview')}
              </Button>

              <Button
                type={activeTab === 'code' ? 'primary' : 'text'}
                icon={<FiCode className="size-4 mr-1" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabChange?.('code');
                }}
                className={`${activeTab === 'code' ? 'bg-green-600 dark:bg-green-500' : 'text-gray-600 dark:text-gray-300'}`}
                size="small"
              >
                {t('codeArtifact.tabs.code')}
              </Button>
            </>
          )}

          <Tooltip
            title={
              layoutMode === 'tabs' ? t('codeArtifact.layout.split') : t('codeArtifact.layout.tabs')
            }
          >
            <Button
              type="text"
              icon={
                <GoColumns
                  className={`size-4 ${
                    layoutMode === 'split'
                      ? 'text-green-600 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                />
              }
              onClick={toggleLayoutMode}
              size="small"
              className="hover:text-blue-600"
            />
          </Tooltip>
        </div>
      ),
      [activeTab, onTabChange, t, layoutMode, toggleLayoutMode],
    );

    // Memoize action buttons
    const actionButtons = useMemo(
      () => (
        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
          <Tooltip title={t('codeArtifact.buttons.copy')}>
            <Button
              type="text"
              icon={<FiCopy className="size-4" />}
              onClick={handleCopyCode}
              size="small"
              className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-300"
            />
          </Tooltip>

          <Tooltip
            title={t('codeArtifact.buttons.download', {
              fileName: `${title}.${getFileExtensionForLanguage(language)}`,
            })}
          >
            <Button
              type="text"
              icon={<FiDownload className="size-4" />}
              onClick={handleDownload}
              size="small"
              className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-300"
            />
          </Tooltip>
        </div>
      ),
      [handleCopyCode, handleDownload, title, getFileExtensionForLanguage, language, t],
    );

    return (
      <div className="flex flex-col h-full border border-gray-200">
        {/* Top header with main tab navigation */}
        <div className="flex items-center justify-between h-12 border-b border-gray-200 py-2 dark:bg-gray-900 dark:border-gray-700">
          {renderTabs}

          <div className="flex items-center space-x-2">
            {!canvasReadOnly && (
              <Tooltip title={t('codeArtifact.buttons.share')}>
                <Button
                  type="text"
                  disabled={canvasReadOnly}
                  icon={<FiShare2 className="size-4 text-green-600" />}
                  onClick={handleShare}
                  size="small"
                  className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-300"
                />
              </Tooltip>
            )}

            <Tooltip title={t('codeArtifact.buttons.refresh')}>
              <Button
                type="text"
                icon={<FiRefreshCw className="size-4" />}
                onClick={handleRefresh}
                disabled={isGenerating}
                size="small"
                className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-300"
              />
            </Tooltip>
          </div>
        </div>

        <Divider className="my-0" style={{ margin: 0, height: '1px' }} />

        {/* Breadcrumb and action buttons */}
        <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            {onTypeChange ? (
              <Select
                value={type}
                onChange={onTypeChange}
                options={getArtifactTypeOptions()}
                size="small"
                className="w-32"
                popupMatchSelectWidth={false}
              />
            ) : (
              <span className="text-sm text-gray-500">{getSimpleTypeDescription(type)}</span>
            )}
          </div>

          {actionButtons}
        </div>

        {/* Content area */}
        <div
          className={`flex flex-grow overflow-auto ${layoutMode === 'split' ? 'flex-row' : 'flex-col'} rounded-md`}
        >
          {layoutMode === 'tabs' ? (
            <>
              {/* Tabs layout */}
              {activeTab === 'code' ? (
                <MonacoEditor
                  content={editorContent}
                  language={language}
                  type={type as CodeArtifactType}
                  readOnly={readOnly || isGenerating || canvasReadOnly}
                  isGenerating={isGenerating}
                  canvasReadOnly={canvasReadOnly}
                  onChange={handleEditorChange}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  {language && (
                    <div className="w-full h-full">
                      <Renderer
                        content={editorContent}
                        type={type}
                        key={refresh}
                        title={title}
                        language={language}
                        onRequestFix={onRequestFix}
                        onChange={
                          type === 'application/refly.artifacts.mindmap'
                            ? (newContent, _type) => handleEditorChange(newContent)
                            : undefined
                        }
                        readonly={readOnly || canvasReadOnly}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Split layout */}
              <div className="w-1/2 h-full border-r border-gray-200">
                <MonacoEditor
                  content={editorContent}
                  language={language}
                  type={type as CodeArtifactType}
                  readOnly={readOnly || isGenerating || canvasReadOnly}
                  isGenerating={isGenerating}
                  canvasReadOnly={canvasReadOnly}
                  onChange={handleEditorChange}
                />
              </div>
              <div className="w-1/2 h-full overflow-auto">
                {language && (
                  <div className="w-full h-full">
                    <Renderer
                      content={editorContent}
                      type={type}
                      key={refresh}
                      title={title}
                      language={language}
                      onRequestFix={onRequestFix}
                      onChange={
                        type === 'application/refly.artifacts.mindmap'
                          ? (newContent, _type) => handleEditorChange(newContent)
                          : undefined
                      }
                      readonly={readOnly || canvasReadOnly}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Optimize re-renders by comparing only necessary props
    return (
      prevProps.code === nextProps.code &&
      prevProps.language === nextProps.language &&
      prevProps.title === nextProps.title &&
      prevProps.isGenerating === nextProps.isGenerating &&
      prevProps.activeTab === nextProps.activeTab &&
      prevProps.readOnly === nextProps.readOnly &&
      prevProps.type === nextProps.type
    );
  },
);
