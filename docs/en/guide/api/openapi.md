<!-- AUTO-GENERATED: DO NOT EDIT -->

# API Documentation

Access Refly open capabilities via API, such as running workflows and fetching status/output.

**Base URL**: `https://api.refly.ai/v1`

## Overview
Refly API provides RESTful endpoints for programmatically running workflows, uploading files, querying execution status, and more. All API requests require authentication via API Key.

## Authentication
All API requests require an API Key in the HTTP header for authentication.\n\n**How to get an API Key**:\n\n1. Visit https://refly.ai/workspace and enter any workflow.\n\n   ![Enter Workflow Example](https://static.refly.ai/static/20260205-114458.jpeg)\n\n2. Click the "Integration" button in the top right corner.\n\n   ![Click Integration Button Example](https://static.refly.ai/static/screenshot-20260205-114520.png)\n\n3. Click the "API Key" tab, then click "Create new API Key" and keep it secure.\n\n   ![Create API Key Example](https://static.refly.ai/static/screenshot-20260205-114548.png)\n\n**Header Example**:

`Authorization: Bearer YOUR_API_KEY`

## Endpoints
The following endpoints are available for integration.

### Workflow

<a id="api-endpoint-runWorkflowViaApi"></a>
#### POST /openapi/workflow/{canvasId}/run

**Run workflow**

Execute a workflow via authenticated API call. Unlike webhook triggers, this endpoint requires API Key authentication and returns an execution ID that can be used to track workflow status.

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| canvasId | path | string | Yes | Canvas/Workflow ID (from the canvas URL in the browser address bar) |

**Request Body**

Wrap workflow variables under the `variables` field.

Each key in variables is a workflow variable name. Values can be strings, numbers, booleans, objects, or arrays.

For file variables, pass `fileKey` (or an array of `fileKey`) returned by `/openapi/files/upload`.

For backward compatibility, you may also pass variables as top-level fields, but `variables` is recommended.

**Request Body Fields**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| variables | object | No | Workflow variables as key-value pairs. Each key is a workflow variable name. Values can be strings, numbers, booleans, objects, or arrays. For file variables, pass fileKey (or an array of fileKey) returned by /openapi/files/upload. |

**Request Body Example**

```json
{}
```

**Responses**

| Status | Description |
| --- | --- |
| 200 | Workflow execution started successfully |
| 400 | Invalid request parameters |
| 401 | Unauthorized - invalid or missing API key |
| 403 | Workflow API is disabled |
| 404 | Workflow not found |

**Response Fields (200)**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| success | boolean | Yes | Whether the operation was successful |
| errCode | string | No | Error code |
| errMsg | string | No | Error message |
| traceId | string | No | Trace ID |
| stack | string | No | Error stack (only returned in development environment) |
| data | object | No | - |
| data.executionId | string | No | Workflow execution ID |
| data.status | enum(init \| executing \| finish \| failed) | No | - |

<a id="api-endpoint-abortWorkflowViaApi"></a>
#### POST /openapi/workflow/{executionId}/abort

**Abort workflow execution**

Abort a running workflow execution via authenticated API call. Requires API Key authentication.

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| executionId | path | string | Yes | Workflow execution ID (from run response or status endpoint) |

**Responses**

| Status | Description |
| --- | --- |
| 200 | Workflow abort request accepted |
| 401 | Unauthorized - invalid or missing API key |
| 404 | Workflow execution not found |

**Response Fields (200)**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| success | boolean | Yes | Whether the operation was successful |
| errCode | string | No | Error code |
| errMsg | string | No | Error message |
| traceId | string | No | Trace ID |
| stack | string | No | Error stack (only returned in development environment) |

<a id="api-endpoint-getWorkflowOutput"></a>
#### GET /openapi/workflow/{executionId}/output

**Get workflow execution output**

