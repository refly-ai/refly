import { memo, useMemo } from 'react';
import Renderer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/render';
import CodeViewer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/code-viewer';
import type { SourceRendererProps } from './types';

export const HtmlRenderer = memo(
  ({ source, fileContent, file, activeTab, onTabChange, purePreview }: SourceRendererProps) => {
    // Cache decoded text content to avoid repeated decoding
    const textContent = useMemo(
      () => new TextDecoder().decode(fileContent.data),
      [fileContent.data],
    );

    // Pure preview mode: render HTML directly without CodeViewer chrome
    if (purePreview) {
      return (
        <div className="h-full w-full overflow-hidden">
          <Renderer
            content={textContent}
            type="text/html"
            title={file.name}
            showActions={false}
            purePreview={true}
          />
        </div>
      );
    }

    // Card mode: simple preview
    if (source === 'card') {
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
    }

    // Preview mode with code/preview toggle
    return (
      <div className="h-full">
        <CodeViewer
          code={textContent}
          language="html"
          title={file.name}
          entityId={file.fileId}
          isGenerating={false}
          activeTab={activeTab ?? 'preview'}
          onTabChange={onTabChange ?? (() => {})}
          onClose={() => {}}
          onRequestFix={() => {}}
          readOnly={true}
          type="text/html"
          showActions={false}
          purePreview={false}
        />
      </div>
    );
  },
);
