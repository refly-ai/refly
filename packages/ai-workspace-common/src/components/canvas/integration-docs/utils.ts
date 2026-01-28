import { serverOrigin } from '@refly/ui-kit';
import type { ApiEndpoint, CodeExamples, SchemaObject } from './types';

const toUpperSnake = (value: string) => {
  return value
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toUpperCase();
};

export const getApiBaseUrl = (baseUrl: string) => {
  const origin = serverOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!baseUrl) return origin;
  return `${origin}${baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`}`;
};

export const formatPathWithPlaceholders = (path: string, params?: Record<string, string>) => {
  return path.replace(/\{([^}]+)\}/g, (_match, name) => {
    if (params?.[name]) {
      return params[name];
    }
    return `YOUR_${toUpperSnake(name)}`;
  });
};

export const generateExampleFromSchema = (schema?: SchemaObject | null): unknown => {
  if (!schema) return null;
  if (schema.example !== undefined) return schema.example;

  switch (schema.type) {
    case 'string':
      return schema.enum?.[0] ?? '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return true;
    case 'array':
      return [generateExampleFromSchema(schema.items) ?? {}];
    case 'object': {
      const result: Record<string, unknown> = {};
      if (schema.properties) {
        for (const [key, value] of Object.entries(schema.properties)) {
          result[key] = generateExampleFromSchema(value as SchemaObject);
        }
        return result;
      }
      if (schema.additionalProperties && schema.additionalProperties !== true) {
        return { key: generateExampleFromSchema(schema.additionalProperties as SchemaObject) };
      }
      return {};
    }
    default:
      return null;
  }
};

export const buildHeaders = (endpoint: ApiEndpoint, apiKey?: string, hasBody?: boolean) => {
  const headers: Record<string, string> = {};
  const requiresAuth =
    endpoint.security?.includes('api_key') || endpoint.security?.includes('bearerAuth');
  if (requiresAuth) {
    headers.Authorization = `Bearer ${apiKey || 'YOUR_API_KEY'}`;
  }
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

export const generateCodeExamples = (
  endpoint: ApiEndpoint,
  baseUrl: string,
  apiKey?: string,
  pathParams?: Record<string, string>,
): CodeExamples => {
  const url = `${baseUrl}${formatPathWithPlaceholders(endpoint.path, pathParams)}`;
  const bodyExample =
    endpoint.requestBody?.example ?? generateExampleFromSchema(endpoint.requestBody?.schema);
  const hasBody = endpoint.method !== 'GET' && bodyExample !== null && bodyExample !== undefined;
  const headers = buildHeaders(endpoint, apiKey, hasBody);
  const bodyString = hasBody ? JSON.stringify(bodyExample, null, 2) : '';

  let curl = `curl -X ${endpoint.method} ${url}`;
  for (const [key, value] of Object.entries(headers)) {
    curl += ` \\\n  -H "${key}: ${value}"`;
  }
  if (hasBody) {
    const escapedBody = bodyString.replace(/'/g, "\\'");
    curl += ` \\\n  -d '${escapedBody}'`;
  }

  const pythonHeaders = Object.keys(headers).length
    ? JSON.stringify(headers, null, 2).replace(/"/g, "'")
    : '{}';
  const pythonBody = hasBody ? bodyString.replace(/"/g, "'") : '{}';
  const pythonMethod = endpoint.method.toLowerCase();

  const python = `import requests\n\nurl = "${url}"\nheaders = ${pythonHeaders}\ndata = ${pythonBody}\nresponse = requests.${pythonMethod}(url, headers=headers${hasBody ? ', json=data' : ''})\nprint(response.json())`;

  const jsHeaders = Object.keys(headers).length ? JSON.stringify(headers, null, 2) : '{}';
  const javascript = `const response = await fetch("${url}", {\n  method: "${endpoint.method}",\n  headers: ${jsHeaders}${hasBody ? `,\n  body: JSON.stringify(${bodyString})` : ''}\n});\nconst data = await response.json();\nconsole.log(data);`;

  return { curl, python, javascript };
};
