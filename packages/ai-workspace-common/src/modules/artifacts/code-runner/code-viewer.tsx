import { Code, Treemenu, Copy, Reload } from 'refly-icons';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import type { ReactNode } from 'react';
import { Button, Tooltip, Divider, message, Select, Segmented } from 'antd';
import Renderer from './render';
import MonacoEditor from './monaco-editor';
import { useTranslation } from 'react-i18next';
import { CodeArtifactType } from '@refly/openapi-schema';
import { getArtifactTypeOptions, getSimpleTypeDescription } from '@refly/utils';

export default memo(
  function CodeViewer({
    code,
    language,
    title,
    entityId: _entityId,
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
    showActions = true,
    purePreview = false,
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
    showActions?: boolean;
    purePreview?: boolean;
  }) {
    const { t } = useTranslation();
    const [refresh, setRefresh] = useState(0);
    // Track editor content for controlled updates
    const [editorContent, setEditorContent] = useState(code);
    // Removed layout mode. Always render single-view with tab switching

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

    // Download and Share actions are moved to CodeArtifactTopButtons

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

    // Memoize the segmented tabs for switching between preview and code
    const segmentedOptions: { label: ReactNode; value: 'preview' | 'code' }[] = useMemo(
      () => [
        {
          label: (
            <Tooltip title={t('codeArtifact.tabs.preview')}>
              <div className="flex items-center justify-center h-4">
                <Treemenu size={16} color="var(--refly-text-0)" />
              </div>
            </Tooltip>
          ),
          value: 'preview',
        },
        {
          label: (
            <Tooltip title={t('codeArtifact.tabs.code')}>
              <div className="flex items-center justify-center h-4">
                <Code size={16} color="var(--refly-text-0)" />
              </div>
            </Tooltip>
          ),
          value: 'code',
        },
      ],
      [],
    );

    const handleSegmentChange = useCallback(
      (value: string | number) => {
        onTabChange?.(value as 'code' | 'preview');
      },
      [onTabChange],
    );

    return (
      <div className="flex flex-col h-full border border-gray-200">
        {/* Top header with main tab navigation */}
        {!purePreview && (
          <div className="flex items-center justify-between h-12 py-2 px-3 border-x-0 border-t-0 border-b-[1px] border-solid border-refly-Card-Border">
            <div className="flex items-center gap-3">
              <Segmented
                shape="round"
                size="small"
                value={activeTab}
                onChange={handleSegmentChange}
                options={segmentedOptions}
              />
              <Divider type="vertical" className="h-4 bg-refly-Card-Border m-0" />
              {onTypeChange ? (
                <Select
                  value={type}
                  onChange={onTypeChange}
                  options={getArtifactTypeOptions()}
                  size="small"
                  className="max-w-32"
                  popupMatchSelectWidth={false}
                  bordered={false}
                />
              ) : (
                <span className="text-sm text-refly-text-0">{getSimpleTypeDescription(type)}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Tooltip title={t('codeArtifact.buttons.copy')}>
                <Button
                  type="text"
                  icon={<Copy size={16} color="var(--refly-text-0)" />}
                  onClick={handleCopyCode}
                  size="small"
                />
              </Tooltip>

              <Tooltip title={t('codeArtifact.buttons.refresh')}>
                <Button
                  type="text"
                  icon={<Reload size={16} color="var(--refly-text-0)" />}
                  onClick={handleRefresh}
                  disabled={isGenerating}
                  size="small"
                />
              </Tooltip>
            </div>
          </div>
        )}

        {/* Content area */}
        <div
          className={`flex flex-grow overflow-auto flex-col rounded-md ${!purePreview ? 'm-4' : ''}`}
        >
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
                    showActions={showActions}
                    purePreview={purePreview}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Optimize re-renders by comparing only necessary props
    // Note: onTabChange is intentionally not compared to ensure state updates propagate
    return (
      prevProps.code === nextProps.code &&
      prevProps.language === nextProps.language &&
      prevProps.title === nextProps.title &&
      prevProps.isGenerating === nextProps.isGenerating &&
      prevProps.activeTab === nextProps.activeTab &&
      prevProps.readOnly === nextProps.readOnly &&
      prevProps.canvasReadOnly === nextProps.canvasReadOnly &&
      prevProps.type === nextProps.type &&
      prevProps.showActions === nextProps.showActions &&
      prevProps.purePreview === nextProps.purePreview
    );
  },
);
