import { FiRefreshCw, FiDownload, FiCopy, FiCode, FiEye, FiShare2 } from 'react-icons/fi';
import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import React from 'react';
import { Button, Tooltip, Divider, message, Select } from 'antd';
import Renderer from './render';
import MonacoEditor from './render/MonacoEditor';
import { useTranslation } from 'react-i18next';
import { CodeArtifactType } from '@refly/openapi-schema';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';

// Map of type keys to their full MIME types and display names
const typeMapping: Record<string, { mime: CodeArtifactType; display: string }> = {
  react: { mime: 'application/refly.artifacts.react', display: 'React' },
  svg: { mime: 'image/svg+xml', display: 'SVG' },
  mermaid: { mime: 'application/refly.artifacts.mermaid', display: 'Mermaid' },
  markdown: { mime: 'text/markdown', display: 'Markdown' },
  code: { mime: 'application/refly.artifacts.code', display: 'Code' },
  html: { mime: 'text/html', display: 'HTML' },
};

// Function to get simple type description with fuzzy matching
export const getSimpleTypeDescription = (type: CodeArtifactType): string => {
  // Check for exact match first
  for (const [, value] of Object.entries(typeMapping)) {
    if (value.mime === type) {
      return value.display;
    }
  }

  // If no exact match, try fuzzy matching
  const typeStr = type.toLowerCase();
  for (const [key, value] of Object.entries(typeMapping)) {
    if (typeStr.includes(key.toLowerCase())) {
      return value.display;
    }
  }

  // Default fallback
  return type;
};

// Function to get all available artifact types with labels
const getArtifactTypeOptions = () => {
  // Use entries to get a unique array of options
  return Object.entries(typeMapping).map(([key, { mime, display }]) => ({
    value: mime,
    label: display,
    // Add a unique key to prevent React warnings about duplicate keys
    key: key,
  }));
};

// Function to get file extension based on artifact type with fuzzy matching
const getFileExtensionFromType = (type: CodeArtifactType): string => {
  const extensionMap: Record<string, string> = {
    react: 'tsx',
    svg: 'svg',
    mermaid: 'mmd',
    markdown: 'md',
    md: 'md',
    code: '', // Will be determined by language
    html: 'html',
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    css: 'css',
    java: 'java',
  };

  // Try exact match first
  for (const [key, value] of Object.entries(typeMapping)) {
    if (value.mime === type) {
      return extensionMap[key] ?? '';
    }
  }

  // If no exact match, try fuzzy matching
  const typeStr = type.toLowerCase();
  for (const [key, extension] of Object.entries(extensionMap)) {
    if (typeStr.includes(key.toLowerCase())) {
      return extension;
    }
  }

  // Default fallback
  return '';
};

