import { serverOrigin } from '@refly/ui-kit';
import type { WorkflowVariable, VariableValue } from '@refly/openapi-schema';
import type { ApiEndpoint, CodeExamples, SchemaObject } from './types';

const endpointCategoryOrder = ['workflow', 'files', 'webhook', 'copilot', 'other'];

const getEndpointCategoryKey = (endpoint: ApiEndpoint): string => {
  const path = endpoint.path || '';
  if (path.startsWith('/openapi/workflow/') || path.startsWith('/openapi/workflows')) {
    return 'workflow';
  }
  if (path.startsWith('/openapi/files')) {
    return 'files';
  }
  if (path.startsWith('/openapi/webhook/')) {
    return 'webhook';
  }
  if (path.startsWith('/openapi/copilot/')) {
    return 'copilot';
  }
  return 'other';
};

export const groupApiEndpoints = (endpoints: ApiEndpoint[]) => {
  const groups = new Map<string, ApiEndpoint[]>();
  for (const endpoint of endpoints) {
    const key = getEndpointCategoryKey(endpoint);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(endpoint);
  }

  const ordered: Array<{ key: string; endpoints: ApiEndpoint[] }> = [];
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

type SchemaField = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  descriptionKey?: string;
};

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

const formatPathWithPlaceholders = (path: string, params?: Record<string, string>) => {
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
  if (schema.format === 'binary') return '<binary>';

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

const buildMultipartSampleValue = (schema?: SchemaObject): string => {
  if (!schema) return '';
  if (schema.format === 'binary') return '@/path/to/file';
  if (schema.type === 'string') return schema.enum?.[0] ?? 'value';
  if (schema.type === 'number' || schema.type === 'integer') return '0';
  if (schema.type === 'boolean') return 'true';
  if (schema.type === 'array') {
    if ((schema.items as SchemaObject | undefined)?.format === 'binary') {
      return '@/path/to/file';
    }
    return '[]';
  }
  if (schema.type === 'object') return '{}';
  return 'value';
};

export const buildMultipartFormExample = (schema?: SchemaObject | null): string => {
  if (!schema || schema.type !== 'object') return '';
  const lines: string[] = [];
  const properties = schema.properties ?? {};
  for (const [key, value] of Object.entries(properties)) {
    const prop = value as SchemaObject;
    if (prop.type === 'array' && (prop.items as SchemaObject | undefined)?.format === 'binary') {
      lines.push(`${key}: @/path/to/file1`);
      lines.push(`${key}: @/path/to/file2`);
      continue;
    }
    lines.push(`${key}: ${buildMultipartSampleValue(prop)}`);
  }

  if (!lines.length && schema.additionalProperties) {
    lines.push(`field: ${buildMultipartSampleValue(undefined)}`);
  }
  return lines.join('\n');
};

type MultipartField = {
  name: string;
  value: string;
  isFile: boolean;
};

const sampleFilePaths = ['/path/to/file1.pdf', '/path/to/file2.txt'];

const buildMultipartFields = (schema?: SchemaObject | null): MultipartField[] => {
  if (!schema || schema.type !== 'object') {
    return [{ name: 'files', value: sampleFilePaths[0], isFile: true }];
  }

  const fields: MultipartField[] = [];
  const properties = schema.properties ?? {};
  for (const [key, value] of Object.entries(properties)) {
    const prop = value as SchemaObject;
    if (prop.type === 'array' && (prop.items as SchemaObject | undefined)?.format === 'binary') {
      for (const filePath of sampleFilePaths) {
        fields.push({ name: key, value: filePath, isFile: true });
      }
      continue;
    }
    if (prop.format === 'binary') {
      fields.push({ name: key, value: sampleFilePaths[0], isFile: true });
      continue;
    }
    const rawValue = buildMultipartSampleValue(prop);
    const cleanedValue = rawValue.startsWith('@') ? rawValue.slice(1) : rawValue;
    fields.push({ name: key, value: cleanedValue, isFile: false });
  }

  if (!fields.length && schema.additionalProperties) {
    fields.push({ name: 'field', value: 'value', isFile: false });
  }

  return fields;
};

const formatSchemaType = (schema?: SchemaObject): string => {
  if (!schema) return 'unknown';
  if (schema.type === 'array') {
    const itemType = formatSchemaType(schema.items);
    return `${itemType}[]`;
  }
  if (schema.enum?.length) {
    return schema.enum.join(' | ');
  }
  if (schema.type) return schema.type;
  if (schema.properties) return 'object';
  return 'unknown';
};

const fileKeyPlaceholders = ['of_xxx', 'of_yyy', 'of_zzz'];

const getFileKeyPlaceholder = (index: number) => {
  return fileKeyPlaceholders[index] ?? `of_example_${index + 1}`;
};

const extractTextValues = (values: VariableValue[] | undefined) => {
  if (!Array.isArray(values)) return [];
  return values.map((value) => value.text).filter((value): value is string => !!value);
};

const buildVariableExampleValue = (variable: WorkflowVariable): unknown => {
  const isSingle = variable.isSingle !== false;
  const values = Array.isArray(variable.value) ? variable.value : [];

  if (variable.variableType === 'resource') {
    if (isSingle) {
      return values.length > 0 ? getFileKeyPlaceholder(0) : '';
    }
    if (values.length === 0) return [];
    return values.map((_value, index) => getFileKeyPlaceholder(index));
  }

  const textValues = extractTextValues(values);
  if (!isSingle) {
    return textValues.length > 0 ? textValues : [];
  }
  return textValues[0] ?? '';
};

export const buildWorkflowVariablesExample = (variables: WorkflowVariable[]) => {
  const example: Record<string, unknown> = {};
  for (const variable of variables) {
    example[variable.name] = buildVariableExampleValue(variable);
  }
  return example;
};

export const buildRunRequestExample = (variables: WorkflowVariable[]) => {
  return {
    variables: buildWorkflowVariablesExample(variables),
  };
};

export const extractSchemaFields = (
  schema?: SchemaObject | null,
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

  const walk = (node: SchemaObject, prefix = '') => {
    const required = new Set(node.required ?? []);
    if (!node.properties) return;
    for (const [key, value] of Object.entries(node.properties)) {
      const prop = value as SchemaObject;
      const name = prefix ? `${prefix}.${key}` : key;
      fields.push({
        name,
        type: formatSchemaType(prop),
        required: required.has(key),
        description: prop.description ?? '',
        descriptionKey: prop.descriptionKey,
      });
      if (prop.properties) {
        walk(prop, name);
      } else if (prop.type === 'array' && prop.items && (prop.items as SchemaObject).properties) {
        walk(prop.items as SchemaObject, `${name}[]`);
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
      const additionalSchema = schema.additionalProperties as SchemaObject;
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

export const extractRequestBodyFields = (
  schema?: SchemaObject | null,
  options?: {
    wildcard?: {
      name: string;
      type: string;
      description: string;
    };
  },
): SchemaField[] => extractSchemaFields(schema, options);

const buildHeaders = (endpoint: ApiEndpoint, apiKey?: string, hasBody?: boolean) => {
  const headers: Record<string, string> = {};
  const requiresAuth =
    endpoint.security?.includes('api_key') || endpoint.security?.includes('bearerAuth');
  if (requiresAuth) {
    headers.Authorization = `Bearer ${apiKey ?? 'REFLY_API_KEY'}`;
  }
  if (hasBody) {
    // Derive Content-Type from endpoint.requestBody?.content (OpenAPI 3.0 style)
    // or fall back to endpoint.requestBody?.contentType
    let contentType = 'application/json'; // default fallback

    if (endpoint.requestBody?.content) {
      // Get the first available media type from the content object
      const mediaTypes = Object.keys(endpoint.requestBody.content);
      if (mediaTypes.length > 0) {
        contentType = mediaTypes[0];
      }
    } else if (endpoint.requestBody?.contentType) {
      // Fall back to the legacy contentType field
      contentType = endpoint.requestBody.contentType;
    }

    headers['Content-Type'] = contentType;
  }
  return headers;
};

const generateMultipartCodeExamples = (
  endpoint: ApiEndpoint,
  url: string,
  apiKey?: string,
): CodeExamples => {
  const headers = buildHeaders(endpoint, apiKey, false);
  const fields = buildMultipartFields(endpoint.requestBody?.schema);
  const dataFields = fields.filter((field) => !field.isFile);
  const fileFields = fields.filter((field) => field.isFile);

  let curl = `curl -X ${endpoint.method} ${url}`;
  for (const [key, value] of Object.entries(headers)) {
    curl += ` \\\n  -H "${key}: ${value}"`;
  }
  for (const field of dataFields) {
    curl += ` \\\n  -F "${field.name}=${field.value}"`;
  }
  for (const field of fileFields) {
    curl += ` \\\n  -F "${field.name}=@${field.value}"`;
  }

  const pythonHeaders = Object.keys(headers).length
    ? JSON.stringify(headers, null, 2).replace(/"/g, "'")
    : '{}';
  const pythonFiles = fileFields.length
    ? `[\n${fileFields
        .map((field) => `    ("${field.name}", open("${field.value}", "rb"))`)
        .join(',\n')}\n]`
    : '[]';
  const pythonData = dataFields.length
    ? `{\n${dataFields.map((field) => `    "${field.name}": "${field.value}"`).join(',\n')}\n}`
    : '{}';

  const python = `import requests\n\nurl = "${url}"\nheaders = ${pythonHeaders}\nfiles = ${pythonFiles}\ndata = ${pythonData}\nresponse = requests.${endpoint.method.toLowerCase()}(url, headers=headers, files=files, data=data)\nprint(response.json())`;

  const jsFileAppends = fileFields
    .map((field) => `form.append("${field.name}", fs.createReadStream("${field.value}"));`)
    .join('\n');
  const jsDataAppends = dataFields
    .map((field) => `form.append("${field.name}", "${field.value}");`)
    .join('\n');
  const headerPairs = Object.entries(headers)
    .map(([key, value]) => `"${key}": "${value}"`)
    .join(', ');
  const jsHeaders = headerPairs
    ? `const headers = { ...form.getHeaders(), ${headerPairs} };`
    : 'const headers = form.getHeaders();';

  const javascript = `import fs from "node:fs";
import FormData from "form-data";

const url = "${url}";
const form = new FormData();
${jsFileAppends}
${jsDataAppends}
${jsHeaders}

const response = await fetch(url, { method: "${endpoint.method}", headers, body: form });
const data = await response.json();
console.log(data);`;

  return { curl, python, javascript };
};

export const generateCodeExamples = (
  endpoint: ApiEndpoint,
  baseUrl: string,
  apiKey?: string,
  pathParams?: Record<string, string>,
  bodyExampleOverride?: unknown,
): CodeExamples => {
  const url = `${baseUrl}${formatPathWithPlaceholders(endpoint.path, pathParams)}`;
  const isMultipart = endpoint.requestBody?.contentType?.startsWith('multipart/');
  if (isMultipart) {
    return generateMultipartCodeExamples(endpoint, url, apiKey);
  }
  const bodyExample =
    bodyExampleOverride ??
    endpoint.requestBody?.example ??
    generateExampleFromSchema(endpoint.requestBody?.schema);
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

type BestPracticesCommentText = {
  upload: string;
  run: string;
  poll: string;
  output: string;
};

export const generateBestPracticesExamples = (
  baseUrl: string,
  canvasId: string | undefined,
  apiKey: string | undefined,
  comments: BestPracticesCommentText,
): CodeExamples => {
  const safeCanvasId = canvasId || 'YOUR_CANVAS_ID';
  const safeApiKey = apiKey || 'REFLY_API_KEY';
  const buildComment = (prefix: string, text: string) => `${prefix} ${text}`;

  const curl = `API_BASE_URL="${baseUrl}"
CANVAS_ID="${safeCanvasId}"
API_KEY="${safeApiKey}"

${buildComment('#', comments.upload)}
UPLOAD=$(curl -s -X POST "$API_BASE_URL/openapi/files/upload" \\
  -H "Authorization: Bearer $API_KEY" \\
  -F "files=@/path/to/file1.pdf" \\
  -F "files=@/path/to/file2.txt")
FILE_KEY_1=$(echo "$UPLOAD" | jq -r ".data.files[0].fileKey")
FILE_KEY_2=$(echo "$UPLOAD" | jq -r ".data.files[1].fileKey")

${buildComment('#', comments.run)}
RUN=$(curl -s -X POST "$API_BASE_URL/openapi/workflow/$CANVAS_ID/run" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"variables":{"input":"Hello workflow","files":["'"$FILE_KEY_1"'","'"$FILE_KEY_2"'"]}}')
EXECUTION_ID=$(echo "$RUN" | jq -r ".data.executionId")

${buildComment('#', comments.poll)}
STATUS="executing"
while [ "$STATUS" = "executing" ]; do
  sleep 2
  STATUS=$(curl -s -X GET "$API_BASE_URL/openapi/workflow/$EXECUTION_ID/status" \\
    -H "Authorization: Bearer $API_KEY" | jq -r ".data.status")
done
echo "Final status: $STATUS"

${buildComment('#', comments.output)}
curl -s -X GET "$API_BASE_URL/openapi/workflow/$EXECUTION_ID/output" \\
  -H "Authorization: Bearer $API_KEY" | jq`;

  const python = `import time
import requests

API_BASE_URL = "${baseUrl}"
API_KEY = "${safeApiKey}"
CANVAS_ID = "${safeCanvasId}"

${buildComment('#', comments.upload)}
files = [
    ("files", open("./file1.pdf", "rb")),
    ("files", open("./file2.txt", "rb")),
]
upload_res = requests.post(
    f"{API_BASE_URL}/openapi/files/upload",
    headers={"Authorization": f"Bearer {API_KEY}"},
    files=files,
)
upload_data = upload_res.json()
file_keys = [item["fileKey"] for item in upload_data["data"]["files"]]

${buildComment('#', comments.run)}
run_res = requests.post(
    f"{API_BASE_URL}/openapi/workflow/{CANVAS_ID}/run",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"variables": {"input": "Hello workflow", "files": file_keys}},
)
execution_id = run_res.json()["data"]["executionId"]

${buildComment('#', comments.poll)}
status = "executing"
while status == "executing":
    time.sleep(2)
    status_res = requests.get(
        f"{API_BASE_URL}/openapi/workflow/{execution_id}/status",
        headers={"Authorization": f"Bearer {API_KEY}"},
    )
    status = status_res.json()["data"]["status"]

print("Final status:", status)

${buildComment('#', comments.output)}
output_res = requests.get(
    f"{API_BASE_URL}/openapi/workflow/{execution_id}/output",
    headers={"Authorization": f"Bearer {API_KEY}"},
)
print(output_res.json())`;

  const javascript = `import fs from "node:fs";
import FormData from "form-data";
import fetch from "node-fetch";

const API_BASE_URL = "${baseUrl}";
const API_KEY = "${safeApiKey}";
const CANVAS_ID = "${safeCanvasId}";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

${buildComment('//', comments.upload)}
const form = new FormData();
form.append("files", fs.createReadStream("./file1.pdf"));
form.append("files", fs.createReadStream("./file2.txt"));
const uploadRes = await fetch(\`\${API_BASE_URL}/openapi/files/upload\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${API_KEY}\`,
    ...form.getHeaders(),
  },
  body: form,
});
const uploadJson = await uploadRes.json();
const fileKeys = uploadJson.data.files.map((item) => item.fileKey);

${buildComment('//', comments.run)}
const runRes = await fetch(\`\${API_BASE_URL}/openapi/workflow/\${CANVAS_ID}/run\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ variables: { input: "Hello workflow", files: fileKeys } }),
});
const runJson = await runRes.json();
const executionId = runJson.data.executionId;

${buildComment('//', comments.poll)}
let status = "executing";
while (status === "executing") {
  await sleep(2000);
  const statusRes = await fetch(
    \`\${API_BASE_URL}/openapi/workflow/\${executionId}/status\`,
    { headers: { Authorization: \`Bearer \${API_KEY}\` } },
  );
  const statusJson = await statusRes.json();
  status = statusJson.data.status;
}
console.log("Final status:", status);

${buildComment('//', comments.output)}
const outputRes = await fetch(
  \`\${API_BASE_URL}/openapi/workflow/\${executionId}/output\`,
  { headers: { Authorization: \`Bearer \${API_KEY}\` } },
);
const outputJson = await outputRes.json();
console.log(outputJson);`;

  return { curl, python, javascript };
};
