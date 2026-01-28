import { memo, useState } from 'react';
import { Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Copy } from 'refly-icons';
import { apiDocsData } from '../data/api-docs.generated';
import type { ApiEndpoint, IntegrationType } from '../types';
import { generateCodeExamples, generateExampleFromSchema, getApiBaseUrl } from '../utils';

interface CopyAllDocsButtonProps {
  activeIntegration: IntegrationType;
  canvasId: string;
}

const escapePipes = (value: string) => value.replace(/\|/g, '\\|');

const toMarkdownTable = (headers: string[], rows: string[][]) => {
  const headerLine = `| ${headers.map(escapePipes).join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const rowLines = rows.map((row) => `| ${row.map((cell) => escapePipes(cell)).join(' | ')} |`);
  return [headerLine, divider, ...rowLines].join('\n');
};

const buildEndpointMarkdown = (
  endpoint: ApiEndpoint,
  baseUrl: string,
  t: (key: string) => string,
  pathParams?: Record<string, string>,
) => {
  const lines: string[] = [];
  lines.push(`### ${endpoint.summary || endpoint.operationId}`);
  lines.push(`**${endpoint.method}** \`${endpoint.path}\``);
  if (endpoint.description) {
    lines.push('');
    lines.push(endpoint.description);
  }

  lines.push('');
  lines.push(`#### ${t('integration.api.parametersTitle')}`);
  if (endpoint.parameters?.length) {
    const rows = endpoint.parameters.map((param) => [
      `\`${param.name}\``,
      param.in,
      param.type,
      param.required ? t('common.yes') : t('common.no'),
      param.description || '-',
    ]);
    lines.push(
      toMarkdownTable(
        [
          t('integration.api.paramName'),
          t('integration.api.paramIn'),
          t('integration.api.paramType'),
          t('integration.api.paramRequired'),
          t('integration.api.paramDescription'),
        ],
        rows,
      ),
    );
  } else {
    lines.push(t('integration.api.noParameters'));
  }

  lines.push('');
  lines.push(`#### ${t('integration.api.requestBodyTitle')}`);
  const requestExample =
    endpoint.requestBody?.example ?? generateExampleFromSchema(endpoint.requestBody?.schema);
  if (requestExample !== null && requestExample !== undefined) {
    lines.push('```json');
    lines.push(JSON.stringify(requestExample, null, 2));
    lines.push('```');
  } else {
    lines.push(t('integration.api.noRequestBody'));
  }

  lines.push('');
  lines.push(`#### ${t('integration.api.responsesTitle')}`);
  const responseRows = Object.entries(endpoint.responses || {}).map(([status, response]) => [
    `\`${status}\``,
    response.description || '-',
  ]);
  if (responseRows.length) {
    lines.push(
      toMarkdownTable(
        [t('integration.api.responseStatus'), t('integration.api.responseDescription')],
        responseRows,
      ),
    );
  } else {
    lines.push(t('integration.api.noResponses'));
  }

  for (const [status, response] of Object.entries(endpoint.responses || {})) {
    const responseExample = response.example ?? generateExampleFromSchema(response.schema);
    if (responseExample === null || responseExample === undefined) continue;
    lines.push('');
    lines.push(`${t('integration.api.responseExample')} (${status})`);
    lines.push('```json');
    lines.push(JSON.stringify(responseExample, null, 2));
    lines.push('```');
  }

  lines.push('');
  lines.push(`#### ${t('integration.api.codeExamplesTitle')}`);
  const examples = generateCodeExamples(endpoint, baseUrl, 'YOUR_API_KEY', pathParams);
  lines.push('```bash');
  lines.push(examples.curl);
  lines.push('```');
  lines.push('```python');
  lines.push(examples.python);
  lines.push('```');
  lines.push('```javascript');
  lines.push(examples.javascript);
  lines.push('```');

  return lines.join('\n');
};