// Helper function to detect type from content (for external use)
export const detectTypeFromContent = (content: string): CodeArtifactType => {
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes('react')) {
    return typeMapping.react.mime;
  }

  if (lowerContent.includes('svg')) {
    return typeMapping.svg.mime;
  }

  if (
    lowerContent.includes('mermaid') ||
    lowerContent.includes('graph ') ||
    lowerContent.includes('flowchart ')
  ) {
    return typeMapping.mermaid.mime;
  }

  if (lowerContent.includes('markdown')) {
    return typeMapping.markdown.mime;
  }

  if (lowerContent.includes('html')) {
    return typeMapping.html.mime;
  }

  // Default to code if no specific type detected
  return typeMapping.code.mime;
};

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
    const prevEditorContentRef = useRef(code);
    // Track the current type locally
    const [currentType, setCurrentType] = useState<CodeArtifactType>(type);

    // Update current type when prop changes
    useEffect(() => {
      if (type !== currentType) {
        setCurrentType(type);
      }
    }, [type]);

    // Update editor content when code prop changes - only when actually different
    useEffect(() => {
      if (code !== prevEditorContentRef.current) {
        setEditorContent(code);
        prevEditorContentRef.current = code;
      }
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

    // Handle content changes from editor with optimization to prevent unnecessary updates
    const handleEditorChange = useCallback(
      (value: string | undefined) => {
        if (value !== undefined) {
          // Always update content for user edits
          setEditorContent(value);
          prevEditorContentRef.current = value;
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

    // Memoize the render tabs
    const renderTabs = useMemo(
      () => (
        <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
          <Button
            type={activeTab === 'preview' ? 'primary' : 'text'}
            icon={<FiEye className="size-4 mr-1" />}
            onClick={(e) => {
              e.stopPropagation();
              onTabChange?.('preview');
            }}
            className={`${activeTab === 'preview' ? 'bg-green-600' : 'text-gray-600'}`}
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
            className={`${activeTab === 'code' ? 'bg-green-600' : 'text-gray-600'}`}
            size="small"
          >
            {t('codeArtifact.tabs.code')}
          </Button>
        </div>
      ),
      [activeTab, onTabChange, t],
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
              className="text-gray-600 hover:text-blue-600"
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
              className="text-gray-600 hover:text-blue-600"
            />
          </Tooltip>
        </div>
      ),
      [handleCopyCode, handleDownload, title, type, t],
    );

    return (
      <div
        className="flex flex-col h-full border border-gray-200 bg-white"
        style={{ height: '100%' }}
      >
        {/* Top header with main tab navigation */}
        <div className="flex items-center justify-between h-12 border-b border-gray-200 bg-white py-2">
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
                  className="text-gray-600 hover:text-blue-600"
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
                className="text-gray-600 hover:text-blue-600"
              />
            </Tooltip>
          </div>
        </div>

        <Divider className="my-0" style={{ margin: 0, height: '1px' }} />

        {/* Breadcrumb and action buttons */}
        <div className="flex justify-between items-center py-2 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-2">
            {onTypeChange ? (
              <div>
                <Select
                  value={currentType}
                  onChange={(newType) => {
                    try {
                      // Update local state first for immediate feedback
                      setCurrentType(newType as CodeArtifactType);
                      // Call the onTypeChange handler with the current content
                      onTypeChange(newType as CodeArtifactType);
                    } catch (error) {
                      console.error('Error changing type:', error);
                      // Revert to previous type if there was an error
                      setCurrentType(type);
                    }
                  }}
                  options={getArtifactTypeOptions()}
                  size="small"
                  className="w-40"
                  dropdownMatchSelectWidth={false}
                  disabled={readOnly || isGenerating || canvasReadOnly}
                  placeholder={t('codeArtifact.selectType', 'Select type')}
                />
              </div>
            ) : (
              <span className="text-sm text-gray-500">{getSimpleTypeDescription(currentType)}</span>
            )}
          </div>

          {actionButtons}
        </div>

        {/* Content area - use React.memo for each view to prevent unnecessary re-renders */}
        <div className="flex flex-grow flex-col overflow-auto rounded-md">
          {useMemo(() => {
            if (activeTab === 'code') {
              return (
                <MonacoEditor
                  content={editorContent}
                  language={language}
                  type={currentType}
                  readOnly={readOnly || isGenerating || canvasReadOnly}
                  isGenerating={isGenerating}
                  canvasReadOnly={canvasReadOnly}
                  onChange={handleEditorChange}
                />
              );
            }

            return (
              <div className="h-full flex items-center justify-center">
                {language && (
                  <div className="w-full h-full">
                    <Renderer
                      content={editorContent}
                      type={currentType}
                      key={refresh}
                      title={title}
                      language={language}
                      onRequestFix={onRequestFix}
                    />
                  </div>
                )}
              </div>
            );
          }, [
            activeTab,
            editorContent,
            language,
            currentType,
            readOnly,
            isGenerating,
            canvasReadOnly,
            handleEditorChange,
            refresh,
            title,
            onRequestFix,
          ])}
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
