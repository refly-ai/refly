import { SKIP, visit } from 'unist-util-visit';
import { CodeArtifactType } from '@refly/openapi-schema';

// Special handling for SVG blocks - make sure to recognize them properly
const SVG_INDICATORS = ['<svg', '<circle', '<rect', '<line', '<text', '<path'];

// Mermaid diagram pattern indicators
const MERMAID_PATTERNS = [
  /^graph\s+[A-Za-z0-9]/i,
  /^flowchart\s+[A-Za-z0-9]/i,
  /^sequenceDiagram/i,
  /^classDiagram/i,
  /^stateDiagram/i,
  /^erDiagram/i,
  /^gantt/i,
  /^pie\s+/i,
  /^mindmap/i,
  /^journey/i,
  /^gitGraph/i,
  /^timeline/i,
];

// Helper function to check if content is a mermaid diagram
const isMermaidContent = (content: string, className: string): boolean => {
  // If class explicitly includes mermaid, return true
  if (className?.includes('language-mermaid') || className?.includes('mermaid')) return true;

  // Check if content matches known mermaid patterns
  const trimmedContent = content.trim();
  return MERMAID_PATTERNS.some((pattern) => pattern.test(trimmedContent));
};

// Helper function to determine the appropriate code artifact type
const getCodeArtifactType = (className: string, content: string): CodeArtifactType => {
  if (!className && !content) return 'application/refly.artifacts.code';

  // Check for Mermaid content
  if (isMermaidContent(content, className)) {
    return 'application/refly.artifacts.mermaid';
  }

  // Check for SVG content even if not explicitly marked as svg
  if (
    className.includes('language-svg') ||
    className.includes('svg') ||
    SVG_INDICATORS.some((indicator) => content.includes(indicator))
  ) {
    return 'image/svg+xml';
  }

  if (
    className.includes('language-jsx') ||
    className.includes('language-tsx') ||
    className.includes('language-react')
  ) {
    return 'application/refly.artifacts.react';
  }

  if (
    className.includes('language-html') ||
    content.includes('<html') ||
    content.includes('<!DOCTYPE html')
  ) {
    return 'text/html';
  }

  if (className.includes('language-markdown') || className.includes('language-md')) {
    return 'text/markdown';
  }

  // Default code artifact type
  return 'application/refly.artifacts.code';
};

// Helper function to check if the code type is previewable
const isPreviewableType = (codeType: CodeArtifactType): boolean => {
  return [
    'application/refly.artifacts.react',
    'image/svg+xml',
    'application/refly.artifacts.mermaid',
    'text/markdown',
    'text/html',
  ].includes(codeType);
};

// Helper function to extract language from className
const getLanguageFromClassName = (className: string, content: string): string => {
  if (className) {
    const match = className.match(/language-(\w+)/);
    if (match) return match[1];
  }

  // Check for mermaid content
  if (isMermaidContent(content, className)) {
    return 'mermaid';
  }

  // Try to infer language from content if not explicitly set
  if (SVG_INDICATORS.some((indicator) => content.includes(indicator))) {
    return 'svg';
  }

  if (content.includes('<html') || content.includes('<!DOCTYPE html')) {
    return 'html';
  }

  return 'plaintext';
};

function rehypePlugin() {
  return (tree: any) => {
    visit(tree, 'element', (node) => {
      // Find code blocks (pre > code)
      if (node.tagName === 'pre' && node.children?.length > 0) {
        const codeNode = node.children.find((child: any) => child.tagName === 'code');

        if (codeNode) {
          // Extract code content
          let codeContent = '';
          if (codeNode.children && codeNode.children.length > 0) {
            codeContent = codeNode.children
              .map((child: any) => (child.type === 'text' ? child.value : ''))
              .join('');
          }

          // Get language class
          const languageClass = codeNode.properties?.className?.join(' ') || '';

          // Use content to help determine type and language
          const codeType = getCodeArtifactType(languageClass, codeContent);
          const language = getLanguageFromClassName(languageClass, codeContent);

          // Always set preview to true for previewable types
          const shouldPreview = isPreviewableType(codeType) && codeContent.trim().length > 0;

          // Check if content is mermaid
          const isMermaid = codeType === 'application/refly.artifacts.mermaid';

          // Add extracted information as properties to the pre node
          node.properties = {
            ...node.properties,
            'data-code-content': codeContent,
            'data-language-class': languageClass,
            'data-code-type': codeType,
            'data-language': language,
            'data-should-preview': shouldPreview,
            'data-is-mermaid': isMermaid,
          };

          return SKIP;
        }
      }
    });
  };
}

export default rehypePlugin;