Get workflow execution output (output nodes and drive files) via authenticated API call. Requires API Key authentication. Messages may include partial content while nodes are executing or failed. Files are returned only after nodes finish.

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| executionId | path | string | Yes | Workflow execution ID |

**Responses**

| Status | Description |
| --- | --- |
| 200 | Workflow execution output retrieved successfully |
| 401 | Unauthorized - invalid or missing API key |
| 404 | Workflow execution not found |

**Response Fields (200)**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| success | boolean | Yes | Whether the operation was successful |
| errCode | string | No | Error code |
| errMsg | string | No | Error message |
| traceId | string | No | Trace ID |
| stack | string | No | Error stack (only returned in development environment) |
| data | object | No | - |
| data.output | object[] | No | Output node results |
| data.output[].nodeId | string | Yes | Node ID |
| data.output[].title | string | No | Node title |
| data.output[].status | enum(init \| waiting \| executing \| finish \| failed) | No | Action status |
| data.output[].errorMessage | string | No | Node error message |
| data.output[].startTime | string(date-time) | No | Node start time |
| data.output[].endTime | string(date-time) | No | Node end time |
| data.output[].messages | object[] | No | Output messages |
| data.output[].messages[].messageId | string | Yes | Message ID |
| data.output[].messages[].content | string | No | Message content |
| data.output[].messages[].reasoningContent | string | No | Message reasoning content |
| data.output[].messages[].type | enum(ai \| tool) | Yes | Action message type |
| data.files | object[] | No | Output files |
| data.files[].name | string | Yes | File name |
| data.files[].type | string | Yes | File type |
| data.files[].size | number | No | File size |
| data.files[].nodeId | string | No | Node ID that produced the file |
| data.files[].url | string | No | File access URL |

<a id="api-endpoint-getWorkflowStatusViaApi"></a>
#### GET /openapi/workflow/{executionId}/status

**Get workflow execution status**

Get workflow execution status via authenticated API call. Requires API Key authentication.

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| executionId | path | string | Yes | Workflow execution ID |

**Responses**

| Status | Description |
| --- | --- |
| 200 | Workflow execution status retrieved successfully |
| 401 | Unauthorized - invalid or missing API key |
| 404 | Workflow execution not found |

**Response Fields (200)**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| success | boolean | Yes | Whether the operation was successful |
| errCode | string | No | Error code |
| errMsg | string | No | Error message |
| traceId | string | No | Trace ID |
| stack | string | No | Error stack (only returned in development environment) |
| data | object | No | - |
| data.executionId | string | No | Workflow execution ID |
| data.status | enum(init \| executing \| finish \| failed) | No | - |
| data.nodeExecutions | object[] | No | Node execution status list |
| data.nodeExecutions[].nodeId | string | Yes | Node ID |
| data.nodeExecutions[].status | enum(init \| waiting \| executing \| finish \| failed) | No | Action status |
| data.nodeExecutions[].title | string | No | Node title |
| data.nodeExecutions[].errorMessage | string | No | Node error message |
| data.createdAt | string(date-time) | No | Created time |

<a id="api-endpoint-searchWorkflowsViaApi"></a>
#### GET /openapi/workflows

**Search workflows**

Search workflows accessible by this API key.

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| keyword | query | string | No | Keyword to search in workflow titles |
| order | query | string | No | Sort order |
| page | query | number | No | Page number (1-based) |
| pageSize | query | number | No | Number of items per page |

**Responses**

| Status | Description |
| --- | --- |
| 200 | Workflow list retrieved successfully |
| 401 | Unauthorized - invalid or missing API key |

**Response Fields (200)**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| success | boolean | Yes | Whether the operation was successful |
| errCode | string | No | Error code |
| errMsg | string | No | Error message |
| traceId | string | No | Trace ID |
| stack | string | No | Error stack (only returned in development environment) |
| data | object[] | No | Workflow search results |
| data[].canvasId | string | Yes | Canvas/Workflow ID |
| data[].title | string | Yes | Workflow title |

