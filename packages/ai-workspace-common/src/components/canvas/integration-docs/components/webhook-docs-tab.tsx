import { memo, useState } from 'react';
import { Button, Input, message, Tabs, Popconfirm } from 'antd';
import { useTranslation } from 'react-i18next';
import { Copy, Refresh } from 'refly-icons';
import { serverOrigin } from '@refly/ui-kit';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

const { TextArea } = Input;

interface WebhookConfig {
  webhookId: string;
  webhookUrl: string;
  isEnabled: boolean;
}

interface WebhookDocsTabProps {
  canvasId: string;
  webhookConfig: WebhookConfig | null;
  onToggleWebhook: (enabled: boolean) => Promise<void>;
  toggling: boolean;
  onWebhookReset?: () => Promise<void>;
}

export const WebhookDocsTab = memo(({ webhookConfig, onWebhookReset }: WebhookDocsTabProps) => {
  const { t } = useTranslation();
  const [resetting, setResetting] = useState(false);
  const apiOrigin = serverOrigin || window.location.origin;
  const webhookUrl =
    webhookConfig?.webhookUrl || `${apiOrigin}/v1/openapi/webhook/YOUR_WEBHOOK_ID/run`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success(t('common.copied'));
  };

  const handleResetWebhook = async () => {
    if (!webhookConfig?.webhookId) {
      message.error(t('webhook.resetFailed'));
      return;
    }

    setResetting(true);
    try {
      const response = await getClient().resetWebhook({
        body: { webhookId: webhookConfig.webhookId },
      });

      if (response.data?.success) {
        message.success(t('webhook.resetSuccess'));
        // Call parent callback to refresh webhook config
        await onWebhookReset?.();
      } else {
        message.error(t('webhook.resetFailed'));
      }
    } catch (error) {
      console.error('Failed to reset webhook:', error);
      message.error(t('webhook.resetFailed'));
    } finally {
      setResetting(false);
    }
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

  return (
    <div className="integration-docs-body">
      <div className="integration-docs-header">
        <h2>{t('webhook.docsTitle')}</h2>
        <p>{t('webhook.docsSubtitle')}</p>
      </div>

      {/* Empty State when webhook is disabled */}
      {!webhookConfig?.isEnabled ? (
        <div className="webhook-empty-state">
          <svg
            width="88"
            height="88"
            viewBox="0 0 89 89"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="webhook-empty-icon"
          >
            <path
              d="M49.5033 16.9563C43.1755 13.3029 35.0841 15.471 31.4308 21.7988C28.1514 27.4788 29.5626 34.5797 34.4624 38.6164C35.4023 39.3907 35.7797 40.7263 35.1708 41.7809L26.2863 57.1694"
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="7.35"
              strokeLinecap="round"
            />
            <path
              d="M13.23 59.5349C13.23 66.8416 19.1533 72.7649 26.46 72.7649C33.0187 72.7649 38.4627 67.9924 39.5086 61.7307C39.7092 60.5295 40.6772 59.5349 41.895 59.5349L59.664 59.5349"
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="7.35"
              strokeLinecap="round"
            />
            <path
              d="M68.4841 70.5601C74.8119 66.9067 76.9799 58.8154 73.3266 52.4875C70.0472 46.8076 63.1921 44.4792 57.2463 46.7042C56.1058 47.131 54.7604 46.7901 54.1515 45.7354L45.267 30.347"
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="7.35"
              strokeLinecap="round"
            />
          </svg>
          <h3 className="webhook-empty-title">{t('webhook.emptyTitle')}</h3>
          <p className="webhook-empty-description">{t('webhook.emptyDescription')}</p>
        </div>
      ) : (
        <>
          {/* Webhook URL */}
          <section id="webhook-url" className="integration-docs-section">
            <h3 className="integration-docs-section-title">{t('webhook.url')}</h3>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="flex-1" />
              <Button icon={<Copy size={14} />} onClick={() => copyToClipboard(webhookUrl)}>
                {t('common.copy.title')}
              </Button>
              <Popconfirm
                title={t('webhook.reset')}
                description={t('webhook.resetWarning')}
                onConfirm={handleResetWebhook}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ loading: resetting }}
              >
                <Button icon={<Refresh size={14} />} loading={resetting} disabled={resetting}>
                  {t('webhook.reset')}
                </Button>
              </Popconfirm>
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
        </>
      )}
    </div>
  );
});

WebhookDocsTab.displayName = 'WebhookDocsTab';
