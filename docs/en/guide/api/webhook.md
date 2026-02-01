<!-- AUTO-GENERATED: DO NOT EDIT -->

# Webhook Documentation

Trigger the current canvas workflow via Webhook and track executions in Run History.

## Request Body
Webhook variables payload

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| variables | object | No | Webhook variables as key-value pairs |

**Request Body Example**

```json
{}
```

## File Upload
If you need to send file variables, upload files via /openapi/files/upload to get fileKey (requires API Key), then pass fileKey or fileKey[] under variables in the webhook body.

[View file upload API docs](./openapi.md#api-endpoint-uploadOpenapiFiles)

## Error Codes
Common error codes for webhook and API integrations.

| Error Code | HTTP Status | Message | Description |
| --- | --- | --- | --- |
| CANVAS_NOT_FOUND | 404 | Canvas not found | Associated canvas cannot be found. |
| INSUFFICIENT_CREDITS | 402 | Insufficient credits | Insufficient credits for this operation. |
| INVALID_REQUEST_BODY | 400 | Invalid request body | Request body format is invalid. |
| WEBHOOK_DISABLED | 403 | Webhook disabled | Webhook is disabled and cannot be triggered. |
| WEBHOOK_NOT_FOUND | 404 | Webhook not found | Webhook does not exist or has been deleted. |
| WEBHOOK_RATE_LIMITED | 429 | Webhook rate limited | Request rate exceeds the limit. |
