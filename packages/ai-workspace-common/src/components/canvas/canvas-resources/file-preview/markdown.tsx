import { memo } from 'react';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import CodeViewer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/code-viewer';
import type { SourceRendererProps } from './types';

const Card = memo(({ fileContent, className }: SourceRendererProps) => {
  const textContent = new TextDecoder().decode(fileContent.data);

  return (
    <div className="h-full overflow-y-auto">
      <Markdown content={textContent} className={className} />
    </div>
  );
});

const Preview = memo(({ fileContent, file, activeTab, onTabChange }: SourceRendererProps) => {
  const textContent = new TextDecoder().decode(fileContent.data);

  return (
    <div className="h-full">
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
