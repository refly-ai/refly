import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import zhTranslations from '../../i18n/src/zh-Hans/ui';
import enTranslations from '../../i18n/src/en-US/ui';

const schemaPath = path.resolve(__dirname, '../schema.yml');
const outputPath = path.resolve(
  __dirname,
  '../../ai-workspace-common/src/components/canvas/integration-docs/data/api-docs.generated.ts',
);

const supportedPrefixes = [
  '/openapi/workflow',
  '/openapi/webhook',
  '/openapi/files',
  '/openapi/copilot',
  '/webhook',
];
const allowedMethods = new Set(['get', 'post', 'put', 'delete', 'patch']);

const docsRoot = path.resolve(__dirname, '../../../docs');
const localeConfigs = {
  zh: {
    dict: zhTranslations as Record<string, any>,
    baseDir: path.join(docsRoot, 'zh/guide/api'),
    titles: {
      openapi: 'API 文档',
      webhook: 'Webhook 文档',
    },
    labels: {
      baseUrl: '基础地址',
    },
  },
  en: {
    dict: enTranslations as Record<string, any>,
    baseDir: path.join(docsRoot, 'en/guide/api'),
    titles: {
      openapi: 'API Documentation',
      webhook: 'Webhook Documentation',
    },
    labels: {
      baseUrl: 'Base URL',
    },
  },
};

const webhookErrorCodes = [
  {
    code: 'WEBHOOK_NOT_FOUND',
    httpStatus: 404,
    message: 'Webhook not found',
    messageI18n: { 'zh-Hans': 'Webhook 不存在' },
    description: 'Webhook does not exist or has been deleted.',
    descriptionI18n: { 'zh-Hans': 'Webhook 不存在或已被删除。' },
  },
  {
    code: 'WEBHOOK_DISABLED',
    httpStatus: 403,
    message: 'Webhook disabled',
    messageI18n: { 'zh-Hans': 'Webhook 已停用' },
    description: 'Webhook is disabled and cannot be triggered.',
    descriptionI18n: { 'zh-Hans': 'Webhook 已停用，无法触发执行。' },
  },
  {
    code: 'WEBHOOK_RATE_LIMITED',
    httpStatus: 429,
    message: 'Webhook rate limited',
    messageI18n: { 'zh-Hans': 'Webhook 请求限流' },
    description: 'Request rate exceeds the limit.',
    descriptionI18n: { 'zh-Hans': '请求速率超过限制。' },
  },
  {
    code: 'INVALID_REQUEST_BODY',
    httpStatus: 400,
    message: 'Invalid request body',
    messageI18n: { 'zh-Hans': '请求体非法' },
    description: 'Request body format is invalid.',
    descriptionI18n: { 'zh-Hans': '请求体格式不正确。' },
  },
  {
    code: 'CANVAS_NOT_FOUND',
    httpStatus: 404,
    message: 'Canvas not found',
    messageI18n: { 'zh-Hans': '画布不存在' },
    description: 'Associated canvas cannot be found.',
    descriptionI18n: { 'zh-Hans': '关联画布不存在。' },
  },
  {
    code: 'INSUFFICIENT_CREDITS',
    httpStatus: 402,
    message: 'Insufficient credits',
    messageI18n: { 'zh-Hans': '积分不足' },
    description: 'Insufficient credits for this operation.',
    descriptionI18n: { 'zh-Hans': '当前操作所需积分不足。' },
  },
];

const readSchema = () => {
  const raw = fs.readFileSync(schemaPath, 'utf8');
  return parse(raw) as Record<string, any>;
};

