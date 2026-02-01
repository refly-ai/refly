import { memo } from 'react';
import { Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { Copy } from 'refly-icons';

interface CodeExampleProps {
  language: string;
  code: string;
  copyText?: string;
}

export const CodeExample = memo(({ language, code, copyText }: CodeExampleProps) => {
  const { t } = useTranslation();

  const handleCopy = () => {
    navigator.clipboard.writeText(copyText ?? code);
    message.success(t('common.copied'));
  };

  return (
    <div className="relative my-4 rounded-lg overflow-hidden bg-[var(--integration-docs-code-bg)]">
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--integration-docs-code-header-bg)] border-b border-[var(--integration-docs-code-border)]">
        <span className="text-xs text-[var(--integration-docs-code-muted)] font-medium">
          {language}
        </span>
        <Button
          type="text"
          size="small"
          className="!text-[var(--integration-docs-code-action)] hover:!text-[var(--integration-docs-code-text)]"
          icon={<Copy size={14} />}
          onClick={handleCopy}
        />
      </div>
      <pre className="m-0 p-4 overflow-x-auto text-[13px] leading-relaxed bg-[var(--integration-docs-code-content-bg)]">
        <code className="text-[var(--integration-docs-code-text)] font-mono bg-transparent">
          {code}
        </code>
      </pre>
    </div>
  );
});

CodeExample.displayName = 'CodeExample';
