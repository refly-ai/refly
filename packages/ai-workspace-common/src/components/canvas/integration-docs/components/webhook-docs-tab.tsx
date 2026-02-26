import { memo, useCallback, useMemo, useState } from 'react';
import { Button, Input, message, Tabs, Popconfirm } from 'antd';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RemarkBreaks from 'remark-breaks';
import { Copy, Refresh } from 'refly-icons';
import { serverOrigin } from '@refly/ui-kit';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { useGetWorkflowVariables } from '@refly-packages/ai-workspace-common/queries/queries';
import { apiDocsData } from '../data/api-docs.generated';
import { buildWorkflowVariablesExample, extractRequestBodyFields } from '../utils';
import { CodeExample } from './code-example';

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
  onNavigateToApiSection?: (sectionId: string) => void;
}

const tableClassName =
  'w-full border-collapse my-4 text-sm rounded-lg overflow-hidden border border-[var(--integration-docs-border,rgba(0,0,0,0.12))] bg-[var(--integration-docs-bg)] [&_tr:last-child_td]:border-b-0';
const tableHeaderCellClassName =
  'text-left px-3 py-2.5 border-b border-r border-[var(--integration-docs-border,rgba(0,0,0,0.12))] bg-[var(--integration-docs-bg-subtle)] font-medium text-refly-text-0 last:border-r-0';
const tableCellClassName =
  'text-left px-3 py-2.5 border-b border-r border-[var(--integration-docs-border,rgba(0,0,0,0.12))] text-refly-text-1 last:border-r-0';
const inlineCodeClassName =
  'bg-[var(--integration-docs-inline-code-bg)] px-1.5 py-0.5 rounded text-[13px] text-[var(--integration-docs-inline-code-text)]';
const emptyStateClassName = 'text-[13px] text-[var(--integration-docs-text-3)] py-1.5';
const sectionDescClassName = 'mt-2 mb-4 text-sm text-refly-text-1 leading-relaxed';

const MarkdownText = ({ content }: { content: string }) => (
  <ReactMarkdown
    className="text-sm text-refly-text-1 leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_code]:bg-[var(--integration-docs-inline-code-bg)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:text-[var(--integration-docs-inline-code-text)]"
    remarkPlugins={[RemarkBreaks, remarkGfm]}
  >
    {content}
  </ReactMarkdown>
);

const toPythonLiteral = (value: unknown): string => {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (Array.isArray(value)) {
    return `[${value.map((item) => toPythonLiteral(item)).join(', ')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, item]) => `${toPythonLiteral(key)}: ${toPythonLiteral(item)}`,
    );
    return `{${entries.join(', ')}}`;
  }
  return `'${String(value).replace(/'/g, "\\'")}'`;
};

