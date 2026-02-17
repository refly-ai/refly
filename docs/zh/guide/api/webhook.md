<!-- AUTO-GENERATED: DO NOT EDIT -->

# Webhook 文档

通过 Webhook 触发当前画布的工作流，并在运行历史中追踪执行状态。

## 如何开启 Webhook

**获取 Webhook URL 的步骤**:

1. 访问 https://refly.ai/workspace 并进入任意一个工作流。

   ![1. 访问 https://refly.ai/workspace 并进入任意一个工作流。](https://static.refly.ai/static/screenshot-20260205-112644.png)

2. 点击右上角"集成"按钮。

   ![2. 点击右上角"集成"按钮。](https://static.refly.ai/static/screenshot-20260205-112430.png)

3. 点击顶部的"Webhook"标签页，然后打开顶部的 Enable 开关。

   ![3. 点击顶部的"Webhook"标签页，然后打开顶部的 Enable 开关。](https://static.refly.ai/static/screenshot-20260205-145000.png)

4. 复制生成的 Webhook URL 用于集成。

## 请求体
Webhook 变量请求体

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| variables | object | 否 | Webhook 变量键值对 |

**请求体示例**

```json
{}
```

## 文件上传
如需传文件变量，请先调用 /openapi/files/upload 上传文件并获取 fileKey（需要 API Key），然后在 Webhook 请求体的 variables 中传 fileKey 或 fileKey[]。

[查看文件上传接口文档](./openapi.md#api-endpoint-uploadOpenapiFiles)

## 错误码
Webhook 与 API 集成常见错误码。

| 错误码 | HTTP 状态 | 消息 | 说明 |
| --- | --- | --- | --- |
| CANVAS_NOT_FOUND | 404 | 画布不存在 | 关联画布不存在。 |
| INSUFFICIENT_CREDITS | 402 | 积分不足 | 当前操作所需积分不足。 |
| INVALID_REQUEST_BODY | 400 | 请求体非法 | 请求体格式不正确。 |
| WEBHOOK_DISABLED | 403 | Webhook 已停用 | Webhook 已停用，无法触发执行。 |
| WEBHOOK_NOT_FOUND | 404 | Webhook 不存在 | Webhook 不存在或已被删除。 |
| WEBHOOK_RATE_LIMITED | 429 | Webhook 请求限流 | 请求速率超过限制。 |
