import { memo, useMemo, Suspense, lazy } from 'react';

import HTMLRenderer from './html';
import SVGRender from './svg';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { CodeArtifactType } from '@refly/openapi-schema';
import MindMapRenderer from './mind-map';
import { Skeleton } from 'antd';

// Lazy load ReactRenderer as it contains Sandpack (~500KB)
const ReactRenderer = lazy(() => import('./react'));

// Loading fallback for Sandpack
const SandpackLoadingFallback = () => (
  <div className="flex items-center justify-center h-full w-full bg-gray-50">
    <Skeleton active paragraph={{ rows: 4 }} />
  </div>
);

interface RendererProps {
  content: string;
  type?: CodeArtifactType;
  title?: string;
  language?: string;
  onRequestFix?: (error: string) => void;
  width?: string;
  height?: string;
  onChange?: (content: string, type: CodeArtifactType) => void;
  readonly?: boolean;
  showActions?: boolean;
  purePreview?: boolean;
}

const Renderer = memo<RendererProps>(
  ({
    content,
    type,
    title = '',
    language,
    onRequestFix,
    width = '100%',
    height = '100%',
    onChange,
    readonly,
    showActions = true,
    purePreview = false,
  }) => {
    // Memoize the onChange callback for mind map to prevent unnecessary re-renders
    const memoizedMindMapOnChange = useMemo(() => {
      if (!onChange || type !== 'application/refly.artifacts.mindmap') return undefined;
      return (newContent: string) => onChange(newContent, type);
    }, [onChange, type]);

    switch (type) {
      case 'application/refly.artifacts.react': {
        return (
          <Suspense fallback={<SandpackLoadingFallback />}>
            <ReactRenderer
              code={content}
              title={title}
              language={language}
              onRequestFix={onRequestFix}
              showActions={showActions}
              purePreview={purePreview}
            />
          </Suspense>
        );
      }

      case 'image/svg+xml': {
        return (
          <SVGRender
            content={content}
            title={title}
            width={width}
            height={height}
            showActions={showActions}
            purePreview={purePreview}
          />
        );
      }

      case 'application/refly.artifacts.mermaid': {
        return <Markdown content={`\`\`\`mermaid\n${content}\n\`\`\``} showActions={showActions} />;
      }

      case 'text/markdown': {
        return <Markdown content={content} />;
      }

      case 'application/refly.artifacts.code': {
        return <Markdown content={content} />;
      }

      case 'application/refly.artifacts.mindmap': {
        return (
          <MindMapRenderer
            content={content}
            width={width}
            height={height}
            readonly={readonly}
            onChange={memoizedMindMapOnChange}
          />
        );
      }

      case 'text/html': {
        return (
          <HTMLRenderer
            htmlContent={content}
            width={width}
            height={height}
            showActions={showActions}
            purePreview={purePreview}
          />
        );
      }

      default: {
        // Default to HTML renderer for unknown types
        return (
          <HTMLRenderer
            htmlContent={content}
            width={width}
            height={height}
            showActions={showActions}
            purePreview={purePreview}
          />
        );
      }
    }
  },
  (prevProps, nextProps) => {
    // Custom equality check for more effective memoization
    return (
      prevProps.content === nextProps.content &&
      prevProps.type === nextProps.type &&
      prevProps.readonly === nextProps.readonly &&
      prevProps.title === nextProps.title &&
      prevProps.language === nextProps.language &&
      prevProps.width === nextProps.width &&
      prevProps.height === nextProps.height &&
      prevProps.onChange === nextProps.onChange &&
      prevProps.showActions === nextProps.showActions &&
      prevProps.purePreview === nextProps.purePreview
    );
  },
);

export default Renderer;
