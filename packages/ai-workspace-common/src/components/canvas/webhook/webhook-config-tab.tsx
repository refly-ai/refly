import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Input, Switch, message, Typography, Divider, Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { Copy, Refresh } from 'refly-icons';
import { serverOrigin } from '@refly/ui-kit';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';

const { Text } = Typography;
const { TextArea } = Input;

interface WebhookConfig {
  webhookId: string;
  webhookUrl: string;
  isEnabled: boolean;
}

interface WebhookConfigTabProps {
  canvasId: string;
}

export const WebhookConfigTab = memo(({ canvasId }: WebhookConfigTabProps) => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [enabling, setEnabling] = useState(false);

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
        const { webhookId, isEnabled } = result.data;
        const apiOrigin = serverOrigin || window.location.origin;
        setConfig({
          webhookId,
          webhookUrl: `${apiOrigin}/v1/openapi/webhook/${webhookId}/run`,
          isEnabled,
        });
      }
    } catch (error) {
      console.error('Failed to fetch webhook config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    try {
      setEnabling(true);
      const response = await getClient().enableWebhook({
        body: { canvasId },
      });
      const result = response.data;
      if (result?.success) {
        message.success(t('webhook.enableSuccess'));
        await fetchConfig();
      } else {
        message.error(t('webhook.enableFailed'));
      }
    } catch (_error) {
      message.error(t('webhook.enableFailed'));
    } finally {
      setEnabling(false);
    }
  };

  const handleDisable = async () => {
    if (!config) return;
    try {
      setEnabling(true);
      const response = await getClient().disableWebhook({
        body: { webhookId: config.webhookId },
      });
      const result = response.data;
      if (result?.success) {
        message.success(t('webhook.disableSuccess'));
        await fetchConfig();
      } else {
        message.error(t('webhook.disableFailed'));
      }
    } catch (_error) {
      message.error(t('webhook.disableFailed'));
    } finally {
      setEnabling(false);
    }
  };

  const handleReset = async () => {
    if (!config) return;
    try {
      setEnabling(true);
      const response = await getClient().resetWebhook({
        body: { webhookId: config.webhookId },
      });
      const result = response.data;
      if (result?.success) {
        message.success(t('webhook.resetSuccess'));
        await fetchConfig();
      } else {
        message.error(t('webhook.resetFailed'));
      }
    } catch (_error) {
      message.error(t('webhook.resetFailed'));
    } finally {
      setEnabling(false);
    }
  };

  const handleCopy = useCallback(
    async (text: string) => {
      const success = await copyToClipboard(text);
      if (success) {
        message.success(t('common.copied'));
      } else {
        message.error(t('common.copyFailed'));
      }
    },
    [t],
  );

  const curlExample = config
    ? `curl -X POST ${config.webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"variable1": "value1", "variable2": "value2"}'`
    : '';

  const pythonExample = config
    ? `import requests

url = "${config.webhookUrl}"
data = {"variable1": "value1", "variable2": "value2"}
response = requests.post(url, json=data)
print(response.json())`
    : '';

  const javascriptExample = config
    ? `fetch('${config.webhookUrl}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ variable1: 'value1', variable2: 'value2' })
})
.then(res => res.json())
.then(data => console.log(data));`
    : '';

  const tabItems = useMemo(
    () => [
      {
        key: 'curl',
        label: t('webhook.examples.curl'),
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
              onClick={() => handleCopy(curlExample)}
            />
          </div>
        ),
      },
      {
        key: 'python',
        label: t('webhook.examples.python'),
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
              onClick={() => handleCopy(pythonExample)}
            />
          </div>
        ),
      },
      {
        key: 'javascript',
        label: t('webhook.examples.javascript'),
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
              onClick={() => handleCopy(javascriptExample)}
            />
          </div>
        ),
      },
    ],
    [config, curlExample, pythonExample, javascriptExample, enabling, handleCopy, t],
  );

  if (loading) {
    return <div className="py-6">{t('common.loading')}</div>;
  }

  if (!config) {
    return (
      <div className="py-6 space-y-4">
        <Text>{t('webhook.notEnabled')}</Text>
        <Button type="primary" loading={enabling} onClick={handleEnable}>
          {t('webhook.enable')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status and Controls */}
      <section id="webhook-status" className="space-y-4 scroll-mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Text strong>{t('webhook.status')}</Text>
            <Switch
              checked={config.isEnabled}
              loading={enabling}
              onChange={(checked) => (checked ? handleEnable() : handleDisable())}
            />
            <Text type={config.isEnabled ? 'success' : 'secondary'}>
              {config.isEnabled ? t('webhook.enabled') : t('webhook.disabled')}
            </Text>
          </div>
          <Button icon={<Refresh size={14} />} onClick={handleReset} loading={enabling} danger>
            {t('webhook.reset')}
          </Button>
        </div>

        <Text type="secondary" className="text-sm">
          {t('webhook.resetWarning')}
        </Text>
      </section>

      <Divider />

      {/* Webhook URL */}
      <section id="webhook-url" className="space-y-2 scroll-mt-4">
        <Text strong>{t('webhook.url')}</Text>
        <div className="flex gap-2">
          <Input value={config.webhookUrl} readOnly className="flex-1" />
          <Button icon={<Copy size={14} />} onClick={() => handleCopy(config.webhookUrl)}>
            {t('common.copy')}
          </Button>
        </div>
      </section>

      <Divider />

      {/* Code Examples */}
      <section id="webhook-examples" className="space-y-4 scroll-mt-4">
        <Text strong>{t('webhook.examples')}</Text>
        <Tabs items={tabItems} />
      </section>

      <Divider />

      {/* Usage Instructions */}
      <section id="webhook-instructions" className="space-y-2 scroll-mt-4">
        <Text strong>{t('webhook.instructions')}</Text>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          <li>{t('webhook.instruction1')}</li>
          <li>{t('webhook.instruction2')}</li>
          <li>{t('webhook.instruction3')}</li>
        </ul>
      </section>
    </div>
  );
});

WebhookConfigTab.displayName = 'WebhookConfigTab';