<a id="api-endpoint-getWorkflowDetailViaApi"></a>
#### GET /openapi/workflows/{canvasId}

**Get workflow detail**

Get workflow details and workflow plan by canvas ID.

**Parameters**

| Name | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| canvasId | path | string | Yes | Canvas/Workflow ID |

**Responses**

| Status | Description |
| --- | --- |
| 200 | Workflow detail retrieved successfully |
| 401 | Unauthorized - invalid or missing API key |
| 404 | Workflow not found |

**Response Fields (200)**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| success | boolean | Yes | Whether the operation was successful |
| errCode | string | No | Error code |
| errMsg | string | No | Error message |
| traceId | string | No | Trace ID |
| stack | string | No | Error stack (only returned in development environment) |
| data | object | No | - |
| data.title | string | Yes | Workflow plan title |
| data.tasks | object[] | Yes | Workflow tasks |
| data.tasks[].id | string | Yes | Task ID |
| data.tasks[].title | string | Yes | Task title |
| data.tasks[].prompt | string | Yes | Task prompt/instruction |
| data.tasks[].toolsets | string[] | Yes | Toolsets selected for this task |
| data.tasks[].dependentTasks | string[] | No | Dependent task IDs |
| data.variables | object[] | No | Workflow variables |
| data.variables[].name | string | Yes | Variable name |
| data.variables[].variableType | enum(string \| option \| resource) | No | Variable type |
| data.variables[].required | boolean | No | Whether the variable is required |
| data.variables[].options | string[] | No | Variable options (only for option type) |

### Files

<a id="api-endpoint-uploadOpenapiFiles"></a>
#### POST /openapi/files/upload

**Upload files for workflow variables**

Upload files and return fileKey values. Unused files are cleaned up after about 24 hours.

**Request Body**

Files to upload for workflow variables.

**Request Body Fields**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| files | string(binary)[] | Yes | Files to upload |

**Request Body Example**

```json
{
  "files": [
    "string"
  ]
}
```

**Responses**

| Status | Description |
| --- | --- |
| 200 | Files uploaded successfully |
| 400 | Invalid request parameters |
| 401 | Unauthorized - invalid or missing API key |

**Response Fields (200)**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| success | boolean | Yes | Whether the operation was successful |
| errCode | string | No | Error code |
| errMsg | string | No | Error message |
| traceId | string | No | Trace ID |
| stack | string | No | Error stack (only returned in development environment) |
| data | object | No | - |
| data.files | object[] | Yes | Uploaded files |
| data.files[].fileKey | string | Yes | File key |
| data.files[].fileName | string | Yes | File name |

### Copilot

<a id="api-endpoint-generateWorkflowViaCopilot"></a>
#### POST /openapi/copilot/workflow/generate

**Generate workflow via Copilot**

Generate a workflow plan from a natural language prompt. If canvasId is provided, the workflow on that canvas will be overwritten and cannot be undone.

**Request Body**

Copilot workflow generation request.

**Request Body Fields**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| query | string | Yes | Natural language prompt describing the desired workflow (supports multiple languages). |
| canvasId | string | No | Optional canvas ID to overwrite. This will replace the existing workflow and cannot be undone. |
| locale | string | No | Output locale. Supported: en, zh-CN, ja, zh-Hant, fr, de-DE, ko, hi, es, ru, de, it, tr, pt, vi, id, th, ar, mn, fa. |

**Request Body Example**

```json
{
  "query": "生成一个客户反馈分析工作流",
  "locale": "zh-CN"
}
```

**Responses**

| Status | Description |
| --- | --- |
| 200 | Workflow generated successfully |
| 400 | Request failed or invalid parameters (response may include modelResponse) |
| 401 | Unauthorized - invalid or missing API key |
| 404 | Canvas not found |

