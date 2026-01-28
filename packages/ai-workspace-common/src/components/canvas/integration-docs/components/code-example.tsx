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
    <div className="integration-docs-code-block">
      <div className="code-header">
        <span className="code-lang">{language}</span>
        <Button
          type="text"
          size="small"
          className="code-copy-btn"
          icon={<Copy size={14} />}
          onClick={handleCopy}
        />
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
});

CodeExample.displayName = 'CodeExample';
