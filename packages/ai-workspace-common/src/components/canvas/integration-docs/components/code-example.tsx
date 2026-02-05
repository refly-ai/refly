import { memo } from 'react';
import { Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { BiCopy } from 'react-icons/bi';

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
    <div className="relative my-4 rounded-lg overflow-hidden bg-refly-fill-label border border-solid border-refly-text-4">
      <div className="flex items-center justify-between px-4 pt-4 bg-refly-fill-label border-b border-[var(--integration-docs-code-border)]">
        <span className="text-[12px] text-refly-text-2 font-inter">{language}</span>
        <Button
          type="text"
          size="middle"
          className="!text-refly-text-1 hover:!text-refly-text-0"
          icon={<BiCopy size={20} />}
          onClick={handleCopy}
        />
      </div>
      <pre className="m-0 px-4 pb-4 overflow-x-auto text-[14px] leading-relaxed bg-refly-fill-label">
        <code className="text-refly-text-0 font-mono bg-transparent">{code}</code>
      </pre>
    </div>
  );
});

CodeExample.displayName = 'CodeExample';