export const WebhookDocsTab = memo(
  ({ canvasId, webhookConfig, onWebhookReset, onNavigateToApiSection }: WebhookDocsTabProps) => {
    const { t, i18n } = useTranslation();
    const [resetting, setResetting] = useState(false);
    const apiOrigin = serverOrigin || window.location.origin;
    const webhookUrl =
      webhookConfig?.webhookUrl || `${apiOrigin}/v1/openapi/webhook/YOUR_WEBHOOK_ID/run`;
    const { data: workflowVariablesResponse } = useGetWorkflowVariables(
      {
        query: { canvasId },
      },
      undefined,
      {
        enabled: !!canvasId,
      },
    );

    const variableExample = useMemo(() => {
      const variables = workflowVariablesResponse?.data ?? [];
      if (!variables.length) {
        return { variable1: 'value1', variable2: 'value2' };
      }
      return buildWorkflowVariablesExample(variables);
    }, [workflowVariablesResponse]);

    const payload = useMemo(() => ({ variables: variableExample }), [variableExample]);
    const payloadJson = useMemo(() => JSON.stringify(payload, null, 2), [payload]);
    const payloadJsonEscaped = useMemo(() => payloadJson.replace(/'/g, "\\'"), [payloadJson]);
    const payloadPythonLiteral = useMemo(() => toPythonLiteral(payload), [payload]);

    const webhookEndpoint = useMemo(
      () =>
        apiDocsData.endpoints.find(
          (endpoint) =>
            endpoint.path === '/openapi/webhook/{webhookId}/run' && endpoint.method === 'POST',
        ),
      [],
    );
    const requestBodyFields = useMemo(() => {
      if (!webhookEndpoint?.requestBody?.schema) return [];
      return extractRequestBodyFields(webhookEndpoint.requestBody.schema, {
        wildcard: {
          name: t('integration.api.requestBodyWildcardName'),
          type: t('integration.api.requestBodyWildcardType'),
          description: t('integration.api.requestBodyWildcardDescription'),
        },
      });
    }, [t, webhookEndpoint]);

    const resolveText = (fallback: string, i18nMap?: Record<string, string>) => {
      if (!i18nMap) return fallback;
      const locale = i18n.language;
      const normalized =
        locale.startsWith('zh') && i18nMap['zh-Hans'] ? 'zh-Hans' : locale.split('-')[0];
      return i18nMap[locale] ?? i18nMap[normalized] ?? fallback;
    };

    const copyWebhookToClipboard = useCallback(
      async (text: string) => {
        const ok = await copyToClipboard(text);
        if (ok) {
          message.success(t('common.copy.success'));
        } else {
          message.error(t('common.copy.failed'));
        }
      },
      [t],
    );

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
  -d '${payloadJsonEscaped}'`;

    const pythonExample = `import requests

url = "${webhookUrl}"
data = ${payloadPythonLiteral}
response = requests.post(url, json=data)
print(response.json())`;

    const javascriptExample = `fetch('${webhookUrl}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${payloadJson})
})
.then(res => res.json())
.then(data => console.log(data));`;

    return (
      <div className="mx-auto w-full max-w-[814px] pt-6">
        <div className="mb-8">
          <h2 className="text-[22px] md:text-[28px] font-semibold text-refly-text-0 mb-2">
            {t('webhook.docsTitle')}
          </h2>
          <p className="m-0 text-[15px] text-refly-text-1 leading-relaxed">
            {t('webhook.docsSubtitle')}
          </p>
        </div>

        {/* Webhook URL - only show when enabled */}
        {!webhookConfig?.isEnabled ? (
          <section id="webhook-url" className="mb-10 scroll-mt-6 last:mb-0">
            <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
              {t('webhook.url')}
            </h3>
            <div className="flex flex-col items-center justify-center py-12 px-10 text-center text-[var(--integration-docs-text-3)] bg-[var(--integration-docs-bg-subtle)] rounded-lg border border-[var(--integration-docs-border)]">
              <svg
                width="88"
                height="88"
                viewBox="0 0 89 89"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-[88px] h-[88px] mb-6 text-refly-text-0"
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
              <h3 className="mt-0 mb-2 text-sm font-medium leading-[21px] text-[var(--refly-text-0)]">
                {t('webhook.emptyTitle')}
              </h3>
              <p className="m-0 text-xs leading-[18px] text-[var(--refly-text-2)] max-w-[400px]">
                {t('webhook.emptyDescription')}
              </p>
            </div>
          </section>
        ) : (
          <section id="webhook-url" className="mb-10 scroll-mt-6 last:mb-0">
            <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
              {t('webhook.url')}
            </h3>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="flex-1" />
              <Button icon={<Copy size={14} />} onClick={() => copyWebhookToClipboard(webhookUrl)}>
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
        )}

        {/* Request Body - always show */}
        <section id="webhook-request-body" className="mb-10 scroll-mt-6 last:mb-0">
          <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
            {t('integration.api.requestBodyTitle')}
          </h3>
          {webhookEndpoint?.requestBody?.schema ? (
            <>
              {(() => {
                const schema = webhookEndpoint.requestBody?.schema;
                const text = schema?.descriptionKey
                  ? t(schema.descriptionKey)
                  : schema?.description;
                return text ? (
                  <div className={sectionDescClassName}>
                    <MarkdownText content={text} />
                  </div>
                ) : null;
              })()}
              <div className="mt-3 pl-3 border-l-2 border-[var(--integration-docs-border)]">
                <h5 className="text-xs font-semibold text-[var(--integration-docs-text-2)] tracking-[0.2px] mb-1.5">
                  {t('integration.api.requestBodyFieldsTitle')}
                </h5>
                {requestBodyFields.length ? (
                  <table className={tableClassName}>
                    <thead>
                      <tr>
                        <th className={tableHeaderCellClassName}>
                          {t('integration.api.paramName')}
                        </th>
                        <th className={tableHeaderCellClassName}>
                          {t('integration.api.paramType')}
                        </th>
                        <th className={tableHeaderCellClassName}>
                          {t('integration.api.paramRequired')}
                        </th>
                        <th className={tableHeaderCellClassName}>
                          {t('integration.api.paramDescription')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {requestBodyFields.map((field) => (
                        <tr key={`webhook-body-${field.name}`}>
                          <td className={tableCellClassName}>
                            <code className={inlineCodeClassName}>{field.name}</code>
                          </td>
                          <td className={tableCellClassName}>{field.type}</td>
                          <td className={tableCellClassName}>
                            {field.required ? t('common.yes') : t('common.no')}
                          </td>
                          <td className={tableCellClassName}>
                            {field.descriptionKey
                              ? t(field.descriptionKey)
                              : field.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className={emptyStateClassName}>
                    {t('integration.api.noRequestBodyFields')}
                  </div>
                )}
              </div>
              <div className="mt-3 pl-3 border-l-2 border-[var(--integration-docs-border)]">
                <h5 className="text-xs font-semibold text-[var(--integration-docs-text-2)] tracking-[0.2px] mb-1.5">
                  {t('integration.api.requestBodyExampleTitle')}
                </h5>
                <CodeExample language="json" code={payloadJson} />
              </div>
            </>
          ) : (
            <div className={emptyStateClassName}>{t('integration.api.noRequestBody')}</div>
          )}
        </section>

        {/* File Upload - always show */}
        <section id="webhook-file-upload" className="mb-10 scroll-mt-6 last:mb-0">
          <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
            {t('integration.sections.fileUpload')}
          </h3>
          <p className={sectionDescClassName}>{t('webhook.fileUploadDescription')}</p>
          <button
            type="button"
            className="text-sm font-medium text-[var(--integration-docs-primary-text)] hover:underline border-0 bg-transparent p-0 cursor-pointer"
            onClick={() => onNavigateToApiSection?.('api-endpoint-uploadOpenapiFiles')}
          >
            {t('webhook.fileUploadLink')}
          </button>
        </section>

        {/* Code Examples - always show */}
        <section id="webhook-examples" className="mb-10 scroll-mt-6 last:mb-0">
          <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
            {t('webhook.examples')}
          </h3>
          <Tabs
            defaultActiveKey="javascript"
            items={[
              {
                key: 'curl',
                label: 'cURL',
                children: <CodeExample language="bash" code={curlExample} />,
              },
              {
                key: 'python',
                label: 'Python',
                children: <CodeExample language="python" code={pythonExample} />,
              },
              {
                key: 'javascript',
                label: 'JavaScript',
                children: <CodeExample language="javascript" code={javascriptExample} />,
              },
            ]}
          />
        </section>

        {/* Usage Instructions - always show */}
        <section id="webhook-instructions" className="mb-10 scroll-mt-6 last:mb-0">
          <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
            {t('webhook.instructions')}
          </h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-[var(--integration-docs-text-2)]">
            <li>{t('webhook.instruction1')}</li>
            <li>{t('webhook.instruction2')}</li>
            <li>{t('webhook.instruction3')}</li>
          </ul>
        </section>

        {/* Error Codes - always show */}
        <section id="webhook-errors" className="mb-10 scroll-mt-6 last:mb-0">
          <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
            {t('integration.sections.errors')}
          </h3>
          <p className={sectionDescClassName}>{t('integration.api.errorsDescription')}</p>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>{t('integration.api.errorCode')}</th>
                <th className={tableHeaderCellClassName}>{t('integration.api.errorStatus')}</th>
                <th className={tableHeaderCellClassName}>{t('integration.api.errorMessage')}</th>
                <th className={tableHeaderCellClassName}>
                  {t('integration.api.errorDescription')}
                </th>
              </tr>
            </thead>
            <tbody>
              {apiDocsData.errorCodes.map((error) => (
                <tr key={`webhook-error-${error.code}`}>
                  <td className={tableCellClassName}>
                    <code className={inlineCodeClassName}>{error.code}</code>
                  </td>
                  <td className={tableCellClassName}>{error.httpStatus ?? '-'}</td>
                  <td className={tableCellClassName}>
                    {resolveText(error.message, error.messageI18n)}
                  </td>
                  <td className={tableCellClassName}>
                    {resolveText(error.description, error.descriptionI18n)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    );
  },
);

WebhookDocsTab.displayName = 'WebhookDocsTab';
