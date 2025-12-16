import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SyntaxHighlighter from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/syntax-highlighter';
import CodeViewer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/code-viewer';
import { getCodeLanguage } from '@refly-packages/ai-workspace-common/utils/file-type';
import type { SourceRendererProps } from './types';

// Truncation limits
const MAX_CARD_LINES = 20;
const MAX_CARD_CHARS = 2000;
const MAX_PREVIEW_LINES = 1000;
const MAX_PREVIEW_CHARS = 100000;

const truncateContent = (content: string, maxLines: number, maxChars: number) => {
  const lines = content.split('\n');
  if (lines.length <= maxLines && content.length <= maxChars) {
    return { content, isTruncated: false };
  }
  return { content: lines.slice(0, maxLines).join('\n').slice(0, maxChars), isTruncated: true };
};

// 截断提示
const TruncationNotice = memo(({ maxLines }: { maxLines: number }) => {
  const { t } = useTranslation();
  return (
    <div className="px-3 py-1.5 mb-2 text-xs text-gray-500 bg-gray-100/80 flex-shrink-0">
      {t('filePreview.contentTruncated', { maxLines: maxLines.toLocaleString() })}
    </div>
  );
});

interface CodeRendererProps extends SourceRendererProps {
  language?: string;
}

// Card mode: truncated content with SyntaxHighlighter
const CardRenderer = memo(({ source, fileContent, file, language }: CodeRendererProps) => {
  const rawContent = new TextDecoder().decode(fileContent.data);
  const detectedLanguage = language || getCodeLanguage(file.name) || 'text';

  // 根据 source 使用不同的截断限制
  const isPreview = source === 'preview';
  const maxLines = isPreview ? MAX_PREVIEW_LINES : MAX_CARD_LINES;
  const maxChars = isPreview ? MAX_PREVIEW_CHARS : MAX_CARD_CHARS;

  const { content: truncatedContent, isTruncated } = useMemo(
    () => truncateContent(rawContent, maxLines, maxChars),
    [rawContent, maxLines, maxChars],
  );

  // Preview 模式下使用 CodeViewer（Monaco Editor 有虚拟化）
  if (isPreview) {
    return (
      <div className="h-full flex flex-col">
        {isTruncated && <TruncationNotice maxLines={maxLines} />}
        <div className="flex-1 min-h-0">
          <CodeViewer
            code={truncatedContent}
            language={detectedLanguage}
            title={file.name}
            entityId={file.fileId}
            isGenerating={false}
            activeTab="code"
            onTabChange={() => {}}
            onClose={() => {}}
            onRequestFix={() => {}}
            readOnly={true}
            type="text/plain"
            showActions={false}
            purePreview={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <SyntaxHighlighter code={truncatedContent} language={detectedLanguage} />
    </div>
  );
});

// Preview mode: with Monaco Editor (virtualized) but still truncated for very large files
const PreviewRenderer = memo(
  ({ fileContent, file, language, activeTab, onTabChange }: CodeRendererProps) => {
    const rawContent = new TextDecoder().decode(fileContent.data);
    const detectedLanguage = language || getCodeLanguage(file.name) || 'text';
    const [tab, setTab] = useState<'code' | 'preview'>(activeTab || 'code');

    const { content: textContent, isTruncated } = useMemo(
      () => truncateContent(rawContent, MAX_PREVIEW_LINES, MAX_PREVIEW_CHARS),
      [rawContent],
    );

    const handleTabChange = (v: 'code' | 'preview') => {
      setTab(v);
      onTabChange?.(v);
    };

    return (
      <div className="h-full flex flex-col">
        {isTruncated && <TruncationNotice maxLines={MAX_PREVIEW_LINES} />}
        <div className="flex-1 min-h-0">
          <CodeViewer
            code={textContent}
            language={detectedLanguage}
            title={file.name}
            entityId={file.fileId}
            isGenerating={false}
            activeTab={tab}
            onTabChange={handleTabChange}
            onClose={() => {}}
            onRequestFix={() => {}}
            readOnly={true}
            type="text/plain"
            showActions={false}
            purePreview={false}
          />
        </div>
      </div>
    );
  },
);

// 支持预览的语言类型（对应 artifact.ts 的 typeMapping）
const PREVIEWABLE_LANGUAGES = new Set(['html', 'markdown', 'mermaid', 'svg']);

export const CodeRenderer = memo(
  ({ source = 'card', fileContent, file, language, activeTab, onTabChange }: CodeRendererProps) => {
    const detectedLanguage = language || getCodeLanguage(file.name) || 'text';
    const supportsPreview = PREVIEWABLE_LANGUAGES.has(detectedLanguage.toLowerCase());

    // Card 模式或不支持预览的语言，使用 CardRenderer
    if (!supportsPreview) {
      return (
        <CardRenderer source={source} fileContent={fileContent} file={file} language={language} />
      );
    }

    // Preview 模式且支持预览，使用 PreviewRenderer
    return (
      <PreviewRenderer
        source={source}
        fileContent={fileContent}
        file={file}
        language={language}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
    );
  },
);

export const JsonRenderer = memo(({ fileContent, source = 'card' }: SourceRendererProps) => {
  const textContent = new TextDecoder().decode(fileContent.data);
  const { content: displayContent, isTruncated } = useMemo(
    () =>
      source === 'card'
        ? truncateContent(textContent, MAX_CARD_LINES, MAX_CARD_CHARS)
        : truncateContent(textContent, MAX_PREVIEW_LINES, MAX_PREVIEW_CHARS),
    [textContent, source],
  );

  // Card 模式不显示截断提示
  if (source === 'card') {
    return (
      <div className="h-full overflow-y-auto">
        <SyntaxHighlighter code={displayContent} language="json" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {isTruncated && <TruncationNotice maxLines={MAX_PREVIEW_LINES} />}
      <div className="flex-1 overflow-y-auto min-h-0">
        <SyntaxHighlighter code={displayContent} language="json" />
      </div>
    </div>
  );
});
