// Integration types
export type IntegrationType = 'skill' | 'api' | 'webhook';

export interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  operationId: string;
  summary: string;
  summaryKey?: string;
  description: string;
  descriptionKey?: string;
  tags: string[];
  security: ('api_key' | 'bearerAuth')[];
  parameters?: ApiParameter[];
  requestBody?: {
    required: boolean;
    contentType: string;
    content?: Record<string, { schema?: SchemaObject }>;
    schema: SchemaObject;
    example?: Record<string, unknown>;
  };
  responses: {
    [statusCode: string]: {
      description: string;
      descriptionKey?: string;
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
  descriptionKey?: string;
  example?: unknown;
}

export interface SchemaObject {
  type: string;
  format?: string;
  enum?: string[];
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  items?: SchemaObject;
  additionalProperties?: boolean | SchemaObject;
  description?: string;
  descriptionKey?: string;
  example?: unknown;
}

export interface SchemaProperty {
  type: string;
  format?: string;
  description?: string;
  descriptionKey?: string;
  example?: unknown;
  enum?: string[];
  items?: SchemaObject;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | SchemaObject;
}

export interface ErrorCode {
  code: string;
  httpStatus: number | null;
  message: string;
  messageI18n?: Record<string, string>;
  description: string;
  descriptionI18n?: Record<string, string>;
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
