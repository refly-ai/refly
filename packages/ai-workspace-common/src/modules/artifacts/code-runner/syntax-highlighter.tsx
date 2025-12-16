import { useState, useEffect, useRef, useCallback } from 'react';
import { createHighlighter } from 'shiki/bundle/web';

const SUPPORTED_LANGUAGES = new Set([
  'html',
  'css',
  'js',
  'graphql',
  'javascript',
  'json',
  'jsx',
  'markdown',
  'md',
  'mdx',
  'plaintext',
  'py',
  'python',
  'sh',
  'shell',
  'sql',
  'text',
  'ts',
  'tsx',
  'txt',
  'typescript',
  'zsh',
]);

const highlighterPromise = createHighlighter({
  langs: Array.from(SUPPORTED_LANGUAGES),
  themes: ['github-light-default'],
});

export default function SyntaxHighlighter({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const [html, setHtml] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function highlight() {
      try {
        const highlighter = await highlighterPromise;
        if (isMounted) {
          // Fall back to plaintext for unsupported languages
          const lang = SUPPORTED_LANGUAGES.has(language) ? language : 'plaintext';
          const highlightedHtml = highlighter.codeToHtml(code, {
            lang,
            theme: 'github-light-default',
          });
          setHtml(highlightedHtml);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error highlighting code:', error);
        setIsLoading(false);
      }
    }

    highlight();

    return () => {
      isMounted = false;
    };
  }, [code, language]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Check if Ctrl+A (Windows/Linux) or Cmd+A (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      e.stopPropagation();

      // Select all text within the code container
      const selection = window.getSelection();
      const range = document.createRange();

      if (containerRef.current && selection) {
        // Find the pre element inside the container
        const preElement = containerRef.current.querySelector('pre');
        if (preElement) {
          range.selectNodeContents(preElement);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  }, []);

  if (isLoading) {
    return <div className="p-4 text-sm">Loading syntax highlighting...</div>;
  }

  // eslint-disable-next-line react/no-danger
  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Code block"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: <explanation>
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="font-mono text-sm w-full overflow-x-auto [&_pre]:!w-full [&_pre]:!max-w-full [&_pre]:!overflow-x-auto [&_pre]:!bg-transparent outline-none"
      style={{ backgroundColor: '#F6F6F6' }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
