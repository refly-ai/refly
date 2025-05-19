import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { McpServerJsonEditorProps } from './types';
import MonacoEditor from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/monaco-editor';

export const McpServerJsonEditor: React.FC<McpServerJsonEditorProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const { t } = useTranslation();
  const [jsonString, setJsonString] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Convert value to JSON string
  useEffect(() => {
    try {
      setJsonString(JSON.stringify(value, null, 2));
      setError(null);
    } catch (_err) {
      setError(t('settings.mcpServer.jsonParseError'));
    }
  }, [value, t]);

  // Handle content changes from editor
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        try {
          const parsed = JSON.parse(value);
          setError(null);
          onChange(parsed);
        } catch (_err: any) {
          setError(t('settings.mcpServer.jsonParseError'));
        }
      }
    },
    [onChange],
  );

  return (
    <div className="mcp-server-json-editor">
      {error && <Alert message={error} type="error" showIcon className="mb-4" />}
      <div style={{ height: '400px' }}>
        <MonacoEditor
          content={jsonString}
          language="json"
          type={'application/refly.artifacts.code'}
          readOnly={readOnly}
          onChange={handleEditorChange}
        />
      </div>
    </div>
  );
};