const toId = (method: string, endpointPath: string) => {
  return `${method}-${endpointPath}`
    .toLowerCase()
    .replace(/[{}]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const resolveRef = (ref: string, schema: Record<string, any>) => {
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  if (!match) return null;
  return schema?.components?.schemas?.[match[1]] ?? null;
};

const mergeSchemas = (schemas: any[]) => {
  const merged: any = { type: 'object', properties: {}, required: [] as string[] };
  for (const schema of schemas) {
    if (schema?.properties) {
      merged.properties = { ...merged.properties, ...schema.properties };
    }
    if (schema?.required) {
      merged.required = Array.from(new Set([...merged.required, ...schema.required]));
    }
    if (schema?.description && !merged.description) {
      merged.description = schema.description;
    }
    if (schema?.descriptionKey && !merged.descriptionKey) {
      merged.descriptionKey = schema.descriptionKey;
    }
    if (schema?.example && !merged.example) {
      merged.example = schema.example;
    }
  }
  return merged;
};

const derefSchema = (schemaNode: any, schema: Record<string, any>): any => {
  if (!schemaNode) return null;
  if (schemaNode.$ref) {
    const resolved = resolveRef(schemaNode.$ref, schema);
    return derefSchema(resolved, schema);
  }
  if (schemaNode.allOf) {
    const parts = schemaNode.allOf.map((item: any) => derefSchema(item, schema));
    return mergeSchemas(parts);
  }
  if (schemaNode.oneOf) {
    return derefSchema(schemaNode.oneOf[0], schema);
  }
  if (schemaNode.anyOf) {
    return derefSchema(schemaNode.anyOf[0], schema);
  }

  const normalized: any = {
    type:
      schemaNode.type || (schemaNode.properties ? 'object' : schemaNode.items ? 'array' : 'object'),
  };

  if (schemaNode.description) normalized.description = schemaNode.description;
  if (schemaNode.format) normalized.format = schemaNode.format;
  if (schemaNode['x-i18n-description'])
    normalized.descriptionKey = schemaNode['x-i18n-description'];
  if (schemaNode.example !== undefined) normalized.example = schemaNode.example;
  if (schemaNode.enum) normalized.enum = schemaNode.enum;
  if (schemaNode.required) normalized.required = schemaNode.required;

  if (schemaNode.properties) {
    normalized.properties = Object.fromEntries(
      Object.entries(schemaNode.properties).map(([key, value]) => [
        key,
        derefSchema(value, schema),
      ]),
    );
  }

  if (schemaNode.items) {
    normalized.items = derefSchema(schemaNode.items, schema);
  }

  if (schemaNode.additionalProperties !== undefined) {
    normalized.additionalProperties =
      schemaNode.additionalProperties === true
        ? true
        : derefSchema(schemaNode.additionalProperties, schema);
  }

  return normalized;
};

const extractExample = (content: Record<string, any>) => {
  if (!content) return null;
  const contentType = content['application/json'] ? 'application/json' : Object.keys(content)[0];
  const payload = content[contentType] || {};
  if (payload.example !== undefined) return payload.example;
  if (payload.examples) {
    const firstExample = Object.values(payload.examples)[0] as any;
    if (firstExample?.value !== undefined) return firstExample.value;
  }
  return null;
};

const buildDocs = (schema: Record<string, any>) => {
  const endpoints: any[] = [];
  const paths = schema.paths || {};
  for (const [endpointPath, pathItem] of Object.entries(paths)) {
    if (!supportedPrefixes.some((prefix) => endpointPath.startsWith(prefix))) {
      continue;
    }
    for (const [method, operation] of Object.entries(pathItem as Record<string, any>)) {
      if (!allowedMethods.has(method)) continue;
      const op = operation as Record<string, any>;
      const parameters = [
        ...(Array.isArray((pathItem as any).parameters) ? (pathItem as any).parameters : []),
        ...(Array.isArray(op.parameters) ? op.parameters : []),
      ];
      const normalizedParams = parameters.map((param) => {
        const paramSchema = derefSchema(param.schema || {}, schema) || {};
        const descriptionKey = param['x-i18n-description'] || paramSchema.descriptionKey;
        return {
          name: param.name,
          in: param.in,
          required: !!param.required,
          type: paramSchema.type || 'string',
          description: param.description || '',
          ...(descriptionKey ? { descriptionKey } : {}),
          example: param.example ?? paramSchema.example,
        };
      });

      const requestBodyContent = op.requestBody?.content;
      const requestBodySchema = requestBodyContent
        ? derefSchema(
            requestBodyContent['application/json']?.schema ??
              (Object.values(requestBodyContent)[0] as any)?.schema,
            schema,
          )
        : null;
      const requestBodyExample = requestBodyContent ? extractExample(requestBodyContent) : null;
      const requestBody = requestBodyContent
        ? {
            required: !!op.requestBody?.required,
            contentType: requestBodyContent['application/json']
              ? 'application/json'
              : Object.keys(requestBodyContent)[0],
            schema: requestBodySchema,
            example: requestBodyExample,
          }
        : undefined;

      const responses: Record<string, any> = {};
      for (const [status, response] of Object.entries(op.responses || {})) {
        const responseContent = (response as any).content;
        const responseSchema = responseContent
          ? derefSchema(
              responseContent['application/json']?.schema ??
                (Object.values(responseContent)[0] as any)?.schema,
              schema,
            )
          : null;
        const responseExample = responseContent ? extractExample(responseContent) : null;
        const responseDescriptionKey = (response as any)['x-i18n-description'];
        responses[status] = {
          description: (response as any).description || '',
          ...(responseDescriptionKey ? { descriptionKey: responseDescriptionKey } : {}),
          ...(responseSchema ? { schema: responseSchema } : {}),
          ...(responseExample !== null ? { example: responseExample } : {}),
        };
      }

      const security = Array.isArray(op.security)
        ? op.security.flatMap((item: Record<string, any>) => Object.keys(item))
        : [];

      endpoints.push({
        id: toId(method, endpointPath),
        method: method.toUpperCase(),
        path: endpointPath,
        operationId: op.operationId || '',
        summary: op.summary || '',
        ...(op['x-i18n-summary'] ? { summaryKey: op['x-i18n-summary'] } : {}),
        description: op.description || '',
        ...(op['x-i18n-description'] ? { descriptionKey: op['x-i18n-description'] } : {}),
        tags: op.tags || [],
        security,
        ...(normalizedParams.length ? { parameters: normalizedParams } : {}),
        ...(requestBody ? { requestBody } : {}),
        responses,
      });
    }
  }

  endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  const errorCodes = mergeErrorCodes(webhookErrorCodes, loadErrorCodes());

  return { endpoints, errorCodes };
};

const loadErrorCodes = () => {
  const errorFilePath = path.resolve(__dirname, '../../errors/src/errors.ts');
  if (!fs.existsSync(errorFilePath)) {
    return [];
  }

  const content = fs.readFileSync(errorFilePath, 'utf8');
  const classRegex = /export class\s+\w+\s+extends\s+BaseError\s*{([\s\S]*?)^}/gm;
  const results: Array<{
    code: string;
    httpStatus: number | null;
    message: string;
    messageI18n?: Record<string, string>;
    description: string;
    descriptionI18n?: Record<string, string>;
  }> = [];

  let match: RegExpExecArray | null = classRegex.exec(content);
  while (match !== null) {
    const body = match[1];
    const codeMatch = body.match(/code\s*=\s*['"]([^'"]+)['"]/);
    const dictMatch = body.match(/messageDict\s*=\s*{([\s\S]*?)}/);
    if (codeMatch && dictMatch) {
      const code = codeMatch[1];
      const dictBody = dictMatch[1];
      const enMatch = dictBody.match(/en\s*:\s*['"]([^'"]+)['"]/);
      const zhMatch = dictBody.match(/['"]zh-CN['"]\s*:\s*['"]([^'"]+)['"]/);
      const message = enMatch?.[1] ?? '';
      const zhMessage = zhMatch?.[1] ?? '';
      results.push({
        code,
        httpStatus: null,
        message,
        messageI18n: zhMessage ? { 'zh-Hans': zhMessage } : undefined,
        description: message,
        descriptionI18n: zhMessage ? { 'zh-Hans': zhMessage } : undefined,
      });
    }
    match = classRegex.exec(content);
  }

  return results;
};

const mergeErrorCodes = (
  base: Array<{
    code: string;
    httpStatus: number | null;
    message: string;
    messageI18n?: Record<string, string>;
    description: string;
    descriptionI18n?: Record<string, string>;
  }>,
  extra: Array<{
    code: string;
    httpStatus: number | null;
    message: string;
    messageI18n?: Record<string, string>;
    description: string;
    descriptionI18n?: Record<string, string>;
  }>,
) => {
  const map = new Map<
    string,
    {
      code: string;
      httpStatus: number | null;
      message: string;
      messageI18n?: Record<string, string>;
      description: string;
      descriptionI18n?: Record<string, string>;
    }
  >();
  for (const item of [...base, ...extra]) {
    if (!map.has(item.code)) {
      map.set(item.code, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
};

type SchemaNode = {
  type?: string;
  format?: string;
  enum?: string[];
  properties?: Record<string, SchemaNode>;
  required?: string[];
  items?: SchemaNode;
  additionalProperties?: boolean | SchemaNode;
  description?: string;
  descriptionKey?: string;
  example?: unknown;
};

type SchemaField = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  descriptionKey?: string;
};

const endpointCategoryOrder = ['workflow', 'files', 'webhook', 'copilot', 'other'];

const getEndpointCategoryKey = (endpoint: { path: string }) => {
  const endpointPath = endpoint.path || '';
  if (
    endpointPath.startsWith('/openapi/workflow/') ||
    endpointPath.startsWith('/openapi/workflows')
  ) {
    return 'workflow';
  }
  if (endpointPath.startsWith('/openapi/files')) {
    return 'files';
  }
  if (endpointPath.startsWith('/openapi/webhook/')) {
    return 'webhook';
  }
  if (endpointPath.startsWith('/openapi/copilot/')) {
    return 'copilot';
  }
  return 'other';
};

const groupApiEndpoints = (endpoints: Array<{ path: string }>) => {
  const groups = new Map<string, Array<{ path: string }>>();
  for (const endpoint of endpoints) {
    const key = getEndpointCategoryKey(endpoint);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(endpoint);
  }

  const ordered: Array<{ key: string; endpoints: Array<{ path: string }> }> = [];
  for (const key of endpointCategoryOrder) {
    const items = groups.get(key);
    if (items && items.length > 0) {
      ordered.push({ key, endpoints: items });
      groups.delete(key);
    }
  }

  for (const [key, items] of groups.entries()) {
    ordered.push({ key, endpoints: items });
  }

  return ordered;
};

const resolveLocaleText = (dict: Record<string, any>, key?: string, fallback = ''): string => {
  if (!key) return fallback;
  const value = key.split('.').reduce<unknown>(
    (acc, part) => {
      if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    },
    dict as Record<string, unknown>,
  );
  return typeof value === 'string' ? value : fallback;
};

const escapeTableCell = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, '<br/>');

const renderTable = (headers: string[], rows: string[][]) => {
  const lines = [
    `| ${headers.map(escapeTableCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ];
  for (const row of rows) {
    lines.push(`| ${row.map(escapeTableCell).join(' | ')} |`);
  }
  lines.push('');
  return lines;
};

const formatSchemaType = (schema?: SchemaNode): string => {
  if (!schema) return 'object';
  if (schema.enum && schema.enum.length > 0) {
    return `enum(${schema.enum.join(' | ')})`;
  }
  if (schema.type === 'array') {
    return `${formatSchemaType(schema.items)}[]`;
  }
  if (schema.type === 'string' && schema.format) {
    return `string(${schema.format})`;
  }
  return schema.type || 'object';
};

const extractSchemaFields = (
  schema?: SchemaNode | null,
  options?: {
    wildcard?: {
      name: string;
      type: string;
      description: string;
    };
  },
): SchemaField[] => {
  if (!schema) return [];
  const fields: SchemaField[] = [];
  const walk = (node: SchemaNode, prefix = '') => {
    const requiredSet = new Set(node.required ?? []);
    if (!node.properties) return;
    for (const [key, value] of Object.entries(node.properties)) {
      const prop = value as SchemaNode;
      const name = prefix ? `${prefix}.${key}` : key;
      fields.push({
        name,
        type: formatSchemaType(prop),
        required: requiredSet.has(key),
        description: prop.description ?? '',
        descriptionKey: prop.descriptionKey,
      });
      if (prop.properties) {
        walk(prop, name);
      } else if (prop.type === 'array' && prop.items && prop.items.properties) {
        walk(prop.items, `${name}[]`);
      }
    }
  };
  walk(schema);

  if (fields.length === 0 && schema.additionalProperties) {
    const wildcard = options?.wildcard;
    if (schema.additionalProperties === true) {
      if (wildcard) {
        fields.push({
          name: wildcard.name,
          type: wildcard.type,
          required: false,
          description: wildcard.description,
        });
      }
    } else {
      const additionalSchema = schema.additionalProperties as SchemaNode;
      fields.push({
        name: wildcard?.name ?? 'key',
        type: wildcard?.type ?? formatSchemaType(additionalSchema),
        required: false,
        description: additionalSchema.description ?? wildcard?.description ?? '',
      });
    }
  }

  return fields;
};

const generateExampleFromSchema = (schema?: SchemaNode | null): unknown => {
  if (!schema) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];
  if (schema.type === 'array') {
    return [generateExampleFromSchema(schema.items) ?? {}];
  }
  if (schema.type === 'object' || schema.properties) {
    const result: Record<string, unknown> = {};
    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        result[key] = generateExampleFromSchema(value as SchemaNode);
      }
    }
    if (schema.additionalProperties && !schema.properties) {
      result.key = generateExampleFromSchema(
        schema.additionalProperties === true ? {} : (schema.additionalProperties as SchemaNode),
      );
    }
    return result;
  }
  if (schema.type === 'boolean') return false;
  if (schema.type === 'number' || schema.type === 'integer') return 0;
  if (schema.type === 'string') return 'string';
  return null;
};

const renderEndpointMarkdown = (endpoint: any, dict: Record<string, any>, headingLevel: number) => {
  const lines: string[] = [];
  const heading = '#'.repeat(headingLevel);
  const anchorId = `api-endpoint-${endpoint.operationId || endpoint.id}`;
  lines.push(`<a id="${anchorId}"></a>`);
  lines.push(`${heading} ${endpoint.method} ${endpoint.path}`);
  lines.push('');

  const summary = resolveLocaleText(dict, endpoint.summaryKey, endpoint.summary);
  if (summary) {
    lines.push(`**${summary}**`);
    lines.push('');
  }

  const description = resolveLocaleText(dict, endpoint.descriptionKey, endpoint.description);
  if (description) {
    lines.push(description);
    lines.push('');
  }

  if (endpoint.parameters?.length) {
    lines.push(`**${resolveLocaleText(dict, 'integration.api.parametersTitle', 'Parameters')}**`);
    lines.push('');
    const rows = endpoint.parameters.map((param: any) => [
      param.name,
      param.in,
      param.type || '',
      param.required
        ? resolveLocaleText(dict, 'common.yes', 'Yes')
        : resolveLocaleText(dict, 'common.no', 'No'),
      resolveLocaleText(dict, param.descriptionKey, param.description || '-') || '-',
    ]);
    lines.push(
      ...renderTable(
        [
          resolveLocaleText(dict, 'integration.api.paramName', 'Name'),
          resolveLocaleText(dict, 'integration.api.paramIn', 'In'),
          resolveLocaleText(dict, 'integration.api.paramType', 'Type'),
          resolveLocaleText(dict, 'integration.api.paramRequired', 'Required'),
          resolveLocaleText(dict, 'integration.api.paramDescription', 'Description'),
        ],
        rows,
      ),
    );
  }

  if (endpoint.requestBody) {
    lines.push(
      `**${resolveLocaleText(dict, 'integration.api.requestBodyTitle', 'Request Body')}**`,
    );
    lines.push('');
    const bodySchema = endpoint.requestBody.schema as SchemaNode | undefined;
    const bodyDesc = resolveLocaleText(
      dict,
      bodySchema?.descriptionKey,
      bodySchema?.description ?? '',
    );
    if (bodyDesc) {
      lines.push(bodyDesc);
      lines.push('');
    }

    const fields = extractSchemaFields(bodySchema, {
      wildcard: {
        name: resolveLocaleText(dict, 'integration.api.requestBodyWildcardName', 'key'),
        type: resolveLocaleText(dict, 'integration.api.requestBodyWildcardType', 'any'),
        description: resolveLocaleText(dict, 'integration.api.requestBodyWildcardDescription', ''),
      },
    });
    if (fields.length > 0) {
      lines.push(
        `**${resolveLocaleText(dict, 'integration.api.requestBodyFieldsTitle', 'Request Body Fields')}**`,
      );
      lines.push('');
      const rows = fields.map((field) => [
        field.name,
        field.type,
        field.required
          ? resolveLocaleText(dict, 'common.yes', 'Yes')
          : resolveLocaleText(dict, 'common.no', 'No'),
        resolveLocaleText(dict, field.descriptionKey, field.description || '-') || '-',
      ]);
      lines.push(
        ...renderTable(
          [
            resolveLocaleText(dict, 'integration.api.paramName', 'Name'),
            resolveLocaleText(dict, 'integration.api.paramType', 'Type'),
            resolveLocaleText(dict, 'integration.api.paramRequired', 'Required'),
            resolveLocaleText(dict, 'integration.api.paramDescription', 'Description'),
          ],
          rows,
        ),
      );
    }

    const example = endpoint.requestBody.example ?? generateExampleFromSchema(bodySchema);
    if (example !== null && example !== undefined) {
      lines.push(
        `**${resolveLocaleText(dict, 'integration.api.requestBodyExampleTitle', 'Request Body Example')}**`,
      );
      lines.push('');
      const payload =
        typeof example === 'string' ? example : JSON.stringify(example, null, 2) || '';
      lines.push('```json');
      lines.push(payload);
      lines.push('```');
      lines.push('');
    }
  }

  if (endpoint.responses && Object.keys(endpoint.responses).length) {
    lines.push(`**${resolveLocaleText(dict, 'integration.api.responsesTitle', 'Responses')}**`);
    lines.push('');
    const rows = Object.entries(endpoint.responses).map(([status, response]: [string, any]) => [
      status,
      resolveLocaleText(dict, response.descriptionKey, response.description || '-') || '-',
    ]);
    lines.push(
      ...renderTable(
        [
          resolveLocaleText(dict, 'integration.api.responseStatus', 'Status'),
          resolveLocaleText(dict, 'integration.api.responseDescription', 'Description'),
        ],
        rows,
      ),
    );

    for (const [status, response] of Object.entries(endpoint.responses)) {
      const responseSchema = (response as any).schema as SchemaNode | undefined;
      const fields = extractSchemaFields(responseSchema);
      if (fields.length === 0) continue;
      lines.push(
        `**${resolveLocaleText(dict, 'integration.api.responseFieldsTitle', 'Response Fields')} (${status})**`,
      );
      lines.push('');
      const fieldRows = fields.map((field) => [
        field.name,
        field.type,
        field.required
          ? resolveLocaleText(dict, 'common.yes', 'Yes')
          : resolveLocaleText(dict, 'common.no', 'No'),
        resolveLocaleText(dict, field.descriptionKey, field.description || '-') || '-',
      ]);
      lines.push(
        ...renderTable(
          [
            resolveLocaleText(dict, 'integration.api.paramName', 'Name'),
            resolveLocaleText(dict, 'integration.api.paramType', 'Type'),
            resolveLocaleText(dict, 'integration.api.paramRequired', 'Required'),
            resolveLocaleText(dict, 'integration.api.paramDescription', 'Description'),
          ],
          fieldRows,
        ),
      );
    }
  }

  return lines;
};

const buildOpenApiMarkdown = (
  dict: Record<string, any>,
  endpoints: any[],
  errorCodes: any[],
  baseUrl: string,
  title: string,
  labels: { baseUrl: string },
  useZh: boolean,
) => {
  const lines: string[] = ['<!-- AUTO-GENERATED: DO NOT EDIT -->', '', `# ${title}`, ''];
  const intro = resolveLocaleText(dict, 'integration.api.description', '');
  if (intro) {
    lines.push(intro);
    lines.push('');
  }
  if (baseUrl) {
    const baseLabel = resolveLocaleText(dict, 'integration.api.baseUrl', labels.baseUrl);
    lines.push(`**${baseLabel}**: \`${baseUrl}\``);
    lines.push('');
  }

  lines.push(`## ${resolveLocaleText(dict, 'integration.api.overviewTitle', 'Overview')}`);
  const overview = resolveLocaleText(dict, 'integration.api.overviewDescription', '');
  if (overview) {
    lines.push(overview);
    lines.push('');
  }

  lines.push(`## ${resolveLocaleText(dict, 'integration.api.authTitle', 'Authentication')}`);
  const authDesc = resolveLocaleText(dict, 'integration.api.authDescription', '');
  if (authDesc) {
    lines.push(authDesc);
    lines.push('');
  }
  const authHeader = resolveLocaleText(dict, 'integration.api.authHeader', '');
  if (authHeader) {
    lines.push(`\`${authHeader}\``);
    lines.push('');
  }

  lines.push(`## ${resolveLocaleText(dict, 'integration.api.endpointsTitle', 'Endpoints')}`);
  const endpointsDesc = resolveLocaleText(dict, 'integration.api.endpointsDescription', '');
  if (endpointsDesc) {
    lines.push(endpointsDesc);
    lines.push('');
  }

  const grouped = groupApiEndpoints(endpoints);
  for (const group of grouped) {
    const groupLabel = resolveLocaleText(
      dict,
      `integration.api.endpointGroups.${group.key}`,
      group.key,
    );
    lines.push(`### ${groupLabel}`);
    lines.push('');
    for (const endpoint of group.endpoints) {
      lines.push(...renderEndpointMarkdown(endpoint, dict, 4));
    }
  }

  lines.push(`## ${resolveLocaleText(dict, 'integration.api.errorsTitle', 'Error Codes')}`);
  const errorsDesc = resolveLocaleText(dict, 'integration.api.errorsDescription', '');
  if (errorsDesc) {
    lines.push(errorsDesc);
    lines.push('');
  }
  const errorRows = errorCodes.map((error) => [
    String(error.code),
    error.httpStatus === null || error.httpStatus === undefined ? '-' : String(error.httpStatus),
    useZh ? (error.messageI18n?.['zh-Hans'] ?? error.message) : error.message,
    useZh ? (error.descriptionI18n?.['zh-Hans'] ?? error.description) : error.description,
  ]);
  lines.push(
    ...renderTable(
      [
        resolveLocaleText(dict, 'integration.api.errorCode', 'Error Code'),
        resolveLocaleText(dict, 'integration.api.errorStatus', 'HTTP Status'),
        resolveLocaleText(dict, 'integration.api.errorMessage', 'Message'),
        resolveLocaleText(dict, 'integration.api.errorDescription', 'Description'),
      ],
      errorRows,
    ),
  );

  return lines.join('\n');
};

const buildWebhookMarkdown = (
  dict: Record<string, any>,
  endpoint: any | undefined,
  errorCodes: any[],
  title: string,
  useZh: boolean,
) => {
  const lines: string[] = ['<!-- AUTO-GENERATED: DO NOT EDIT -->', '', `# ${title}`, ''];
  const subtitle = resolveLocaleText(dict, 'webhook.docsSubtitle', '');
  if (subtitle) {
    lines.push(subtitle);
    lines.push('');
  }

  // Add "How to Enable Webhook" section
  const howToEnableTitle = resolveLocaleText(
    dict,
    'webhook.howToEnableTitle',
    'How to Enable Webhook',
  );
  lines.push(`## ${howToEnableTitle}`);
  lines.push('');

  const stepsTitle = resolveLocaleText(
    dict,
    'webhook.howToEnableStepsTitle',
    'Steps to get Webhook URL',
  );
  lines.push(`**${stepsTitle}**:`);
  lines.push('');

  const step1 = resolveLocaleText(
    dict,
    'webhook.howToEnableStep1',
    '1. Visit https://refly.ai/workspace and enter any workflow.',
  );
  lines.push(step1);
  lines.push('');
  // Reuse screenshot from API docs - step 1 (enter workflow)
  const step1Image = useZh
    ? 'https://static.refly.ai/static/screenshot-20260205-112644.png'
    : 'https://static.refly.ai/static/20260205-114458.jpeg';
  lines.push(`   ![${step1}](${step1Image})`);
  lines.push('');

  const step2 = resolveLocaleText(
    dict,
    'webhook.howToEnableStep2',
    '2. Click the "Integration" button in the top right corner.',
  );
  lines.push(step2);
  lines.push('');
  // Reuse screenshot from API docs - step 2 (click integration button)
  const step2Image = useZh
    ? 'https://static.refly.ai/static/screenshot-20260205-112430.png'
    : 'https://static.refly.ai/static/screenshot-20260205-114520.png';
  lines.push(`   ![${step2}](${step2Image})`);
  lines.push('');

  const step3 = resolveLocaleText(
    dict,
    'webhook.howToEnableStep3',
    '3. Click the "Webhook" tab at the top, then toggle the Enable switch at the top.',
  );
  lines.push(step3);
  lines.push('');
  // New screenshot for enabling webhook
  const step3Image = useZh
    ? 'https://static.refly.ai/static/screenshot-20260205-145000.png'
    : 'https://static.refly.ai/static/screenshot-20260205-145015.png';
  lines.push(`   ![${step3}](${step3Image})`);
  lines.push('');

  const step4 = resolveLocaleText(
    dict,
    'webhook.howToEnableStep4',
    '4. Copy the generated Webhook URL for integration.',
  );
  lines.push(step4);
  lines.push('');

  lines.push(`## ${resolveLocaleText(dict, 'integration.sections.requestBody', 'Request Body')}`);
  const requestBody = endpoint?.requestBody;
  if (requestBody?.schema) {
    const bodySchema = requestBody.schema as SchemaNode;
    const bodyDesc = resolveLocaleText(
      dict,
      bodySchema?.descriptionKey,
      bodySchema?.description ?? '',
    );
    if (bodyDesc) {
      lines.push(bodyDesc);
      lines.push('');
    }
    const fields = extractSchemaFields(bodySchema, {
      wildcard: {
        name: resolveLocaleText(dict, 'integration.api.requestBodyWildcardName', 'key'),
        type: resolveLocaleText(dict, 'integration.api.requestBodyWildcardType', 'any'),
        description: resolveLocaleText(dict, 'integration.api.requestBodyWildcardDescription', ''),
      },
    });
    if (fields.length > 0) {
      const rows = fields.map((field) => [
        field.name,
        field.type,
        field.required
          ? resolveLocaleText(dict, 'common.yes', 'Yes')
          : resolveLocaleText(dict, 'common.no', 'No'),
        resolveLocaleText(dict, field.descriptionKey, field.description || '-') || '-',
      ]);
      lines.push(
        ...renderTable(
          [
            resolveLocaleText(dict, 'integration.api.paramName', 'Name'),
            resolveLocaleText(dict, 'integration.api.paramType', 'Type'),
            resolveLocaleText(dict, 'integration.api.paramRequired', 'Required'),
            resolveLocaleText(dict, 'integration.api.paramDescription', 'Description'),
          ],
          rows,
        ),
      );
    }
    const example = requestBody.example ?? generateExampleFromSchema(bodySchema);
    if (example !== null && example !== undefined) {
      lines.push(
        `**${resolveLocaleText(dict, 'integration.api.requestBodyExampleTitle', 'Request Body Example')}**`,
      );
      lines.push('');
      const payload =
        typeof example === 'string' ? example : JSON.stringify(example, null, 2) || '';
      lines.push('```json');
      lines.push(payload);
      lines.push('```');
      lines.push('');
    }
  }

  lines.push(`## ${resolveLocaleText(dict, 'integration.sections.fileUpload', 'File Upload')}`);
  const fileUploadDesc = resolveLocaleText(dict, 'webhook.fileUploadDescription', '');
  if (fileUploadDesc) {
    lines.push(fileUploadDesc);
    lines.push('');
  }
  const fileUploadLinkText = resolveLocaleText(dict, 'webhook.fileUploadLink', '');
  if (fileUploadLinkText) {
    lines.push(`[${fileUploadLinkText}](./openapi.md#api-endpoint-uploadOpenapiFiles)`);
    lines.push('');
  }

  lines.push(`## ${resolveLocaleText(dict, 'integration.sections.errors', 'Error Codes')}`);
  const errorsDesc = resolveLocaleText(dict, 'integration.api.errorsDescription', '');
  if (errorsDesc) {
    lines.push(errorsDesc);
    lines.push('');
  }
  const webhookCodeSet = new Set(webhookErrorCodes.map((item) => item.code));
  const webhookErrors = errorCodes.filter((error) => webhookCodeSet.has(error.code));
  const errorRows = webhookErrors.map((error) => [
    String(error.code),
    error.httpStatus === null || error.httpStatus === undefined ? '-' : String(error.httpStatus),
    useZh ? (error.messageI18n?.['zh-Hans'] ?? error.message) : error.message,
    useZh ? (error.descriptionI18n?.['zh-Hans'] ?? error.description) : error.description,
  ]);
  lines.push(
    ...renderTable(
      [
        resolveLocaleText(dict, 'integration.api.errorCode', 'Error Code'),
        resolveLocaleText(dict, 'integration.api.errorStatus', 'HTTP Status'),
        resolveLocaleText(dict, 'integration.api.errorMessage', 'Message'),
        resolveLocaleText(dict, 'integration.api.errorDescription', 'Description'),
      ],
      errorRows,
    ),
  );

  return lines.join('\n');
};

const writeDocs = (output: {
  endpoints: any[];
  errorCodes: any[];
  baseUrl: string;
}) => {
  const apiEndpoints = output.endpoints.filter(
    (endpoint) =>
      endpoint.path.startsWith('/openapi/') &&
      !endpoint.path.includes('/webhook/') &&
      !endpoint.path.startsWith('/openapi/config'),
  );
  const webhookEndpoint = output.endpoints.find(
    (endpoint) =>
      endpoint.path === '/openapi/webhook/{webhookId}/run' && endpoint.method === 'POST',
  );

  for (const localeKey of Object.keys(localeConfigs) as Array<keyof typeof localeConfigs>) {
    const localeConfig = localeConfigs[localeKey];
    fs.mkdirSync(localeConfig.baseDir, { recursive: true });
    const openapiPath = path.join(localeConfig.baseDir, 'openapi.md');
    const webhookPath = path.join(localeConfig.baseDir, 'webhook.md');
    const isZh = localeKey === 'zh';
    const openapiContent = buildOpenApiMarkdown(
      localeConfig.dict,
      apiEndpoints,
      output.errorCodes,
      output.baseUrl,
      localeConfig.titles.openapi,
      localeConfig.labels,
      isZh,
    );
    const webhookContent = buildWebhookMarkdown(
      localeConfig.dict,
      webhookEndpoint,
      output.errorCodes,
      localeConfig.titles.webhook,
      isZh,
    );
    fs.writeFileSync(openapiPath, openapiContent);
    fs.writeFileSync(webhookPath, webhookContent);
  }
};

const main = () => {
  const schema = readSchema();
  const { endpoints, errorCodes } = buildDocs(schema);
  const baseUrl = schema?.servers?.[0]?.url ?? '';

  const output = {
    version: schema?.info?.version ?? 'unknown',
    generatedAt: new Date().toISOString(),
    baseUrl,
    endpoints,
    errorCodes,
  };

  const fileContent = `import type { ApiDocsData } from '../types';\n\nexport const apiDocsData: ApiDocsData = ${JSON.stringify(
    output,
    null,
    2,
  )};\n`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, fileContent);

  // For documentation, use full production URL
  const docsBaseUrl = 'https://api.refly.ai/v1';
  writeDocs({ endpoints, errorCodes, baseUrl: docsBaseUrl });
};

main();