**Response Fields (200)**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| success | boolean | Yes | Whether the operation was successful |
| errCode | string | No | Error code |
| errMsg | string | No | Error message |
| traceId | string | No | Trace ID |
| stack | string | No | Error stack (only returned in development environment) |
| data | object | No | - |
| data.canvasId | string | No | Canvas/Workflow ID |
| data.workflowPlan | object | No | - |
| data.workflowPlan.title | string | Yes | Workflow plan title |
| data.workflowPlan.tasks | object[] | Yes | Workflow tasks |
| data.workflowPlan.tasks[].id | string | Yes | Task ID |
| data.workflowPlan.tasks[].title | string | Yes | Task title |
| data.workflowPlan.tasks[].prompt | string | Yes | Task prompt/instruction |
| data.workflowPlan.tasks[].toolsets | string[] | Yes | Toolsets selected for this task |
| data.workflowPlan.tasks[].dependentTasks | string[] | No | Dependent task IDs |
| data.workflowPlan.variables | object[] | No | Workflow variables |
| data.workflowPlan.variables[].name | string | Yes | Variable name |
| data.workflowPlan.variables[].variableType | enum(string \| option \| resource) | No | Variable type |
| data.workflowPlan.variables[].required | boolean | No | Whether the variable is required |
| data.workflowPlan.variables[].options | string[] | No | Variable options (only for option type) |

**Response Fields (400)**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| statusCode | number | Yes | HTTP status code |
| message | string | Yes | Readable error message |
| error | string | Yes | Error type |
| modelResponse | string | No | Original AI response (may be empty, length-limited) |

## Error Codes
Common error codes for webhook and API integrations.

