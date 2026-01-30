import type { ApiDocsData } from '../types';

export const apiDocsData: ApiDocsData = {
  version: '0.2.0',
  generatedAt: '2026-01-30T08:35:33.709Z',
  baseUrl: '/v1',
  endpoints: [
    {
      id: 'post-openapi-files-upload',
      method: 'POST',
      path: '/openapi/files/upload',
      operationId: 'uploadOpenapiFiles',
      summary: 'Upload files for OpenAPI workflow variables',
      summaryKey: 'integration.api.openapi.filesUpload.summary',
      description:
        'Upload files and get fileKey values for workflow variables. Unused files are cleaned up after about 24 hours.',
      descriptionKey: 'integration.api.openapi.filesUpload.description',
      tags: ['workflow'],
      security: ['api_key'],
      requestBody: {
        required: true,
        contentType: 'multipart/form-data',
        schema: {
          type: 'object',
          description: 'Files to upload for workflow variables.',
          descriptionKey: 'integration.api.openapi.filesUpload.bodyDescription',
          required: ['files'],
          properties: {
            files: {
              type: 'array',
              description: 'Files to upload',
              descriptionKey: 'integration.api.openapi.filesUpload.filesDescription',
              items: {
                type: 'string',
                format: 'binary',
              },
            },
          },
        },
        example: null,
      },
      responses: {
        '200': {
          description: 'Files uploaded successfully',
          descriptionKey: 'integration.api.openapi.filesUpload.response200',
          schema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the operation was successful',
                example: true,
              },
              errCode: {
                type: 'string',
                description: 'Error code',
              },
              errMsg: {
                type: 'string',
                description: 'Error message',
                example: 'Operation failed',
              },
              traceId: {
                type: 'string',
                description: 'Trace ID',
              },
              stack: {
                type: 'string',
                description: 'Error stack (only returned in development environment)',
              },
              data: {
                type: 'object',
                required: ['files'],
                properties: {
                  files: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['fileKey', 'fileName'],
                      properties: {
                        fileKey: {
                          type: 'string',
                          description: 'File key used as workflow variable value',
                        },
                        fileName: {
                          type: 'string',
                          description: 'Original file name',
                        },
                      },
                    },
                  },
                },
              },
            },
            required: ['success'],
          },
        },
        '400': {
          description: 'Invalid request parameters',
          descriptionKey: 'integration.api.openapi.filesUpload.response400',
        },
        '401': {
          description: 'Unauthorized - invalid or missing API key',
          descriptionKey: 'integration.api.openapi.filesUpload.response401',
        },
      },
    },
    {
      id: 'post-openapi-webhook-webhookid-run',
      method: 'POST',
      path: '/openapi/webhook/{webhookId}/run',
      operationId: 'runWebhook',
      summary: 'Run workflow via webhook',
      description: 'Trigger a webhook to run the linked workflow without authentication',
      tags: ['webhook'],
      security: [],
      parameters: [
        {
          name: 'webhookId',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Webhook ID',
        },
      ],
      requestBody: {
        required: true,
        contentType: 'application/json',
        schema: {
          type: 'object',
          description:
            'Workflow variables as key-value pairs.\nYou can pass variables directly at the top level or wrap them under the "variables" field.\n',
          properties: {
            variables: {
              type: 'object',
              description: 'Workflow variables as key-value pairs.',
              additionalProperties: true,
            },
          },
          additionalProperties: true,
        },
        example: {
          variables: {
            variable1: 'Hello World',
          },
        },
      },
      responses: {
        '200': {
          description: 'Webhook triggered successfully',
          schema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the operation was successful',
                example: true,
              },
              errCode: {
                type: 'string',
                description: 'Error code',
              },
              errMsg: {
                type: 'string',
                description: 'Error message',
                example: 'Operation failed',
              },
              traceId: {
                type: 'string',
                description: 'Trace ID',
              },
              stack: {
                type: 'string',
                description: 'Error stack (only returned in development environment)',
              },
              data: {
                type: 'object',
                properties: {
                  received: {
                    type: 'boolean',
                    description: 'Whether the webhook request was accepted',
                  },
                },
              },
            },
            required: ['success'],
          },
        },
        '400': {
          description: 'Invalid request body',
        },
        '403': {
          description: 'Webhook disabled',
        },
        '404': {
          description: 'Webhook not found',
        },
      },
    },
    {
      id: 'post-openapi-workflow-canvasid-run',
      method: 'POST',
      path: '/openapi/workflow/{canvasId}/run',
      operationId: 'runWorkflowViaApi',
      summary: 'Run workflow via API (returns execution ID)',
      summaryKey: 'integration.api.openapi.workflowRun.summary',
      description:
        'Execute a workflow via authenticated API call.\nUnlike webhook triggers, this endpoint requires API Key authentication\nand returns an execution ID that can be used to track workflow status.\n',
      descriptionKey: 'integration.api.openapi.workflowRun.description',
      tags: ['workflow'],
      security: ['api_key'],
      parameters: [
        {
          name: 'canvasId',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Canvas/Workflow ID',
          descriptionKey: 'integration.api.openapi.workflowRun.paramCanvasId',
        },
      ],
      requestBody: {
        required: true,
        contentType: 'application/json',
        schema: {
          type: 'object',
          description:
            'Wrap workflow variables under the "variables" field.\nEach key in variables is a workflow variable name. Values can be strings, numbers, booleans, objects, or arrays.\nFor file variables, pass fileKey (or an array of fileKey) returned by /openapi/files/upload.\nFor backward compatibility, you may also pass variables as top-level fields, but "variables" is recommended.\n',
          descriptionKey: 'integration.api.openapi.workflowRun.bodyDescription',
          properties: {
            variables: {
              type: 'object',
              description: 'Workflow variables as key-value pairs.',
              descriptionKey: 'integration.api.openapi.workflowRun.variablesDescription',
              additionalProperties: true,
            },
          },
          additionalProperties: true,
        },
        example: {
          variables: {
            input: 'Hello workflow',
            files: ['of_xxx', 'of_yyy'],
          },
        },
      },
      responses: {
        '200': {
          description: 'Workflow execution started successfully',
          descriptionKey: 'integration.api.openapi.workflowRun.response200',
          schema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the operation was successful',
                example: true,
              },
              errCode: {
                type: 'string',
                description: 'Error code',
              },
              errMsg: {
                type: 'string',
                description: 'Error message',
                example: 'Operation failed',
              },
              traceId: {
                type: 'string',
                description: 'Trace ID',
              },
              stack: {
                type: 'string',
                description: 'Error stack (only returned in development environment)',
              },
              data: {
                type: 'object',
                properties: {
                  executionId: {
                    type: 'string',
                    description: 'Workflow execution ID for tracking status',
                  },
                  status: {
                    type: 'string',
                    description: 'Initial execution status (usually "running")',
                  },
                },
              },
            },
            required: ['success'],
          },
        },
        '400': {
          description: 'Invalid request parameters',
          descriptionKey: 'integration.api.openapi.workflowRun.response400',
        },
        '401': {
          description: 'Unauthorized - invalid or missing API key',
          descriptionKey: 'integration.api.openapi.workflowRun.response401',
        },
        '403': {
          description: 'Workflow API is disabled',
          descriptionKey: 'integration.api.openapi.workflowRun.response403',
        },
        '404': {
          description: 'Workflow not found',
          descriptionKey: 'integration.api.openapi.workflowRun.response404',
        },
      },
    },
    {
      id: 'post-openapi-workflow-executionid-abort',
      method: 'POST',
      path: '/openapi/workflow/{executionId}/abort',
      operationId: 'abortWorkflowViaApi',
      summary: 'Abort workflow execution via API',
      summaryKey: 'integration.api.openapi.workflowAbort.summary',
      description:
        'Abort a running workflow execution via authenticated API call.\nRequires API Key authentication.\n',
      descriptionKey: 'integration.api.openapi.workflowAbort.description',
      tags: ['workflow'],
      security: ['api_key'],
      parameters: [
        {
          name: 'executionId',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Workflow execution ID',
          descriptionKey: 'integration.api.openapi.workflowAbort.paramExecutionId',
        },
      ],
      responses: {
        '200': {
          description: 'Workflow abort request accepted',
          descriptionKey: 'integration.api.openapi.workflowAbort.response200',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the operation was successful',
                example: true,
              },
              errCode: {
                type: 'string',
                description: 'Error code',
              },
              errMsg: {
                type: 'string',
                description: 'Error message',
                example: 'Operation failed',
              },
              traceId: {
                type: 'string',
                description: 'Trace ID',
              },
              stack: {
                type: 'string',
                description: 'Error stack (only returned in development environment)',
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized - invalid or missing API key',
          descriptionKey: 'integration.api.openapi.workflowAbort.response401',
        },
        '404': {
          description: 'Workflow execution not found',
          descriptionKey: 'integration.api.openapi.workflowAbort.response404',
        },
      },
    },
    {
      id: 'get-openapi-workflow-executionid-output',
      method: 'GET',
      path: '/openapi/workflow/{executionId}/output',
      operationId: 'getWorkflowOutput',
      summary: 'Get workflow execution output via API',
      summaryKey: 'integration.api.openapi.workflowOutput.summary',
      description:
        'Get workflow execution output (output nodes and drive files) via authenticated API call.\nRequires API Key authentication.\n',
      descriptionKey: 'integration.api.openapi.workflowOutput.description',
      tags: ['workflow'],
      security: ['api_key'],
      parameters: [
        {
          name: 'executionId',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Workflow execution ID',
          descriptionKey: 'integration.api.openapi.workflowOutput.paramExecutionId',
        },
      ],
      responses: {
        '200': {
          description: 'Workflow execution output retrieved successfully',
          descriptionKey: 'integration.api.openapi.workflowOutput.response200',
          schema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the operation was successful',
                example: true,
              },
              errCode: {
                type: 'string',
                description: 'Error code',
              },
              errMsg: {
                type: 'string',
                description: 'Error message',
                example: 'Operation failed',
              },
              traceId: {
                type: 'string',
                description: 'Trace ID',
              },
              stack: {
                type: 'string',
                description: 'Error stack (only returned in development environment)',
              },
              data: {
                type: 'object',
                properties: {
                  output: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        nodeId: {
                          type: 'string',
                          description: 'Node ID',
                        },
                        title: {
                          type: 'string',
                          description: 'Node title',
                        },
                        status: {
                          type: 'string',
                          description: 'Action status',
                          enum: ['init', 'waiting', 'executing', 'finish', 'failed'],
                        },
                        errorMessage: {
                          type: 'string',
                          description: 'Node error message',
                        },
                        startTime: {
                          type: 'string',
                          description: 'Node execution start time',
                          format: 'date-time',
                        },
                        endTime: {
                          type: 'string',
                          description: 'Node execution end time',
                          format: 'date-time',
                        },
                        messages: {
                          type: 'array',
                          items: {
                            type: 'object',
                            description: 'Simplified action message for API',
                            required: ['messageId', 'type'],
                            properties: {
                              messageId: {
                                type: 'string',
                                description: 'Action message ID',
                              },
                              content: {
                                type: 'string',
                                description: 'Action message content',
                              },
                              reasoningContent: {
                                type: 'string',
                                description: 'Action message reasoning content',
                              },
                              type: {
                                type: 'string',
                                description: 'Action message type',
                                enum: ['ai', 'tool'],
                              },
                            },
                          },
                        },
                      },
                      required: ['nodeId'],
                    },
                  },
                  files: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['name', 'type'],
                      properties: {
                        name: {
                          type: 'string',
                          description: 'Drive file name',
                        },
                        type: {
                          type: 'string',
                          description: 'Drive file type',
                        },
                        size: {
                          type: 'number',
                          description: 'Drive file size',
                        },
                        url: {
                          type: 'string',
                          description: 'Access URL for the file',
                        },
                      },
                    },
                  },
                },
              },
            },
            required: ['success'],
          },
        },
        '401': {
          description: 'Unauthorized - invalid or missing API key',
          descriptionKey: 'integration.api.openapi.workflowOutput.response401',
        },
        '404': {
          description: 'Workflow execution not found',
          descriptionKey: 'integration.api.openapi.workflowOutput.response404',
        },
      },
    },
    {
      id: 'get-openapi-workflow-executionid-status',
      method: 'GET',
      path: '/openapi/workflow/{executionId}/status',
      operationId: 'getWorkflowStatusViaApi',
      summary: 'Get workflow execution status via API',
      summaryKey: 'integration.api.openapi.workflowStatus.summary',
      description:
        'Get workflow execution status via authenticated API call.\nRequires API Key authentication.\n',
      descriptionKey: 'integration.api.openapi.workflowStatus.description',
      tags: ['workflow'],
      security: ['api_key'],
      parameters: [
        {
          name: 'executionId',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Workflow execution ID',
          descriptionKey: 'integration.api.openapi.workflowStatus.paramExecutionId',
        },
      ],
      responses: {
        '200': {
          description: 'Workflow execution status retrieved successfully',
          descriptionKey: 'integration.api.openapi.workflowStatus.response200',
          schema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the operation was successful',
                example: true,
              },
              errCode: {
                type: 'string',
                description: 'Error code',
              },
              errMsg: {
                type: 'string',
                description: 'Error message',
                example: 'Operation failed',
              },
              traceId: {
                type: 'string',
                description: 'Trace ID',
              },
              stack: {
                type: 'string',
                description: 'Error stack (only returned in development environment)',
              },
              data: {
                type: 'object',
                properties: {
                  executionId: {
                    type: 'string',
                  },
                  status: {
                    type: 'string',
                    enum: ['init', 'executing', 'finish', 'failed'],
                  },
                  nodeExecutions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['nodeId'],
                      properties: {
                        nodeId: {
                          type: 'string',
                          description: 'Node ID',
                        },
                        status: {
                          type: 'string',
                          description: 'Action status',
                          enum: ['init', 'waiting', 'executing', 'finish', 'failed'],
                        },
                        title: {
                          type: 'string',
                          description: 'Node title',
                        },
                      },
                    },
                  },
                  createdAt: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
              },
            },
            required: ['success'],
          },
        },
        '401': {
          description: 'Unauthorized - invalid or missing API key',
          descriptionKey: 'integration.api.openapi.workflowStatus.response401',
        },
        '404': {
          description: 'Workflow execution not found',
          descriptionKey: 'integration.api.openapi.workflowStatus.response404',
        },
      },
    },
    {
      id: 'get-webhook-config',
      method: 'GET',
      path: '/webhook/config',
      operationId: 'getWebhookConfig',
      summary: 'Get webhook configuration for a canvas',
      description: 'Get webhook configuration including webhook ID and status',
      tags: ['webhook'],
      security: ['api_key'],
      parameters: [
        {
          name: 'canvasId',
          in: 'query',
          required: true,
          type: 'string',
          description: 'Canvas ID',
        },
      ],
      responses: {
        '200': {
          description: 'Webhook configuration retrieved successfully',
          schema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the operation was successful',
                example: true,
              },
              errCode: {
                type: 'string',
                description: 'Error code',
              },
              errMsg: {
                type: 'string',
                description: 'Error message',
                example: 'Operation failed',
              },
              traceId: {
                type: 'string',
                description: 'Trace ID',
              },
              stack: {
                type: 'string',
                description: 'Error stack (only returned in development environment)',
              },
              data: {
                type: 'object',
                properties: {
                  apiId: {
                    type: 'string',
                    description: 'Webhook ID',
                  },
                  isEnabled: {
                    type: 'boolean',
                    description: 'Whether webhook is enabled',
                  },
                  timeout: {
                    type: 'integer',
                    description: 'Timeout in seconds',
                  },
                },
              },
            },
            required: ['success'],
          },
        },
        '400': {
          description: 'Invalid request parameters',
        },
        '401': {
          description: 'Unauthorized',
        },
        '404': {
          description: 'Webhook not found',
        },
      },
    },
    {
      id: 'post-webhook-disable',
      method: 'POST',
      path: '/webhook/disable',
      operationId: 'disableWebhook',
      summary: 'Disable webhook',
      description: 'Disable webhook API for a canvas',
      tags: ['webhook'],
      security: ['api_key'],
      requestBody: {
        required: true,
        contentType: 'application/json',
        schema: {
          type: 'object',
          required: ['webhookId'],
          properties: {
            webhookId: {
              type: 'string',
              description: 'Webhook ID to disable',
            },
          },
        },
        example: null,
      },
      responses: {
        '200': {
          description: 'Webhook disabled successfully',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the operation was successful',
                example: true,
              },
              errCode: {
                type: 'string',
                description: 'Error code',
              },
              errMsg: {
                type: 'string',
                description: 'Error message',
                example: 'Operation failed',
              },
              traceId: {
                type: 'string',
                description: 'Trace ID',
              },
              stack: {
                type: 'string',
                description: 'Error stack (only returned in development environment)',
              },
            },
          },
        },
        '400': {
          description: 'Invalid request parameters',
        },
        '401': {
          description: 'Unauthorized',
        },
        '404': {
          description: 'Webhook not found',
        },
      },
    },
    {
      id: 'post-webhook-enable',
      method: 'POST',
      path: '/webhook/enable',
      operationId: 'enableWebhook',
      summary: 'Enable webhook for a canvas',
      description: 'Enable webhook API for a canvas to allow external triggers',
      tags: ['webhook'],
      security: ['api_key'],
      requestBody: {
        required: true,
        contentType: 'application/json',
        schema: {
          type: 'object',
          required: ['canvasId'],
          properties: {
            canvasId: {
              type: 'string',
              description: 'Canvas ID to enable webhook for',
            },
            timeout: {
              type: 'integer',
              description: 'Timeout in seconds',
            },
          },
        },
        example: null,
      },
      responses: {
        '200': {
          description: 'Webhook enabled successfully',
          schema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the operation was successful',
                example: true,
              },
              errCode: {
                type: 'string',
                description: 'Error code',
              },
              errMsg: {
                type: 'string',
                description: 'Error message',
                example: 'Operation failed',
              },
              traceId: {
                type: 'string',
                description: 'Trace ID',
              },
              stack: {
                type: 'string',
                description: 'Error stack (only returned in development environment)',
              },
              data: {
                type: 'object',
                properties: {
                  apiId: {
                    type: 'string',
                    description: 'Webhook ID',
                  },
                  webhookUrl: {
                    type: 'string',
                    description: 'Webhook URL',
                  },
                  isEnabled: {
                    type: 'boolean',
                    description: 'Whether webhook is enabled',
                  },
                },
              },
            },
            required: ['success'],
          },
        },
        '400': {
          description: 'Invalid request parameters',
        },
        '401': {
          description: 'Unauthorized',
        },
      },
    },
    {
      id: 'get-webhook-history',
      method: 'GET',
      path: '/webhook/history',
      operationId: 'getWebhookHistory',
      summary: 'Get call history for a webhook',
      description: 'Get webhook call history with pagination',
      tags: ['webhook'],
      security: ['api_key'],
      parameters: [
        {
          name: 'webhookId',
          in: 'query',
          required: true,
          type: 'string',
          description: 'Webhook ID',
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          type: 'integer',
          description: 'Page number',
        },
        {
          name: 'pageSize',
          in: 'query',
          required: false,
          type: 'integer',
          description: 'Page size',
        },
      ],
      responses: {
        '200': {
          description: 'Call history retrieved successfully',
          schema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the operation was successful',
                example: true,
              },
              errCode: {
                type: 'string',
                description: 'Error code',
              },
              errMsg: {
                type: 'string',
                description: 'Error message',
                example: 'Operation failed',
              },
              traceId: {
                type: 'string',
                description: 'Trace ID',
              },
              stack: {
                type: 'string',
                description: 'Error stack (only returned in development environment)',
              },
              data: {
                type: 'object',
                properties: {
                  records: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        recordId: {
                          type: 'string',
                          description: 'Record ID',
                        },
                        apiId: {
                          type: 'string',
                          description: 'Webhook ID',
                        },
                        canvasId: {
                          type: 'string',
                          description: 'Canvas ID',
                        },
                        workflowExecutionId: {
                          type: 'string',
                          description: 'Workflow execution ID',
                        },
                        requestUrl: {
                          type: 'string',
                          description: 'Request URL',
                        },
                        requestMethod: {
                          type: 'string',
                          description: 'Request method',
                        },
                        httpStatus: {
                          type: 'integer',
                          description: 'HTTP status code',
                        },
                        responseTime: {
                          type: 'integer',
                          description: 'Response time in milliseconds',
                        },
                        status: {
                          type: 'string',
                          description: 'Execution status',
                        },
                        failureReason: {
                          type: 'string',
                          description: 'Failure reason if failed',
                        },
                        createdAt: {
                          type: 'string',
                          description: 'Created timestamp',
                          format: 'date-time',
                        },
                        completedAt: {
                          type: 'string',
                          description: 'Completed timestamp',
                          format: 'date-time',
                        },
                      },
                    },
                  },
                  total: {
                    type: 'integer',
                    description: 'Total number of records',
                  },
                  page: {
                    type: 'integer',
                    description: 'Current page number',
                  },
                  pageSize: {
                    type: 'integer',
                    description: 'Page size',
                  },
                },
              },
            },
            required: ['success'],
          },
        },
        '400': {
          description: 'Invalid request parameters',
        },
        '401': {
          description: 'Unauthorized',
        },
        '404': {
          description: 'Webhook not found',
        },
      },
    },
    {
      id: 'post-webhook-reset',
      method: 'POST',
      path: '/webhook/reset',
      operationId: 'resetWebhook',
      summary: 'Reset webhook (generate new ID)',
      description: 'Reset webhook by generating a new webhook ID',
      tags: ['webhook'],
      security: ['api_key'],
      requestBody: {
        required: true,
        contentType: 'application/json',
        schema: {
          type: 'object',
          required: ['webhookId'],
          properties: {
            webhookId: {
              type: 'string',
              description: 'Webhook ID to reset',
            },
          },
        },
        example: null,
      },
      responses: {
        '200': {
          description: 'Webhook reset successfully',
          schema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the operation was successful',
                example: true,
              },
              errCode: {
                type: 'string',
                description: 'Error code',
              },
              errMsg: {
                type: 'string',
                description: 'Error message',
                example: 'Operation failed',
              },
              traceId: {
                type: 'string',
                description: 'Trace ID',
              },
              stack: {
                type: 'string',
                description: 'Error stack (only returned in development environment)',
              },
              data: {
                type: 'object',
                properties: {
                  apiId: {
                    type: 'string',
                    description: 'New webhook ID',
                  },
                  webhookUrl: {
                    type: 'string',
                    description: 'New webhook URL',
                  },
                },
              },
            },
            required: ['success'],
          },
        },
        '400': {
          description: 'Invalid request parameters',
        },
        '401': {
          description: 'Unauthorized',
        },
        '404': {
          description: 'Webhook not found',
        },
      },
    },
    {
      id: 'post-webhook-update',
      method: 'POST',
      path: '/webhook/update',
      operationId: 'updateWebhook',
      summary: 'Update webhook configuration',
      description: 'Update webhook configuration',
      tags: ['webhook'],
      security: ['api_key'],
      requestBody: {
        required: true,
        contentType: 'application/json',
        schema: {
          type: 'object',
          required: ['webhookId'],
          properties: {
            webhookId: {
              type: 'string',
              description: 'Webhook ID to update',
            },
            isEnabled: {
              type: 'boolean',
              description: 'Whether webhook is enabled',
            },
            timeout: {
              type: 'integer',
              description: 'Timeout in seconds',
            },
          },
        },
        example: null,
      },
      responses: {
        '200': {
          description: 'Webhook updated successfully',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the operation was successful',
                example: true,
              },
              errCode: {
                type: 'string',
                description: 'Error code',
              },
              errMsg: {
                type: 'string',
                description: 'Error message',
                example: 'Operation failed',
              },
              traceId: {
                type: 'string',
                description: 'Trace ID',
              },
              stack: {
                type: 'string',
                description: 'Error stack (only returned in development environment)',
              },
            },
          },
        },
        '400': {
          description: 'Invalid request parameters',
        },
        '401': {
          description: 'Unauthorized',
        },
        '404': {
          description: 'Webhook not found',
        },
      },
    },
  ],
  errorCodes: [
    {
      code: 'CANVAS_NOT_FOUND',
      httpStatus: 404,
      message: 'Canvas not found',
      messageI18n: {
        'zh-Hans': '画布不存在',
      },
      description: 'Associated canvas cannot be found.',
      descriptionI18n: {
        'zh-Hans': '关联画布不存在。',
      },
    },
    {
      code: 'E0000',
      httpStatus: null,
      message: 'An unknown error has occurred. Please try again later.',
      messageI18n: {
        'zh-Hans': '出现未知错误，请稍后重试。',
      },
      description: 'An unknown error has occurred. Please try again later.',
      descriptionI18n: {
        'zh-Hans': '出现未知错误，请稍后重试。',
      },
    },
    {
      code: 'E0001',
      httpStatus: null,
      message: 'Cannot connect to the server, please try again later.',
      messageI18n: {
        'zh-Hans': '无法连接到服务器，请稍后重试。',
      },
      description: 'Cannot connect to the server, please try again later.',
      descriptionI18n: {
        'zh-Hans': '无法连接到服务器，请稍后重试。',
      },
    },
    {
      code: 'E0003',
      httpStatus: null,
      message: 'System parameter error. Please try again later.',
      messageI18n: {
        'zh-Hans': '系统参数错误，请稍后重试。',
      },
      description: 'System parameter error. Please try again later.',
      descriptionI18n: {
        'zh-Hans': '系统参数错误，请稍后重试。',
      },
    },
    {
      code: 'E0004',
      httpStatus: null,
      message: 'Authorization process failed, please try again',
      messageI18n: {
        'zh-Hans': '授权过程失败，请重试',
      },
      description: 'Authorization process failed, please try again',
      descriptionI18n: {
        'zh-Hans': '授权过程失败，请重试',
      },
    },
    {
      code: 'E0005',
      httpStatus: null,
      message: 'Account not found, please sign up',
      messageI18n: {
        'zh-Hans': '账户不存在，请注册',
      },
      description: 'Account not found, please sign up',
      descriptionI18n: {
        'zh-Hans': '账户不存在，请注册',
      },
    },
    {
      code: 'E0006',
      httpStatus: null,
      message: 'Password incorrect, please try again',
      messageI18n: {
        'zh-Hans': '密码错误，请重试',
      },
      description: 'Password incorrect, please try again',
      descriptionI18n: {
        'zh-Hans': '密码错误，请重试',
      },
    },
    {
      code: 'E0007',
      httpStatus: null,
      message: 'Email already registered, please sign in or try another one',
      messageI18n: {
        'zh-Hans': '邮箱已被注册，请登录或尝试其他邮箱',
      },
      description: 'Email already registered, please sign in or try another one',
      descriptionI18n: {
        'zh-Hans': '邮箱已被注册，请登录或尝试其他邮箱',
      },
    },
    {
      code: 'E0008',
      httpStatus: null,
      message: 'Verification session not found or expired, please try again',
      messageI18n: {
        'zh-Hans': '验证会话不存在或已过期，请重试',
      },
      description: 'Verification session not found or expired, please try again',
      descriptionI18n: {
        'zh-Hans': '验证会话不存在或已过期，请重试',
      },
    },
    {
      code: 'E0009',
      httpStatus: null,
      message: 'Verification code is incorrect, please try again',
      messageI18n: {
        'zh-Hans': '验证码错误，请重试',
      },
      description: 'Verification code is incorrect, please try again',
      descriptionI18n: {
        'zh-Hans': '验证码错误，请重试',
      },
    },
    {
      code: 'E0010',
      httpStatus: null,
      message: 'Operation too frequent, please try again later',
      messageI18n: {
        'zh-Hans': '操作过于频繁，请稍后再试',
      },
      description: 'Operation too frequent, please try again later',
      descriptionI18n: {
        'zh-Hans': '操作过于频繁，请稍后再试',
      },
    },
    {
      code: 'E0011',
      httpStatus: null,
      message: 'Authentication expired, please sign in again',
      messageI18n: {
        'zh-Hans': '身份验证已过期，请重新登录',
      },
      description: 'Authentication expired, please sign in again',
      descriptionI18n: {
        'zh-Hans': '身份验证已过期，请重新登录',
      },
    },
    {
      code: 'E0012',
      httpStatus: null,
      message: 'This file type is temporarily not supported',
      messageI18n: {
        'zh-Hans': '暂不支持该文件类型',
      },
      description: 'This file type is temporarily not supported',
      descriptionI18n: {
        'zh-Hans': '暂不支持该文件类型',
      },
    },
    {
      code: 'E0013',
      httpStatus: null,
      message: 'Switching embedding model is not supported temporarily',
      messageI18n: {
        'zh-Hans': '暂不支持切换嵌入模型',
      },
      description: 'Switching embedding model is not supported temporarily',
      descriptionI18n: {
        'zh-Hans': '暂不支持切换嵌入模型',
      },
    },
    {
      code: 'E0014',
      httpStatus: null,
      message: 'Chat model not configured, please configure a chat model in the settings',
      messageI18n: {
        'zh-Hans': '未配置对话模型，请先在设置中进行配置',
      },
      description: 'Chat model not configured, please configure a chat model in the settings',
      descriptionI18n: {
        'zh-Hans': '未配置对话模型，请先在设置中进行配置',
      },
    },
    {
      code: 'E0015',
      httpStatus: null,
      message:
        'Embedding model not configured, please configure an embedding model in the settings',
      messageI18n: {
        'zh-Hans': '未配置嵌入模型，请先在设置中进行配置',
      },
      description:
        'Embedding model not configured, please configure an embedding model in the settings',
      descriptionI18n: {
        'zh-Hans': '未配置嵌入模型，请先在设置中进行配置',
      },
    },
    {
      code: 'E0016',
      httpStatus: null,
      message: 'Media provider not configured, please configure a media provider in the settings',
      messageI18n: {
        'zh-Hans': '未配置媒体提供方，请先在设置中进行配置',
      },
      description:
        'Media provider not configured, please configure a media provider in the settings',
      descriptionI18n: {
        'zh-Hans': '未配置媒体提供方，请先在设置中进行配置',
      },
    },
    {
      code: 'E0017',
      httpStatus: null,
      message: 'Media model not configured, please configure a media model in the settings',
      messageI18n: {
        'zh-Hans': '未配置媒体模型，请先在设置中进行配置',
      },
      description: 'Media model not configured, please configure a media model in the settings',
      descriptionI18n: {
        'zh-Hans': '未配置媒体模型，请先在设置中进行配置',
      },
    },
    {
      code: 'E1000',
      httpStatus: null,
      message: 'Canvas not found, please refresh',
      messageI18n: {
        'zh-Hans': '画布不存在，请刷新重试',
      },
      description: 'Canvas not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '画布不存在，请刷新重试',
      },
    },
    {
      code: 'E1002',
      httpStatus: null,
      message: 'Resource not found, please refresh',
      messageI18n: {
        'zh-Hans': '资源不存在，请刷新重试',
      },
      description: 'Resource not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '资源不存在，请刷新重试',
      },
    },
    {
      code: 'E1003',
      httpStatus: null,
      message: 'Document not found, please refresh',
      messageI18n: {
        'zh-Hans': '文档不存在，请刷新重试',
      },
      description: 'Document not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '文档不存在，请刷新重试',
      },
    },
    {
      code: 'E1004',
      httpStatus: null,
      message: 'Reference not found, please refresh',
      messageI18n: {
        'zh-Hans': '引用不存在，请刷新重试',
      },
      description: 'Reference not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '引用不存在，请刷新重试',
      },
    },
    {
      code: 'E1005',
      httpStatus: null,
      message: 'Reference object missing, please refresh',
      messageI18n: {
        'zh-Hans': '引用对象不存在，请刷新重试',
      },
      description: 'Reference object missing, please refresh',
      descriptionI18n: {
        'zh-Hans': '引用对象不存在，请刷新重试',
      },
    },
    {
      code: 'E1006',
      httpStatus: null,
      message: 'Skill not found, please refresh',
      messageI18n: {
        'zh-Hans': '技能不存在，请刷新重试',
      },
      description: 'Skill not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '技能不存在，请刷新重试',
      },
    },
    {
      code: 'E1007',
      httpStatus: null,
      message: 'Label class not found, please refresh',
      messageI18n: {
        'zh-Hans': '标签分类不存在，请刷新重试',
      },
      description: 'Label class not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '标签分类不存在，请刷新重试',
      },
    },
    {
      code: 'E1008',
      httpStatus: null,
      message: 'Label instance not found, please refresh',
      messageI18n: {
        'zh-Hans': '标签不存在，请刷新重试',
      },
      description: 'Label instance not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '标签不存在，请刷新重试',
      },
    },
    {
      code: 'E1009',
      httpStatus: null,
      message: 'Share content not found',
      messageI18n: {
        'zh-Hans': '分享内容不存在',
      },
      description: 'Share content not found',
      descriptionI18n: {
        'zh-Hans': '分享内容不存在',
      },
    },
    {
      code: 'E1011',
      httpStatus: null,
      message: 'Action result not found, please refresh',
      messageI18n: {
        'zh-Hans': '执行结果不存在，请刷新重试',
      },
      description: 'Action result not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '执行结果不存在，请刷新重试',
      },
    },
    {
      code: 'E1012',
      httpStatus: null,
      message: 'Upload file not found, please try again',
      messageI18n: {
        'zh-Hans': '上传文件不存在，请重新尝试',
      },
      description: 'Upload file not found, please try again',
      descriptionI18n: {
        'zh-Hans': '上传文件不存在，请重新尝试',
      },
    },
    {
      code: 'E1013',
      httpStatus: null,
      message: 'Code artifact not found, please refresh',
      messageI18n: {
        'zh-Hans': '代码组件不存在，请刷新重试',
      },
      description: 'Code artifact not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '代码组件不存在，请刷新重试',
      },
    },
    {
      code: 'E1014',
      httpStatus: null,
      message: 'Project not found, please refresh',
      messageI18n: {
        'zh-Hans': '项目不存在，请刷新重试',
      },
      description: 'Project not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '项目不存在，请刷新重试',
      },
    },
    {
      code: 'E1015',
      httpStatus: null,
      message: 'Provider not found, please refresh',
      messageI18n: {
        'zh-Hans': '提供方不存在，请刷新重试',
      },
      description: 'Provider not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '提供方不存在，请刷新重试',
      },
    },
    {
      code: 'E1016',
      httpStatus: null,
      message: 'Provider item not found, please refresh',
      messageI18n: {
        'zh-Hans': '提供方项目不存在，请刷新重试',
      },
      description: 'Provider item not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '提供方项目不存在，请刷新重试',
      },
    },
    {
      code: 'E1017',
      httpStatus: null,
      message: 'MCP server not found, please refresh',
      messageI18n: {
        'zh-Hans': 'MCP 服务器不存在，请刷新重试',
      },
      description: 'MCP server not found, please refresh',
      descriptionI18n: {
        'zh-Hans': 'MCP 服务器不存在，请刷新重试',
      },
    },
    {
      code: 'E1018',
      httpStatus: null,
      message: 'Canvas version not found, please refresh',
      messageI18n: {
        'zh-Hans': '画布版本不存在，请刷新重试',
      },
      description: 'Canvas version not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '画布版本不存在，请刷新重试',
      },
    },
    {
      code: 'E1019',
      httpStatus: null,
      message: 'Provider misconfiguration, please check the provider configuration',
      messageI18n: {
        'zh-Hans': '提供方配置错误，请检查提供方配置',
      },
      description: 'Provider misconfiguration, please check the provider configuration',
      descriptionI18n: {
        'zh-Hans': '提供方配置错误，请检查提供方配置',
      },
    },
    {
      code: 'E1020',
      httpStatus: null,
      message: 'Toolset not found, please refresh',
      messageI18n: {
        'zh-Hans': '工具集不存在，请刷新重试',
      },
      description: 'Toolset not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '工具集不存在，请刷新重试',
      },
    },
    {
      code: 'E1021',
      httpStatus: null,
      message: 'Workflow execution not found, please refresh',
      messageI18n: {
        'zh-Hans': '工作流执行不存在，请刷新重试',
      },
      description: 'Workflow execution not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '工作流执行不存在，请刷新重试',
      },
    },
    {
      code: 'E1022',
      httpStatus: null,
      message: 'Workflow app not found, please refresh',
      messageI18n: {
        'zh-Hans': '工作流 App 不存在，请刷新重试',
      },
      description: 'Workflow app not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '工作流 App 不存在，请刷新重试',
      },
    },
    {
      code: 'E1023',
      httpStatus: null,
      message: 'Copilot session not found, please refresh',
      messageI18n: {
        'zh-Hans': 'Copilot 会话不存在，请刷新重试',
      },
      description: 'Copilot session not found, please refresh',
      descriptionI18n: {
        'zh-Hans': 'Copilot 会话不存在，请刷新重试',
      },
    },
    {
      code: 'E1024',
      httpStatus: null,
      message: 'Drive file not found, please refresh',
      messageI18n: {
        'zh-Hans': '云盘文件不存在，请刷新重试',
      },
      description: 'Drive file not found, please refresh',
      descriptionI18n: {
        'zh-Hans': '云盘文件不存在，请刷新重试',
      },
    },
    {
      code: 'E2001',
      httpStatus: null,
      message: 'Storage quota exceeded, please upgrade your subscription',
      messageI18n: {
        'zh-Hans': '存储容量不足，请升级订阅套餐',
      },
      description: 'Storage quota exceeded, please upgrade your subscription',
      descriptionI18n: {
        'zh-Hans': '存储容量不足，请升级订阅套餐',
      },
    },
    {
      code: 'E2002',
      httpStatus: null,
      message: 'Execution failed, credit quota insufficient, please upgrade your subscription',
      messageI18n: {
        'zh-Hans': '执行失败，积分额度不足，请升级订阅套餐',
      },
      description: 'Execution failed, credit quota insufficient, please upgrade your subscription',
      descriptionI18n: {
        'zh-Hans': '执行失败，积分额度不足，请升级订阅套餐',
      },
    },
    {
      code: 'E2003',
      httpStatus: null,
      message: 'Model not supported, please select other models',
      messageI18n: {
        'zh-Hans': '不支持当前模型，请选择其他模型',
      },
      description: 'Model not supported, please select other models',
      descriptionI18n: {
        'zh-Hans': '不支持当前模型，请选择其他模型',
      },
    },
    {
      code: 'E2004',
      httpStatus: null,
      message: 'Content is too large. Maximum length is 100k characters.',
      messageI18n: {
        'zh-Hans': '内容过长。最大长度为 10 万字符。',
      },
      description: 'Content is too large. Maximum length is 100k characters.',
      descriptionI18n: {
        'zh-Hans': '内容过长。最大长度为 10 万字符。',
      },
    },
    {
      code: 'E2005',
      httpStatus: null,
      message: 'Request payload is too large. Maximum size is 100KB.',
      messageI18n: {
        'zh-Hans': '请求数据过大。最大大小为 100KB。',
      },
      description: 'Request payload is too large. Maximum size is 100KB.',
      descriptionI18n: {
        'zh-Hans': '请求数据过大。最大大小为 100KB。',
      },
    },
    {
      code: 'E3001',
      httpStatus: null,
      message: 'Model provider error, please try again later',
      messageI18n: {
        'zh-Hans': '模型提供方出错，请稍后重试',
      },
      description: 'Model provider error, please try again later',
      descriptionI18n: {
        'zh-Hans': '模型提供方出错，请稍后重试',
      },
    },
    {
      code: 'E3002',
      httpStatus: null,
      message: 'Request rate limit exceeded for the model provider. Please try again later.',
      messageI18n: {
        'zh-Hans': '已超出模型提供方请求速率限制，请稍后重试',
      },
      description: 'Request rate limit exceeded for the model provider. Please try again later.',
      descriptionI18n: {
        'zh-Hans': '已超出模型提供方请求速率限制，请稍后重试',
      },
    },
    {
      code: 'E3003',
      httpStatus: null,
      message: 'Model provider timed out, please try again later',
      messageI18n: {
        'zh-Hans': '模型提供方响应超时，请稍后重试',
      },
      description: 'Model provider timed out, please try again later',
      descriptionI18n: {
        'zh-Hans': '模型提供方响应超时，请稍后重试',
      },
    },
    {
      code: 'E3004',
      httpStatus: null,
      message: 'Action was stopped',
      messageI18n: {
        'zh-Hans': '操作已被停止',
      },
      description: 'Action was stopped',
      descriptionI18n: {
        'zh-Hans': '操作已被停止',
      },
    },
    {
      code: 'E3005',
      httpStatus: null,
      message: 'Duplication is not allowed for this shared content',
      messageI18n: {
        'zh-Hans': '此共享内容不允许被复制',
      },
      description: 'Duplication is not allowed for this shared content',
      descriptionI18n: {
        'zh-Hans': '此共享内容不允许被复制',
      },
    },
    {
      code: 'E3006',
      httpStatus: null,
      message: 'File too large for direct parsing, use execute_code tool to process it',
      messageI18n: {
        'zh-Hans': '文件过大无法直接解析，请使用 execute_code 工具处理',
      },
      description: 'File too large for direct parsing, use execute_code tool to process it',
      descriptionI18n: {
        'zh-Hans': '文件过大无法直接解析，请使用 execute_code 工具处理',
      },
    },
    {
      code: 'E3007',
      httpStatus: null,
      message:
        'The content you entered contains sensitive information. Please revise and try again.',
      messageI18n: {
        'zh-Hans': '您输入的内容包含敏感信息，请修改后重试',
      },
      description:
        'The content you entered contains sensitive information. Please revise and try again.',
      descriptionI18n: {
        'zh-Hans': '您输入的内容包含敏感信息，请修改后重试',
      },
    },
    {
      code: 'E3008',
      httpStatus: null,
      message: 'Presigned uploads are not supported by this storage backend',
      messageI18n: {
        'zh-Hans': '当前存储后端不支持预签名上传',
      },
      description: 'Presigned uploads are not supported by this storage backend',
      descriptionI18n: {
        'zh-Hans': '当前存储后端不支持预签名上传',
      },
    },
    {
      code: 'E3009',
      httpStatus: null,
      message: 'The content type is not allowed for this operation',
      messageI18n: {
        'zh-Hans': '不允许使用此内容类型进行此操作',
      },
      description: 'The content type is not allowed for this operation',
      descriptionI18n: {
        'zh-Hans': '不允许使用此内容类型进行此操作',
      },
    },
    {
      code: 'E3010',
      httpStatus: null,
      message: 'The uploaded file size does not match the expected size',
      messageI18n: {
        'zh-Hans': '上传文件大小与预期大小不匹配',
      },
      description: 'The uploaded file size does not match the expected size',
      descriptionI18n: {
        'zh-Hans': '上传文件大小与预期大小不匹配',
      },
    },
    {
      code: 'E3011',
      httpStatus: null,
      message: 'The upload session has expired, please request a new presigned URL',
      messageI18n: {
        'zh-Hans': '上传会话已过期，请重新获取预签名URL',
      },
      description: 'The upload session has expired, please request a new presigned URL',
      descriptionI18n: {
        'zh-Hans': '上传会话已过期，请重新获取预签名URL',
      },
    },
    {
      code: 'INSUFFICIENT_CREDITS',
      httpStatus: 402,
      message: 'Insufficient credits',
      messageI18n: {
        'zh-Hans': '积分不足',
      },
      description: 'Insufficient credits for this operation.',
      descriptionI18n: {
        'zh-Hans': '当前操作所需积分不足。',
      },
    },
    {
      code: 'INVALID_REQUEST_BODY',
      httpStatus: 400,
      message: 'Invalid request body',
      messageI18n: {
        'zh-Hans': '请求体非法',
      },
      description: 'Request body format is invalid.',
      descriptionI18n: {
        'zh-Hans': '请求体格式不正确。',
      },
    },
    {
      code: 'WEBHOOK_DISABLED',
      httpStatus: 403,
      message: 'Webhook disabled',
      messageI18n: {
        'zh-Hans': 'Webhook 已停用',
      },
      description: 'Webhook is disabled and cannot be triggered.',
      descriptionI18n: {
        'zh-Hans': 'Webhook 已停用，无法触发执行。',
      },
    },
    {
      code: 'WEBHOOK_NOT_FOUND',
      httpStatus: 404,
      message: 'Webhook not found',
      messageI18n: {
        'zh-Hans': 'Webhook 不存在',
      },
      description: 'Webhook does not exist or has been deleted.',
      descriptionI18n: {
        'zh-Hans': 'Webhook 不存在或已被删除。',
      },
    },
    {
      code: 'WEBHOOK_RATE_LIMITED',
      httpStatus: 429,
      message: 'Webhook rate limited',
      messageI18n: {
        'zh-Hans': 'Webhook 请求限流',
      },
      description: 'Request rate exceeds the limit.',
      descriptionI18n: {
        'zh-Hans': '请求速率超过限制。',
      },
    },
  ],
};
