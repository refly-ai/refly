import type { ApiDocsData } from '../types';

export const apiDocsData: ApiDocsData = {
  version: '0.2.0',
  generatedAt: '2026-01-29T15:29:33.447Z',
  baseUrl: '/v1',
  endpoints: [
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
          description: 'Workflow variables as key-value pairs',
          additionalProperties: true,
        },
        example: {
          variable1: 'Hello World',
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
      description:
        'Execute a workflow via authenticated API call.\nUnlike webhook triggers, this endpoint requires API Key authentication\nand returns an execution ID that can be used to track workflow status.\n',
      tags: ['workflow'],
      security: ['api_key'],
      parameters: [
        {
          name: 'canvasId',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Canvas/Workflow ID',
        },
      ],
      requestBody: {
        required: true,
        contentType: 'application/json',
        schema: {
          type: 'object',
          description: 'Workflow variables as key-value pairs',
          additionalProperties: true,
        },
        example: null,
      },
      responses: {
        '200': {
          description: 'Workflow execution started successfully',
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
        },
        '401': {
          description: 'Unauthorized - invalid or missing API key',
        },
        '403': {
          description: 'Workflow API is disabled',
        },
        '404': {
          description: 'Workflow not found',
        },
      },
    },
    {
      id: 'get-openapi-workflow-executionid-detail',
      method: 'GET',
      path: '/openapi/workflow/{executionId}/detail',
      operationId: 'getWorkflowDetailViaApi',
      summary: 'Get workflow execution detail via API',
      description:
        'Get workflow execution detail with node executions via authenticated API call.\nRequires API Key authentication.\n',
      tags: ['workflow'],
      security: ['api_key'],
      parameters: [
        {
          name: 'executionId',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Workflow execution ID',
        },
      ],
      responses: {
        '200': {
          description: 'Workflow execution detail retrieved successfully',
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
                  canvasId: {
                    type: 'string',
                  },
                  title: {
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
                        },
                        endTime: {
                          type: 'string',
                          description: 'Node execution end time',
                        },
                      },
                    },
                  },
                  createdAt: {
                    type: 'string',
                  },
                },
              },
            },
            required: ['success'],
          },
        },
        '401': {
          description: 'Unauthorized - invalid or missing API key',
        },
        '404': {
          description: 'Workflow execution not found',
        },
      },
    },
    {
      id: 'get-openapi-workflow-executionid-output',
      method: 'GET',
      path: '/openapi/workflow/{executionId}/output',
      operationId: 'getWorkflowOutput',
      summary: 'Get workflow execution output via API',
      description:
        'Get workflow execution output (products and drive files) via authenticated API call.\nRequires API Key authentication.\n',
      tags: ['workflow'],
      security: ['api_key'],
      parameters: [
        {
          name: 'executionId',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Workflow execution ID',
        },
      ],
      responses: {
        '200': {
          description: 'Workflow execution output retrieved successfully',
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
                  products: {
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
                        },
                        endTime: {
                          type: 'string',
                          description: 'Node execution end time',
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
                              toolCallResult: {
                                type: 'object',
                                description: 'Simplified tool call result for API',
                                properties: {
                                  toolName: {
                                    type: 'string',
                                    description: 'Tool name',
                                  },
                                  input: {
                                    type: 'object',
                                    description: 'Tool input',
                                  },
                                  output: {
                                    type: 'object',
                                    description: 'Tool output',
                                  },
                                  error: {
                                    type: 'string',
                                    description: 'Tool execution error',
                                  },
                                  status: {
                                    type: 'string',
                                    description: 'Tool execution status',
                                    enum: ['executing', 'completed', 'failed'],
                                  },
                                  createdAt: {
                                    type: 'number',
                                    description: 'Tool call creation timestamp',
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      required: ['nodeId'],
                    },
                  },
                  driveFiles: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['fileId', 'canvasId', 'name', 'type'],
                      properties: {
                        fileId: {
                          type: 'string',
                          description: 'Drive file ID',
                        },
                        canvasId: {
                          type: 'string',
                          description: 'Canvas ID',
                        },
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
                        createdAt: {
                          type: 'string',
                          description: 'Drive file creation timestamp',
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
        },
        '404': {
          description: 'Workflow execution not found',
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
                  resultNodeIds: {
                    type: 'array',
                    description: 'Result node IDs',
                    items: {
                      type: 'string',
                    },
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
            resultNodeIds: {
              type: 'array',
              description: 'Optional array of result node IDs',
              items: {
                type: 'string',
              },
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
                        },
                        completedAt: {
                          type: 'string',
                          description: 'Completed timestamp',
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
  ],
  errorCodes: [
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
  ],
};
