import { memo, useMemo } from 'react';

import HTMLRenderer from './html';
import SVGRender from './svg';
import ReactRenderer from './react';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { CodeArtifactType } from '@refly/openapi-schema';
import MindMapRenderer from './mind-map';

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
}

const Renderer = memo<RendererProps>(
  ({
    content,
    type,
    title,
    language,
    onRequestFix,
    width = '100%',
    height = '100%',
    onChange,
    readonly,
  }) => {
    // Memoize the onChange callback for mind map to prevent unnecessary re-renders
    const memoizedMindMapOnChange = useMemo(() => {
      if (!onChange || type !== 'application/refly.artifacts.mindmap') return undefined;
      return (newContent: string) => onChange(newContent, type);
    }, [onChange, type]);

    switch (type) {
      case 'application/refly.artifacts.react': {
        return (
          <ReactRenderer
            code={content}
            title={title}
            language={language}
            onRequestFix={onRequestFix}
          />
        );
      }

      case 'image/svg+xml': {
        return <SVGRender content={content} title={title} width={width} height={height} />;
      }

      case 'application/refly.artifacts.mermaid': {
        return <Markdown content={`\`\`\`mermaid\n${content}\n\`\`\``} />;
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
        return <HTMLRenderer htmlContent={content} width={width} height={height} />;
      }

      default: {
        // Default to HTML renderer for unknown types
        return <HTMLRenderer htmlContent={content} width={width} height={height} />;
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
      prevProps.onChange === nextProps.onChange
    );
  },
);

export default Renderer;
