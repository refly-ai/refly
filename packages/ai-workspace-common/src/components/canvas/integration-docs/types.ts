// Integration types
export type IntegrationType = 'skill' | 'api' | 'webhook';

export interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  security: ('api_key' | 'bearerAuth')[];
  parameters?: ApiParameter[];
  requestBody?: {
    required: boolean;
    contentType: string;
    schema: SchemaObject;
    example?: Record<string, unknown>;
  };
  responses: {
    [statusCode: string]: {
      description: string;
      schema?: SchemaObject;
      example?: Record<string, unknown>;
    };
  };
  errorCodes?: ErrorCode[];
}

export interface ApiParameter {
  name: string;
  in: 'query' | 'path' | 'header';
  required: boolean;
  type: string;
  description: string;
  example?: unknown;
}

export interface SchemaObject {
  type: string;
  enum?: string[];
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  items?: SchemaObject;
  additionalProperties?: boolean | SchemaObject;
  description?: string;
  example?: unknown;
}

export interface SchemaProperty {
  type: string;
  description?: string;
  example?: unknown;
  enum?: string[];
  items?: SchemaObject;
  properties?: Record<string, SchemaProperty>;
}

export interface ErrorCode {
  code: string;
  httpStatus: number;
  message: string;
  description: string;
}

export interface ApiDocsData {
  version: string;
  generatedAt: string;
  baseUrl: string;
  endpoints: ApiEndpoint[];
  errorCodes: ErrorCode[];
}

export interface CodeExamples {
  curl: string;
  python: string;
  javascript: string;
}

export interface ApiKeyInfo {
  keyId: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt?: string | null;
}
