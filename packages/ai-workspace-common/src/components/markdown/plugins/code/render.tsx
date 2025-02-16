import { useRef, useCallback, useMemo } from 'react';
import { Message as message } from '@arco-design/web-react';
import copyToClipboard from 'copy-to-clipboard';
import { useTranslation } from 'react-i18next';
import React from 'react';
import MermaidComponent from '../mermaid/render';

const PreCode = React.memo(({ children }: { children: any }) => {
  const ref = useRef<HTMLPreElement>(null);
  const { t } = useTranslation();

  const handleCopy = useCallback(() => {
    if (ref.current) {
      // Find the code element inside pre and get its text content
      const codeElement = ref.current.querySelector('code');
      const code = codeElement?.textContent ?? '';
      copyToClipboard(code);
      message.success(t('components.markdown.copySuccess'));
    }
  }, [t]);

  // Check if the code is mermaid diagram
  const isMermaid = useMemo(() => {
    const child = children?.[0];
    const classNames = child?.props?.className;
    return classNames?.includes('language-mermaid');
  }, [children]);

  // Memoize the mermaid code content
  const mermaidContent = useMemo(() => {
    if (!isMermaid) return null;
    const childNode = children?.[0];
    return childNode?.props?.children;
  }, [isMermaid, children]);

  // If it's a mermaid diagram, render MermaidComponent
  if (isMermaid && mermaidContent) {
    return <MermaidComponent>{mermaidContent}</MermaidComponent>;
  }

  // Otherwise render normal code block
  return (
    <pre ref={ref}>
      <span className="copy-code-button" onClick={handleCopy}>
        {t('copilot.message.copy')}
      </span>
      {children}
    </pre>
  );
});

PreCode.displayName = 'PreCode';

export default PreCode;
