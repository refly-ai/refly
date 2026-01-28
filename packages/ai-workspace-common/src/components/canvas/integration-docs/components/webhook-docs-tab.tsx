import { memo, useState, useEffect } from 'react';
import { Button, Input, message, Typography, Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { Copy } from 'refly-icons';
import { serverOrigin } from '@refly/ui-kit';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

const { Text } = Typography;
const { TextArea } = Input;

interface WebhookConfig {
  webhookId: string;
  webhookUrl: string;
  isEnabled: boolean;
}

interface WebhookDocsTabProps {
  canvasId: string;
}

export const WebhookDocsTab = memo(({ canvasId }: WebhookDocsTabProps) => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const apiOrigin = serverOrigin || window.location.origin;
  const webhookUrl = config?.webhookUrl || `${apiOrigin}/v1/openapi/webhook/YOUR_WEBHOOK_ID/run`;

  // Fetch webhook config
  useEffect(() => {
    fetchConfig();
  }, [canvasId]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await getClient().getWebhookConfig({
        query: { canvasId },
      });
      const result = response.data;
      if (result?.success && result.data) {
        const { apiId, isEnabled } = result.data;
        const apiOrigin = serverOrigin || window.location.origin;
        setConfig({
          webhookId: apiId,
          webhookUrl: `${apiOrigin}/v1/openapi/webhook/${apiId}/run`,
          isEnabled,
        });
      }
    } catch (error) {
      console.error('Failed to fetch webhook config:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success(t('common.copied'));
  };

  const curlExample = `curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"variable1": "value1", "variable2": "value2"}'`;

  const pythonExample = `import requests

url = "${webhookUrl}"
data = {"variable1": "value1", "variable2": "value2"}
response = requests.post(url, json=data)
print(response.json())`;

  const javascriptExample = `fetch('${webhookUrl}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ variable1: 'value1', variable2: 'value2' })
})
.then(res => res.json())
.then(data => console.log(data));`;

  if (loading) {
    return (
      <div className="integration-docs-body">
        <div className="py-6">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="integration-docs-body">
      <div className="integration-docs-header">
        <h2>{t('webhook.docsTitle')}</h2>
        <p>{t('webhook.docsSubtitle')}</p>
      </div>

      {/* Status and Controls */}
      <section id="webhook-status" className="integration-docs-section">
        <h3 className="integration-docs-section-title">{t('webhook.status')}</h3>
        <div className="flex items-center gap-3 mb-2">
          <Text type={config?.isEnabled ? 'success' : 'secondary'}>
            {config?.isEnabled ? t('webhook.enabled') : t('webhook.disabled')}
          </Text>
        </div>
        {!config?.isEnabled ? (
          <Text type="secondary" className="text-sm">
            {t('webhook.notEnabled')}
          </Text>
        ) : null}
      </section>

      {/* Webhook URL */}
      <section id="webhook-url" className="integration-docs-section">
        <h3 className="integration-docs-section-title">{t('webhook.url')}</h3>
        <div className="flex gap-2">
          <Input value={webhookUrl} readOnly className="flex-1" />
          <Button icon={<Copy size={14} />} onClick={() => copyToClipboard(webhookUrl)}>
            {t('common.copy')}
          </Button>
        </div>
      </section>

      {/* Code Examples */}
      <section id="webhook-examples" className="integration-docs-section">
        <h3 className="integration-docs-section-title">{t('webhook.examples')}</h3>
        <Tabs
          items={[
            {
              key: 'curl',
              label: 'cURL',
              children: (
                <div className="relative">
                  <TextArea
                    value={curlExample}
                    readOnly
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    className="font-mono text-xs"
                  />
                  <Button
                    size="small"
                    icon={<Copy size={12} />}
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(curlExample)}
                  />
                </div>
              ),
            },
            {
              key: 'python',
              label: 'Python',
              children: (
                <div className="relative">
                  <TextArea
                    value={pythonExample}
                    readOnly
                    autoSize={{ minRows: 5, maxRows: 8 }}
                    className="font-mono text-xs"
                  />
                  <Button
                    size="small"
                    icon={<Copy size={12} />}
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(pythonExample)}
                  />
                </div>
              ),
            },
            {
              key: 'javascript',
              label: 'JavaScript',
              children: (
                <div className="relative">
                  <TextArea
                    value={javascriptExample}
                    readOnly
                    autoSize={{ minRows: 5, maxRows: 8 }}
                    className="font-mono text-xs"
                  />
                  <Button
                    size="small"
                    icon={<Copy size={12} />}
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(javascriptExample)}
                  />
                </div>
              ),
            },
          ]}
        />
      </section>

      {/* Usage Instructions */}
      <section id="webhook-instructions" className="integration-docs-section">
        <h3 className="integration-docs-section-title">{t('webhook.instructions')}</h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
          <li>{t('webhook.instruction1')}</li>
          <li>{t('webhook.instruction2')}</li>
          <li>{t('webhook.instruction3')}</li>
        </ul>
      </section>
    </div>
  );
});

WebhookDocsTab.displayName = 'WebhookDocsTab';