const buildApiDocsMarkdown = (t: (key: string) => string, canvasId: string) => {
  const lines: string[] = [];
  const baseUrl = getApiBaseUrl(apiDocsData.baseUrl);
  const pathParams = { canvasId };

  // Filter out internal endpoints and webhook endpoints, only show API endpoints
  const publicEndpoints = apiDocsData.endpoints.filter(
    (endpoint) => endpoint.path.startsWith('/openapi/') && !endpoint.path.includes('/webhook/'),
  );

  lines.push(`# ${t('integration.api.title')}`);
  lines.push('');
  lines.push(t('integration.api.description'));
  lines.push('');
  lines.push(`## ${t('integration.api.overviewTitle')}`);
  lines.push(t('integration.api.overviewDescription'));
  lines.push('');
  lines.push(`## ${t('integration.api.endpointsTitle')}`);

  publicEndpoints.forEach((endpoint) => {
    lines.push('');
    lines.push(buildEndpointMarkdown(endpoint, baseUrl, t, pathParams));
  });

  lines.push('');
  lines.push(`## ${t('integration.api.errorsTitle')}`);
  lines.push(t('integration.api.errorsDescription'));
  lines.push('');
  lines.push(
    toMarkdownTable(
      [
        t('integration.api.errorCode'),
        t('integration.api.errorStatus'),
        t('integration.api.errorMessage'),
        t('integration.api.errorDescription'),
      ],
      apiDocsData.errorCodes.map((error) => [
        `\`${error.code}\``,
        String(error.httpStatus),
        error.message,
        error.description,
      ]),
    ),
  );

  return lines.join('\n');
};

const buildWebhookDocsMarkdown = async (canvasId: string, t: (key: string) => string) => {
  const lines: string[] = [];
  let webhookUrl = 'https://api.refly.ai/v1/openapi/webhook/YOUR_WEBHOOK_ID/run';
  let isEnabled = false;

  try {
    const response = await getClient().getWebhookConfig({ query: { canvasId } });
    const result = response.data;
    if (result?.success && result.data) {
      const apiOrigin = getApiBaseUrl('/v1');
      webhookUrl = `${apiOrigin}/openapi/webhook/${result.data.apiId}/run`;
      isEnabled = !!result.data.isEnabled;
    }
  } catch (error) {
    console.error('Failed to fetch webhook config:', error);
  }

  lines.push(`# ${t('webhook.docsTitle')}`);
  lines.push('');
  lines.push(t('webhook.docsSubtitle'));
  lines.push('');
  lines.push(`## ${t('webhook.status')}`);
  lines.push(isEnabled ? t('webhook.enabled') : t('webhook.disabled'));
  lines.push('');
  lines.push(`## ${t('webhook.url')}`);
  lines.push(`\`${webhookUrl}\``);
  lines.push('');
  lines.push(`## ${t('webhook.examples')}`);

  const curlExample = `curl -X POST ${webhookUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{"variable1": "value1", "variable2": "value2"}'`;
  const pythonExample = `import requests\n\nurl = "${webhookUrl}"\ndata = {"variable1": "value1", "variable2": "value2"}\nresponse = requests.post(url, json=data)\nprint(response.json())`;
  const javascriptExample = `fetch('${webhookUrl}', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ variable1: 'value1', variable2: 'value2' })\n})\n.then(res => res.json())\n.then(data => console.log(data));`;

  lines.push('```bash');
  lines.push(curlExample);
  lines.push('```');
  lines.push('```python');
  lines.push(pythonExample);
  lines.push('```');
  lines.push('```javascript');
  lines.push(javascriptExample);
  lines.push('```');

  lines.push('');
  lines.push(`## ${t('webhook.instructions')}`);
  lines.push(`- ${t('webhook.instruction1')}`);
  lines.push(`- ${t('webhook.instruction2')}`);
  lines.push(`- ${t('webhook.instruction3')}`);

  return lines.join('\n');
};

const buildSkillDocsMarkdown = (t: (key: string) => string) => {
  return `# ${t('integration.skill.title')}\n\n${t('integration.skill.comingSoonDescription')}`;
};

export const CopyAllDocsButton = memo(({ activeIntegration, canvasId }: CopyAllDocsButtonProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleCopy = async () => {
    setLoading(true);
    try {
      let markdown = '';
      if (activeIntegration === 'api') {
        markdown = buildApiDocsMarkdown(t, canvasId);
      } else if (activeIntegration === 'webhook') {
        markdown = await buildWebhookDocsMarkdown(canvasId, t);
      } else {
        markdown = buildSkillDocsMarkdown(t);
      }
      await navigator.clipboard.writeText(markdown);
      message.success(t('integration.copySuccess'));
    } catch (error) {
      console.error('Failed to copy docs:', error);
      message.error(t('integration.copyFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleCopy} loading={loading} icon={<Copy size={14} />}>
      {t('integration.copyAll')}
    </Button>
  );
});

CopyAllDocsButton.displayName = 'CopyAllDocsButton';
