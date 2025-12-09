import { memo } from 'react';
import Renderer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/render';
import CodeViewer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/code-viewer';
import type { SourceRendererProps } from './types';

const Card = memo(({ fileContent, file }: SourceRendererProps) => {
  const textContent = new TextDecoder().decode(fileContent.data);

  return (
    <div className="h-full overflow-hidden">
      <Renderer
        content={textContent}
        type="text/html"
        title={file.name}
        showActions={false}
        purePreview={true}
      />
    </div>
  );
});

const Preview = memo(({ fileContent, file, activeTab, onTabChange }: SourceRendererProps) => {
  const textContent = new TextDecoder().decode(fileContent.data);

  return (
    <div className="h-full">
      <CodeViewer
        code={textContent}
        language="html"
        title={file.name}
        entityId={file.fileId}
        isGenerating={false}
        activeTab={activeTab!}
        onTabChange={onTabChange!}
        onClose={() => {}}
        onRequestFix={() => {}}
        readOnly={true}
        type="text/html"
        showActions={false}
        purePreview={false}
      />
    </div>
  );
});

export const HtmlRenderer = memo(
  ({ source, fileContent, file, activeTab, onTabChange }: SourceRendererProps) => {
    if (source === 'card') {
      return <Card source={source} fileContent={fileContent} file={file} />;
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
