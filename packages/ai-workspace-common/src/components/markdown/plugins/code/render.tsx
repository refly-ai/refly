import { useCallback, useMemo, useState } from 'react';
import { message, Space } from 'antd';
import { Button, Tooltip } from 'antd';
import copyToClipboard from 'copy-to-clipboard';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { CodeArtifactType } from '@refly/openapi-schema';
import { CopyOutlined, CodeOutlined, EyeOutlined } from '@ant-design/icons';
import { cn } from '@refly/utils';
import MermaidComponent from '../mermaid/render';
import Renderer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/render';
import { IconCodeArtifact } from '@refly-packages/ai-workspace-common/components/common/icon';
import { MarkdownMode } from '../../types';
import { useCreateCodeArtifact } from '@refly-packages/ai-workspace-common/hooks/use-create-code-artifact';

// Language mapping for Monaco editor
const mapToMonacoLanguage = (lang: string): string => {
  const monacoLangMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    md: 'markdown',
    mermaid: 'markdown',
    sh: 'shell',
    bash: 'shell',
    plaintext: 'plaintext',
    txt: 'plaintext',
    svg: 'xml',
  };

  return monacoLangMap[lang?.toLowerCase()] || lang || 'plaintext';
};

interface PreCodeProps {
  children: any;
  id?: string; // resultId for connecting to skill response node
  'data-code-content'?: string;
  'data-code-type'?: CodeArtifactType;
  'data-language'?: string;
  'data-should-preview'?: boolean;
  'data-is-mermaid'?: boolean;
  mode?: MarkdownMode;
}

const PreCode = React.memo(
  ({
    children,
    id,
    'data-code-content': dataCodeContent,
    'data-code-type': dataCodeType,
    'data-language': dataLanguage,
    'data-should-preview': dataShouldPreview,
    'data-is-mermaid': dataIsMermaid,
    mode = 'interactive',
  }: PreCodeProps) => {
    const { t } = useTranslation();

    const isInteractive = mode === 'interactive';

    // Get code content from props (injected by rehypePlugin)
    const codeContent = useMemo(() => dataCodeContent || '', [dataCodeContent]);

    // Get code type from props (injected by rehypePlugin)
    const codeType = useMemo(
      () => dataCodeType || 'application/refly.artifacts.code',
      [dataCodeType],
    );

    // Get language from props (injected by rehypePlugin)
    const language = useMemo(() => {
      if (dataLanguage) return mapToMonacoLanguage(dataLanguage);
      return 'plaintext';
    }, [dataLanguage]);

    // Is the code content a mermaid diagram?
    const isMermaid = useMemo(() => Boolean(dataIsMermaid), [dataIsMermaid]);

    // Initialize the view mode based on the shouldPreview flag
    const [viewMode, setViewMode] = useState<'code' | 'preview'>(
      dataShouldPreview ? 'preview' : 'code',
    );

    // Check if this is a previewable type
    const isPreviewable = useMemo(
      () =>
        dataCodeType &&
        [
          'image/svg+xml',
          'application/refly.artifacts.mermaid',
          'text/markdown',
          'text/html',
        ].includes(dataCodeType),
      [dataCodeType],
    );

    // Handle copy button click
    const handleCopy = useCallback(() => {
      copyToClipboard(codeContent);
      message.success(t('components.markdown.copySuccess'));
    }, [codeContent, t]);

    const createCodeArtifact = useCreateCodeArtifact();

    // Handle creating a code artifact node
    const handleCreateCodeArtifact = useCallback(() => {
      if (!isInteractive) {
        return;
      }

      // Determine if this is mermaid content and set appropriate defaults
      const isMermaidDiagram =
        isMermaid || codeType === 'application/refly.artifacts.mermaid' || language === 'mermaid';
      const artifactType = isMermaidDiagram ? 'application/refly.artifacts.mermaid' : codeType;
      const artifactLanguage = isMermaidDiagram ? 'mermaid' : language;
      const title = isMermaidDiagram ? 'Mermaid Diagram' : `Code (${language})`;

      createCodeArtifact({
        codeContent,
        language: artifactLanguage,
        type: artifactType,
        title,
        connectTo: [{ type: 'skillResponse', entityId: id }],
      });
    }, [language, codeType, id, t, codeContent, isInteractive, isMermaid]);

    // Toggle between code and preview mode
    const toggleViewMode = useCallback(() => {
      setViewMode((prev) => (prev === 'code' ? 'preview' : 'code'));
    }, []);

    // If it's a mermaid diagram, render MermaidComponent
    if (isMermaid && codeContent) {
      return (
        <MermaidComponent id={id} mode={mode}>
          {codeContent}
        </MermaidComponent>
      );
    }

    // Render the code preview if in preview mode and the type is previewable
    if (viewMode === 'preview' && isPreviewable) {
      return (
        <div className="relative group p-4 border rounded bg-white dark:bg-gray-900 overflow-auto">
          <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Space>
              <Tooltip title={t('copilot.message.copy', 'Copy code')}>
                <Button
                  type="default"
                  size="small"
                  className="flex items-center justify-center bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                  icon={<CopyOutlined />}
                  onClick={handleCopy}
                />
              </Tooltip>
              <Tooltip title={t('components.markdown.viewCode', 'View code')}>
                <Button
                  type="default"
                  size="small"
                  className="flex items-center justify-center bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                  icon={<CodeOutlined />}
                  onClick={toggleViewMode}
                />
              </Tooltip>
              {isInteractive ? (
                <Tooltip
                  title={t('components.markdown.createCodeArtifact', 'Create code artifact')}
                >
                  <Button
                    type="default"
                    size="small"
                    className="flex items-center justify-center bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                    icon={<IconCodeArtifact />}
                    onClick={handleCreateCodeArtifact}
                  />
                </Tooltip>
              ) : null}
            </Space>
          </div>
          <Renderer
            content={codeContent}
            type={codeType}
            language={language}
            onRequestFix={() => {}}
          />
        </div>
      );
    }

    // Otherwise render normal code block with improved buttons
    return (
      <pre className={cn('relative group bg-gray-50 dark:bg-gray-900 rounded-lg')}>
        <div className="absolute top-2 right-2 z-50 flex transition-all duration-200 ease-in-out bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-md shadow-sm border border-gray-100 dark:border-gray-700">
          <Space>
            <Tooltip title={t('copilot.message.copy', 'Copy code')}>
              <Button
                type="text"
                size="small"
                className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                icon={<CopyOutlined />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCopy();
                }}
              />
            </Tooltip>
            {isPreviewable && (
              <Tooltip title={t('components.markdown.viewPreview', 'View preview')}>
                <Button
                  type="text"
                  size="small"
                  className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  icon={<EyeOutlined />}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleViewMode();
                  }}
                />
              </Tooltip>
            )}
            {isInteractive ? (
              <Tooltip title={t('components.markdown.createCodeArtifact', 'Create code artifact')}>
                <Button
                  type="text"
                  size="small"
                  className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  icon={<IconCodeArtifact />}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreateCodeArtifact();
                  }}
                />
              </Tooltip>
            ) : null}
          </Space>
        </div>
        <code className="block p-4 text-gray-800 dark:text-gray-200 !bg-gray-100 dark:!bg-gray-800 overflow-x-auto">
          {children}
        </code>
      </pre>
    );
  },
);

PreCode.displayName = 'PreCode';

export default PreCode;
