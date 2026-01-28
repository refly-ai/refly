import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const schemaPath = path.resolve(__dirname, '../schema.yml');
const outputPath = path.resolve(
  __dirname,
  '../../ai-workspace-common/src/components/canvas/integration-docs/data/api-docs.generated.ts',
);

const supportedPrefixes = ['/openapi/workflow', '/openapi/webhook', '/webhook'];
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
        return {
          name: param.name,
          in: param.in,
          required: !!param.required,
          type: paramSchema.type || 'string',
          description: param.description || '',
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
        responses[status] = {
          description: (response as any).description || '',
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
        description: op.description || '',
        tags: op.tags || [],
        security,
        ...(normalizedParams.length ? { parameters: normalizedParams } : {}),
        ...(requestBody ? { requestBody } : {}),
        responses,
      });
    }
  }

  endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  const errorCodes = [
    {
      code: 'WEBHOOK_NOT_FOUND',
      httpStatus: 404,
      message: 'Webhook not found',
      description: 'Webhook does not exist or has been deleted.',
    },
    {
      code: 'WEBHOOK_DISABLED',
      httpStatus: 403,
      message: 'Webhook disabled',
      description: 'Webhook is disabled and cannot be triggered.',
    },
    {
      code: 'WEBHOOK_RATE_LIMITED',
      httpStatus: 429,
      message: 'Webhook rate limited',
      description: 'Request rate exceeds the limit.',
    },
    {
      code: 'INVALID_REQUEST_BODY',
      httpStatus: 400,
      message: 'Invalid request body',
      description: 'Request body format is invalid.',
    },
    {
      code: 'CANVAS_NOT_FOUND',
      httpStatus: 404,
      message: 'Canvas not found',
      description: 'Associated canvas cannot be found.',
    },
    {
      code: 'INSUFFICIENT_CREDITS',
      httpStatus: 402,
      message: 'Insufficient credits',
      description: 'Insufficient credits for this operation.',
    },
  ];

  return { endpoints, errorCodes };
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
