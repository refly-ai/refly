import { memo, useState } from 'react';
import { Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Copy } from 'refly-icons';
import { apiDocsData } from '../data/api-docs.generated';
import type { ApiEndpoint, IntegrationType } from '../types';
import {
  extractRequestBodyFields,
  extractSchemaFields,
  buildWorkflowVariablesExample,
  buildMultipartFormExample,
  generateBestPracticesExamples,
  generateCodeExamples,
  generateExampleFromSchema,
  getApiBaseUrl,
} from '../utils';

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

const buildEndpointMarkdown = (
  endpoint: ApiEndpoint,
  baseUrl: string,
  t: (key: string) => string,
  pathParams?: Record<string, string>,
) => {
  const lines: string[] = [];
  lines.push(
    `### ${endpoint.summaryKey ? t(endpoint.summaryKey) : endpoint.summary || endpoint.operationId}`,
  );
  lines.push(`**${endpoint.method}** \`${endpoint.path}\``);
  const endpointDescription = endpoint.descriptionKey
    ? t(endpoint.descriptionKey)
    : endpoint.description;
  if (endpointDescription) {
    lines.push('');
    lines.push(endpointDescription);
  }

  lines.push('');
  lines.push(`#### ${t('integration.api.parametersTitle')}`);
  if (endpoint.parameters?.length) {
    const rows = endpoint.parameters.map((param) => [
      `\`${param.name}\``,
      param.in,
      param.type,
      param.required ? t('common.yes') : t('common.no'),
      param.descriptionKey ? t(param.descriptionKey) : param.description || '-',
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
  if (endpoint.requestBody) {
    const bodyDescription = endpoint.requestBody.schema?.descriptionKey
      ? t(endpoint.requestBody.schema.descriptionKey)
      : endpoint.requestBody.schema?.description;
    if (bodyDescription) {
      lines.push(bodyDescription);
      lines.push('');
    }
    const requestFields = extractRequestBodyFields(endpoint.requestBody.schema, {
      wildcard: {
        name: t('integration.api.requestBodyWildcardName'),
        type: t('integration.api.requestBodyWildcardType'),
        description: t('integration.api.requestBodyWildcardDescription'),
      },
    });
    lines.push(`##### ${t('integration.api.requestBodyFieldsTitle')}`);
    if (requestFields.length) {
      lines.push(
        toMarkdownTable(
          [
            t('integration.api.paramName'),
            t('integration.api.paramType'),
            t('integration.api.paramRequired'),
            t('integration.api.paramDescription'),
          ],
          requestFields.map((field) => [
            `\`${field.name}\``,
            field.type,
            field.required ? t('common.yes') : t('common.no'),
            field.descriptionKey ? t(field.descriptionKey) : field.description || '-',
          ]),
        ),
      );
    } else {
      lines.push(t('integration.api.noRequestBodyFields'));
    }
    lines.push('');
    lines.push(`##### ${t('integration.api.requestBodyExampleTitle')}`);
    const requestExample =
      endpoint.requestBody?.example ?? generateExampleFromSchema(endpoint.requestBody?.schema);
    const isMultipart = endpoint.requestBody?.contentType?.startsWith('multipart/');
    if (isMultipart) {
      const multipartExample = buildMultipartFormExample(endpoint.requestBody?.schema);
      if (multipartExample) {
        lines.push('```text');
        lines.push(multipartExample);
        lines.push('```');
      } else {
        lines.push(t('integration.api.noRequestBody'));
      }
    } else if (requestExample !== null && requestExample !== undefined) {
      lines.push('```json');
      lines.push(JSON.stringify(requestExample, null, 2));
      lines.push('```');
    } else {
      lines.push(t('integration.api.noRequestBody'));
    }
  } else {
    lines.push(t('integration.api.noRequestBody'));
  }

  lines.push('');
  lines.push(`#### ${t('integration.api.responsesTitle')}`);
  const responseRows = Object.entries(endpoint.responses || {}).map(([status, response]) => [
    `\`${status}\``,
    response.descriptionKey ? t(response.descriptionKey) : response.description || '-',
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

  const responseFieldLines = Object.entries(endpoint.responses || {}).map(([status, response]) => {
    const fields = extractSchemaFields(response.schema);
    if (!fields.length) return null;
    const rows = fields.map((field) => [
      `\`${field.name}\``,
      field.type,
      field.required ? t('common.yes') : t('common.no'),
      field.descriptionKey ? t(field.descriptionKey) : field.description || '-',
    ]);
    return [
      '',
      `##### ${t('integration.api.responseFieldsTitle')} (${status})`,
      toMarkdownTable(
        [
          t('integration.api.paramName'),
          t('integration.api.paramType'),
          t('integration.api.paramRequired'),
          t('integration.api.paramDescription'),
        ],
        rows,
      ),
    ].join('\n');
  });

  if (responseFieldLines.some(Boolean)) {
    lines.push(...responseFieldLines.filter(Boolean));
  } else {
    lines.push('');
    lines.push(t('integration.api.noResponseFields'));
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

const buildApiDocsMarkdown = (t: (key: string) => string, locale: string, canvasId: string) => {
  const lines: string[] = [];
  const baseUrl = getApiBaseUrl(apiDocsData.baseUrl);
  const pathParams = { canvasId };
  const resolveText = (fallback: string, i18nMap?: Record<string, string>) => {
    if (!i18nMap) return fallback;
    const normalized =
      locale.startsWith('zh') && i18nMap['zh-Hans'] ? 'zh-Hans' : locale.split('-')[0];
    return i18nMap[locale] ?? i18nMap[normalized] ?? fallback;
  };

  // Filter out internal endpoints and webhook endpoints, only show API endpoints
  const publicEndpoints = apiDocsData.endpoints.filter(
    (endpoint) =>
      endpoint.path.startsWith('/openapi/') &&
      !endpoint.path.includes('/webhook/') &&
      !endpoint.path.startsWith('/openapi/config'),
  );

  lines.push(`# ${t('integration.api.title')}`);
  lines.push('');
  lines.push(t('integration.api.description'));
  lines.push('');
  lines.push(`## ${t('integration.api.overviewTitle')}`);
  lines.push(t('integration.api.overviewDescription'));
  lines.push('');
  lines.push(`## ${t('integration.api.bestPracticesTitle')}`);
  lines.push(t('integration.api.bestPracticesDescription'));
  lines.push('');
  lines.push(`### ${t('integration.api.bestPracticesExamplesTitle')}`);
  const bestPracticeExamples = generateBestPracticesExamples(baseUrl, canvasId, 'YOUR_API_KEY', {
    upload: t('integration.api.bestPracticesCommentUpload'),
    run: t('integration.api.bestPracticesCommentRun'),
    poll: t('integration.api.bestPracticesCommentPoll'),
    output: t('integration.api.bestPracticesCommentOutput'),
  });
  lines.push('```bash');
  lines.push(bestPracticeExamples.curl);
  lines.push('```');
  lines.push('```python');
  lines.push(bestPracticeExamples.python);
  lines.push('```');
  lines.push('```javascript');
  lines.push(bestPracticeExamples.javascript);
  lines.push('```');
  lines.push('');
  lines.push(`## ${t('integration.api.endpointsTitle')}`);

  for (const endpoint of publicEndpoints) {
    lines.push('');
    lines.push(buildEndpointMarkdown(endpoint, baseUrl, t, pathParams));
  }

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
        error.httpStatus === null ? '-' : String(error.httpStatus),
        resolveText(error.message, error.messageI18n),
        resolveText(error.description, error.descriptionI18n),
      ]),
    ),
  );

  return lines.join('\n');
};

const buildWebhookDocsMarkdown = async (canvasId: string, t: (key: string) => string) => {
  const lines: string[] = [];
  let webhookUrl = 'https://api.refly.ai/v1/openapi/webhook/YOUR_WEBHOOK_ID/run';
  let isEnabled = false;
  let variableExample: Record<string, unknown> = { variable1: 'value1', variable2: 'value2' };

  try {
    const response = await getClient().getWebhookConfig({ query: { canvasId } });
    const result = response.data;
    if (result?.success && result.data) {
      const apiOrigin = getApiBaseUrl('/v1');
      webhookUrl = `${apiOrigin}/openapi/webhook/${result.data.webhookId}/run`;
      isEnabled = !!result.data.isEnabled;
    }
  } catch (error) {
    console.error('Failed to fetch webhook config:', error);
  }

  try {
    const variablesResponse = await getClient().getWorkflowVariables({ query: { canvasId } });
    const variables = variablesResponse.data?.data;
    if (Array.isArray(variables) && variables.length) {
      variableExample = buildWorkflowVariablesExample(variables);
    }
  } catch (error) {
    console.error('Failed to fetch webhook variables:', error);
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

  const payload = { variables: variableExample };
  const payloadJson = JSON.stringify(payload, null, 2);
  const curlExample = `curl -X POST ${webhookUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '${payloadJson.replace(/'/g, "\\'")}'`;
  const pythonExample = `import requests\n\nurl = "${webhookUrl}"\ndata = ${toPythonLiteral(payload)}\nresponse = requests.post(url, json=data)\nprint(response.json())`;
  const javascriptExample = `fetch('${webhookUrl}', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify(${payloadJson})\n})\n.then(res => res.json())\n.then(data => console.log(data));`;

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
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleCopy = async () => {
    setLoading(true);
    try {
      let markdown = '';
      if (activeIntegration === 'api') {
        markdown = buildApiDocsMarkdown(t, i18n.language, canvasId);
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
