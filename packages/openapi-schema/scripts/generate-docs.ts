import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const schemaPath = path.resolve(__dirname, '../schema.yml');
const outputPath = path.resolve(
  __dirname,
  '../../ai-workspace-common/src/components/canvas/integration-docs/data/api-docs.generated.ts',
);

const supportedPrefixes = ['/openapi/workflow', '/openapi/webhook', '/openapi/files', '/webhook'];
const allowedMethods = new Set(['get', 'post', 'put', 'delete', 'patch']);

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

  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(content)) !== null) {
    const body = match[1];
    const codeMatch = body.match(/code\s*=\s*['"]([^'"]+)['"]/);
    if (!codeMatch) continue;
    const code = codeMatch[1];
    const dictMatch = body.match(/messageDict\s*=\s*{([\s\S]*?)}/);
    if (!dictMatch) continue;
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
};

main();
