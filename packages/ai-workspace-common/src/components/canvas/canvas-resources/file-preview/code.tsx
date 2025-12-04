import { memo } from 'react';
import SyntaxHighlighter from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/syntax-highlighter';
import { getCodeLanguage } from '@refly-packages/ai-workspace-common/utils/file-type';
import type { FileRendererProps } from './types';

interface CodeRendererProps extends FileRendererProps {
  language?: string;
}

export const CodeRenderer = memo(({ fileContent, file, language }: CodeRendererProps) => {
  const textContent = new TextDecoder().decode(fileContent.data);
  const detectedLanguage = language || getCodeLanguage(file.name) || 'text';

  return (
    <div className="h-full overflow-y-auto">
      <SyntaxHighlighter code={textContent} language={detectedLanguage} />
    </div>
  );
});

export const JsonRenderer = memo(({ fileContent }: FileRendererProps) => {
  const textContent = new TextDecoder().decode(fileContent.data);

  return (
    <div className="h-full overflow-y-auto">
      <SyntaxHighlighter code={textContent} language="json" />
    </div>
  );
});