| Error Code | HTTP Status | Message | Description |
| --- | --- | --- | --- |
| CANVAS_NOT_FOUND | 404 | Canvas not found | Associated canvas cannot be found. |
| E0000 | - | An unknown error has occurred. Please try again later. | An unknown error has occurred. Please try again later. |
| E0001 | - | Cannot connect to the server, please try again later. | Cannot connect to the server, please try again later. |
| E0003 | - | System parameter error. Please try again later. | System parameter error. Please try again later. |
| E0004 | - | Authorization process failed, please try again | Authorization process failed, please try again |
| E0005 | - | Account not found, please sign up | Account not found, please sign up |
| E0006 | - | Password incorrect, please try again | Password incorrect, please try again |
| E0007 | - | Email already registered, please sign in or try another one | Email already registered, please sign in or try another one |
| E0008 | - | Verification session not found or expired, please try again | Verification session not found or expired, please try again |
| E0009 | - | Verification code is incorrect, please try again | Verification code is incorrect, please try again |
| E0010 | - | Operation too frequent, please try again later | Operation too frequent, please try again later |
| E0011 | - | Human verification failed, please try again | Human verification failed, please try again |
| E0012 | - | Authentication expired, please sign in again | Authentication expired, please sign in again |
| E0013 | - | This file type is temporarily not supported | This file type is temporarily not supported |
| E0014 | - | Switching embedding model is not supported temporarily | Switching embedding model is not supported temporarily |
| E0015 | - | Chat model not configured, please configure a chat model in the settings | Chat model not configured, please configure a chat model in the settings |
| E0016 | - | Embedding model not configured, please configure an embedding model in the settings | Embedding model not configured, please configure an embedding model in the settings |
| E0017 | - | Media provider not configured, please configure a media provider in the settings | Media provider not configured, please configure a media provider in the settings |
| E0018 | - | Media model not configured, please configure a media model in the settings | Media model not configured, please configure a media model in the settings |
| E1000 | - | Canvas not found, please refresh | Canvas not found, please refresh |
| E1002 | - | Resource not found, please refresh | Resource not found, please refresh |
| E1003 | - | Document not found, please refresh | Document not found, please refresh |
| E1004 | - | Reference not found, please refresh | Reference not found, please refresh |
| E1005 | - | Reference object missing, please refresh | Reference object missing, please refresh |
| E1006 | - | Skill not found, please refresh | Skill not found, please refresh |
| E1007 | - | Label class not found, please refresh | Label class not found, please refresh |
| E1008 | - | Label instance not found, please refresh | Label instance not found, please refresh |
| E1009 | - | Share content not found | Share content not found |
| E1011 | - | Action result not found, please refresh | Action result not found, please refresh |
| E1012 | - | Upload file not found, please try again | Upload file not found, please try again |
| E1013 | - | Code artifact not found, please refresh | Code artifact not found, please refresh |
| E1014 | - | Project not found, please refresh | Project not found, please refresh |
| E1015 | - | Provider not found, please refresh | Provider not found, please refresh |
| E1016 | - | Provider item not found, please refresh | Provider item not found, please refresh |
| E1017 | - | MCP server not found, please refresh | MCP server not found, please refresh |
| E1018 | - | Canvas version not found, please refresh | Canvas version not found, please refresh |
| E1019 | - | Provider misconfiguration, please check the provider configuration | Provider misconfiguration, please check the provider configuration |
| E1020 | - | Toolset not found, please refresh | Toolset not found, please refresh |
| E1021 | - | Workflow execution not found, please refresh | Workflow execution not found, please refresh |
| E1022 | - | Workflow app not found, please refresh | Workflow app not found, please refresh |
| E1023 | - | Copilot session not found, please refresh | Copilot session not found, please refresh |
| E1024 | - | Drive file not found, please refresh | Drive file not found, please refresh |
| E2001 | - | Storage quota exceeded, please upgrade your subscription | Storage quota exceeded, please upgrade your subscription |
| E2002 | - | Execution failed, credit quota insufficient, please upgrade your subscription | Execution failed, credit quota insufficient, please upgrade your subscription |
| E2003 | - | Model not supported, please select other models | Model not supported, please select other models |
| E2004 | - | Content is too large. Maximum length is 100k characters. | Content is too large. Maximum length is 100k characters. |
| E2005 | - | Request payload is too large. Maximum size is 100KB. | Request payload is too large. Maximum size is 100KB. |
| E3001 | - | Model provider error, please try again later | Model provider error, please try again later |
| E3002 | - | Request rate limit exceeded for the model provider. Please try again later. | Request rate limit exceeded for the model provider. Please try again later. |
| E3003 | - | Model provider timed out, please try again later | Model provider timed out, please try again later |
| E3004 | - | Action was stopped | Action was stopped |
| E3005 | - | Duplication is not allowed for this shared content | Duplication is not allowed for this shared content |
| E3006 | - | File too large for direct parsing, use execute_code tool to process it | File too large for direct parsing, use execute_code tool to process it |
| E3007 | - | The content you entered contains sensitive information. Please revise and try again. | The content you entered contains sensitive information. Please revise and try again. |
| E3008 | - | Presigned uploads are not supported by this storage backend | Presigned uploads are not supported by this storage backend |
| E3009 | - | The content type is not allowed for this operation | The content type is not allowed for this operation |
| E3010 | - | The uploaded file size does not match the expected size | The uploaded file size does not match the expected size |
| E3011 | - | The upload session has expired, please request a new presigned URL | The upload session has expired, please request a new presigned URL |
| E3012 | - | Tool call failed | Tool call failed |
| E3013 | - | Failed to send email | Failed to send email |
| INSUFFICIENT_CREDITS | 402 | Insufficient credits | Insufficient credits for this operation. |
| INVALID_REQUEST_BODY | 400 | Invalid request body | Request body format is invalid. |
| WEBHOOK_DISABLED | 403 | Webhook disabled | Webhook is disabled and cannot be triggered. |
| WEBHOOK_NOT_FOUND | 404 | Webhook not found | Webhook does not exist or has been deleted. |
| WEBHOOK_RATE_LIMITED | 429 | Webhook rate limited | Request rate exceeds the limit. |
