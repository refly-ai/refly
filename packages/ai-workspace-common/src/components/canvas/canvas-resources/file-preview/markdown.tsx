import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import CodeViewer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/code-viewer';
import type { SourceRendererProps } from './types';

// Truncation limits
const MAX_CARD_LINES = 20;
const MAX_CARD_CHARS = 2000;
const MAX_PREVIEW_LINES = 2000;
const MAX_PREVIEW_CHARS = 500000;

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

const Card = memo(({ fileContent, className }: SourceRendererProps) => {
  const textContent = new TextDecoder().decode(fileContent.data);
  const { content: truncatedContent } = useMemo(
    () => truncateContent(textContent, MAX_CARD_LINES, MAX_CARD_CHARS),
    [textContent],
  );

  return (
    <div className="h-full overflow-y-auto">
      <Markdown content={truncatedContent} className={className} />
    </div>
  );
});

const Preview = memo(({ fileContent, file, activeTab, onTabChange }: SourceRendererProps) => {
  const rawContent = new TextDecoder().decode(fileContent.data);

  const { content: textContent, isTruncated } = useMemo(
    () => truncateContent(rawContent, MAX_PREVIEW_LINES, MAX_PREVIEW_CHARS),
    [rawContent],
  );

  return (
    <div className="h-full flex flex-col">
      {isTruncated && <TruncationNotice maxLines={MAX_PREVIEW_LINES} />}
      <div className="flex-1 min-h-0">
        <CodeViewer
          code={textContent}
          language="markdown"
          title={file.name}
          entityId={file.fileId}
          isGenerating={false}
          activeTab={activeTab!}
          onTabChange={onTabChange!}
          onClose={() => {}}
          onRequestFix={() => {}}
          readOnly={true}
          type="text/markdown"
          showActions={false}
          purePreview={false}
        />
      </div>
    </div>
  );
});

export const MarkdownRenderer = memo(
  ({ source, fileContent, file, className, activeTab, onTabChange }: SourceRendererProps) => {
    if (source === 'card') {
      return <Card source={source} fileContent={fileContent} file={file} className={className} />;
    }
    return (
      <Preview
        source={source}
        fileContent={fileContent}
        file={file}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
    );
  },
);
