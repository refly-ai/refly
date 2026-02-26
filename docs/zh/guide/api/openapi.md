<!-- AUTO-GENERATED: DO NOT EDIT -->

# API 文档

通过 API 访问 Refly 的开放能力，如运行工作流、查询状态与结果等。

**基础地址**: `https://api.refly.ai/v1`

## 概览
Refly API 提供 RESTful 接口，支持以编程方式调用工作流、上传文件、查询执行状态等功能。所有 API 请求均需要通过 API Key 进行身份验证。

## 认证
所有 API 请求都需要在 HTTP Header 中携带 API Key 进行身份验证。\n\n**如何获取 API Key**：\n\n1. 访问 https://refly.ai/workspace 并进入任意一个工作流。\n\n   ![进入工作流示例图片](https://static.refly.ai/static/screenshot-20260205-112644.png)\n\n2. 点击右上角“集成”按钮。\n\n   ![点击集成按钮示例图片](https://static.refly.ai/static/screenshot-20260205-112430.png)\n\n3. 点击“API Key”标签页，点击“创建新的 API Key”按钮并妥善保管。\n\n   ![创建 API Key 示例图片](https://static.refly.ai/static/screenshot-20260205-112457.png)\n\n**请求头示例**：

`Authorization: Bearer YOUR_API_KEY`

## 接口列表
以下接口可用于集成。

### 工作流

<a id="api-endpoint-runWorkflowViaApi"></a>
#### POST /openapi/workflow/{canvasId}/run

**通过 API 触发工作流**

通过认证 API 调用执行工作流。与 webhook 不同，该接口需要 API Key，并返回用于跟踪状态的 executionId。

**参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| canvasId | path | string | 是 | 画布/工作流 ID（从浏览器地址栏的画布 URL 获取） |

**请求体**

请将变量放在 `variables` 字段中。

variables 内的每个 key 为变量名，value 可为字符串、数字、布尔值、对象或数组。

文件变量请传 `/openapi/files/upload` 返回的 `fileKey`（或 `fileKey` 数组）。

为兼容旧版本，也可直接在顶层传变量，但推荐使用 `variables`。

**请求体字段**

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| variables | object | 否 | 工作流变量键值对。每个 key 为变量名，value 可为字符串、数字、布尔值、对象或数组。文件变量请传 /openapi/files/upload 返回的 fileKey（或 fileKey 数组）。 |

**请求体示例**

```json
{}
```

**响应**

| 状态码 | 说明 |
| --- | --- |
| 200 | 工作流已触发执行 |
| 400 | 请求参数错误 |
| 401 | 未授权或 API Key 缺失/无效 |
| 403 | 工作流 API 已被禁用 |
| 404 | 工作流不存在 |

**响应字段 (200)**

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | 是 | 是否成功 |
| errCode | string | 否 | 错误码 |
| errMsg | string | 否 | 错误信息 |
| traceId | string | 否 | 追踪 ID |
| stack | string | 否 | 错误堆栈（仅开发环境返回） |
| data | object | 否 | - |
| data.executionId | string | 否 | 工作流执行 ID |
| data.status | enum(init \| executing \| finish \| failed) | 否 | - |

<a id="api-endpoint-abortWorkflowViaApi"></a>
#### POST /openapi/workflow/{executionId}/abort

**中止工作流执行**

通过认证 API 中止正在运行的工作流。需要 API Key。

**参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| executionId | path | string | 是 | 工作流执行 ID（来自 run 返回或状态接口） |

**响应**

| 状态码 | 说明 |
| --- | --- |
| 200 | 已受理中止请求 |
| 401 | 未授权或 API Key 缺失/无效 |
| 404 | 工作流执行不存在 |

**响应字段 (200)**

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | 是 | 是否成功 |
| errCode | string | 否 | 错误码 |
| errMsg | string | 否 | 错误信息 |
| traceId | string | 否 | 追踪 ID |
| stack | string | 否 | 错误堆栈（仅开发环境返回） |

<a id="api-endpoint-getWorkflowOutput"></a>
#### GET /openapi/workflow/{executionId}/output

**获取工作流执行输出**

通过认证 API 获取工作流执行输出（产出节点与云盘文件）。需要 API Key。执行中或失败的节点也可能返回部分消息；文件仅在节点完成后返回。

**参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| executionId | path | string | 是 | 工作流执行 ID |

**响应**

| 状态码 | 说明 |
| --- | --- |
| 200 | 已获取工作流执行输出 |
| 401 | 未授权或 API Key 缺失/无效 |
| 404 | 工作流执行不存在 |

**响应字段 (200)**

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | 是 | 是否成功 |
| errCode | string | 否 | 错误码 |
| errMsg | string | 否 | 错误信息 |
| traceId | string | 否 | 追踪 ID |
| stack | string | 否 | 错误堆栈（仅开发环境返回） |
| data | object | 否 | - |
| data.output | object[] | 否 | 输出节点结果 |
| data.output[].nodeId | string | 是 | 节点 ID |
| data.output[].title | string | 否 | 节点标题 |
| data.output[].status | enum(init \| waiting \| executing \| finish \| failed) | 否 | Action status |
| data.output[].errorMessage | string | 否 | 节点错误信息 |
| data.output[].startTime | string(date-time) | 否 | 节点开始时间 |
| data.output[].endTime | string(date-time) | 否 | 节点结束时间 |
| data.output[].messages | object[] | 否 | 输出消息 |
| data.output[].messages[].messageId | string | 是 | 消息 ID |
| data.output[].messages[].content | string | 否 | 消息内容 |
| data.output[].messages[].reasoningContent | string | 否 | 推理内容 |
| data.output[].messages[].type | enum(ai \| tool) | 是 | Action message type |
| data.files | object[] | 否 | 输出文件 |
| data.files[].name | string | 是 | 文件名 |
| data.files[].type | string | 是 | 文件类型 |
| data.files[].size | number | 否 | 文件大小 |
| data.files[].nodeId | string | 否 | 产出该文件的节点 ID |
| data.files[].url | string | 否 | 文件访问 URL |

<a id="api-endpoint-getWorkflowStatusViaApi"></a>
#### GET /openapi/workflow/{executionId}/status

**获取工作流执行状态**

通过认证 API 获取工作流执行状态。需要 API Key。

**参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| executionId | path | string | 是 | 工作流执行 ID |

**响应**

| 状态码 | 说明 |
| --- | --- |
| 200 | 已获取工作流执行状态 |
| 401 | 未授权或 API Key 缺失/无效 |
| 404 | 工作流执行不存在 |

**响应字段 (200)**

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | 是 | 是否成功 |
| errCode | string | 否 | 错误码 |
| errMsg | string | 否 | 错误信息 |
| traceId | string | 否 | 追踪 ID |
| stack | string | 否 | 错误堆栈（仅开发环境返回） |
| data | object | 否 | - |
| data.executionId | string | 否 | 工作流执行 ID |
| data.status | enum(init \| executing \| finish \| failed) | 否 | - |
| data.nodeExecutions | object[] | 否 | 节点执行状态列表 |
| data.nodeExecutions[].nodeId | string | 是 | 节点 ID |
| data.nodeExecutions[].status | enum(init \| waiting \| executing \| finish \| failed) | 否 | Action status |
| data.nodeExecutions[].title | string | 否 | 节点标题 |
| data.nodeExecutions[].errorMessage | string | 否 | 节点错误信息 |
| data.createdAt | string(date-time) | 否 | 创建时间 |

<a id="api-endpoint-searchWorkflowsViaApi"></a>
#### GET /openapi/workflows

**搜索工作流**

搜索当前 API Key 可访问的工作流。

**参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| keyword | query | string | 否 | 按工作流标题关键词搜索 |
| order | query | string | 否 | 排序方式 |
| page | query | number | 否 | 页码（从 1 开始） |
| pageSize | query | number | 否 | 每页数量 |

**响应**

| 状态码 | 说明 |
| --- | --- |
| 200 | 工作流列表获取成功 |
| 401 | 未授权或 API Key 缺失/无效 |

**响应字段 (200)**

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | 是 | 是否成功 |
| errCode | string | 否 | 错误码 |
| errMsg | string | 否 | 错误信息 |
| traceId | string | 否 | 追踪 ID |
| stack | string | 否 | 错误堆栈（仅开发环境返回） |
| data | object[] | 否 | 工作流搜索结果 |
| data[].canvasId | string | 是 | 画布/工作流 ID |
| data[].title | string | 是 | 工作流标题 |

<a id="api-endpoint-getWorkflowDetailViaApi"></a>
#### GET /openapi/workflows/{canvasId}

**获取工作流详情**

通过画布 ID 获取工作流详情与工作流计划。

**参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| canvasId | path | string | 是 | 画布/工作流 ID |

**响应**

| 状态码 | 说明 |
| --- | --- |
| 200 | 工作流详情获取成功 |
| 401 | 未授权或 API Key 缺失/无效 |
| 404 | 工作流不存在 |

**响应字段 (200)**

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | 是 | 是否成功 |
| errCode | string | 否 | 错误码 |
| errMsg | string | 否 | 错误信息 |
| traceId | string | 否 | 追踪 ID |
| stack | string | 否 | 错误堆栈（仅开发环境返回） |
| data | object | 否 | - |
| data.title | string | 是 | 工作流方案标题 |
| data.tasks | object[] | 是 | 工作流任务列表 |
| data.tasks[].id | string | 是 | 任务 ID |
| data.tasks[].title | string | 是 | 任务标题 |
| data.tasks[].prompt | string | 是 | 任务提示词/指令 |
| data.tasks[].toolsets | string[] | 是 | 该任务使用的工具集 |
| data.tasks[].dependentTasks | string[] | 否 | 依赖的任务 ID |
| data.variables | object[] | 否 | 工作流变量列表 |
| data.variables[].name | string | 是 | 变量名 |
| data.variables[].variableType | enum(string \| option \| resource) | 否 | 变量类型 |
| data.variables[].required | boolean | 否 | 是否必填 |
| data.variables[].options | string[] | 否 | 可选项（仅 option 类型） |

### 文件

<a id="api-endpoint-uploadOpenapiFiles"></a>
#### POST /openapi/files/upload

**上传文件用于工作流变量**

上传文件并返回 fileKey。未使用的文件约 24 小时后清理。

**请求体**

上传用于工作流变量的文件。

**请求体字段**

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| files | string(binary)[] | 是 | 要上传的文件 |

**请求体示例**

```json
{
  "files": [
    "string"
  ]
}
```

**响应**

| 状态码 | 说明 |
| --- | --- |
| 200 | 文件上传成功 |
| 400 | 请求参数错误 |
| 401 | 未授权或 API Key 缺失/无效 |

**响应字段 (200)**

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | 是 | 是否成功 |
| errCode | string | 否 | 错误码 |
| errMsg | string | 否 | 错误信息 |
| traceId | string | 否 | 追踪 ID |
| stack | string | 否 | 错误堆栈（仅开发环境返回） |
| data | object | 否 | - |
| data.files | object[] | 是 | 上传的文件 |
| data.files[].fileKey | string | 是 | 文件 Key |
| data.files[].fileName | string | 是 | 文件名 |

### Copilot

<a id="api-endpoint-generateWorkflowViaCopilot"></a>
#### POST /openapi/copilot/workflow/generate

**通过 Copilot 生成工作流**

根据自然语言生成工作流方案。若传入 canvasId，将覆盖该画布现有工作流，且当前不支持撤销，请谨慎使用。

**请求体**

Copilot 工作流生成请求。

**请求体字段**

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| query | string | 是 | 描述期望工作流的自然语言提示词（支持多语言）。 |
| canvasId | string | 否 | 可选画布 ID。若传入将覆盖该画布现有工作流，且当前不支持撤销。 |
| locale | string | 否 | 输出语言/地区。支持：en、zh-CN、ja、zh-Hant、fr、de-DE、ko、hi、es、ru、de、it、tr、pt、vi、id、th、ar、mn、fa。 |

**请求体示例**

```json
{
  "query": "生成一个客户反馈分析工作流",
  "locale": "zh-CN"
}
```

**响应**

| 状态码 | 说明 |
| --- | --- |
| 200 | 工作流生成成功 |
| 400 | 生成失败或参数错误（响应可能包含 modelResponse） |
| 401 | 未授权或 API Key 缺失/无效 |
| 404 | 画布不存在 |

**响应字段 (200)**

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | 是 | 是否成功 |
| errCode | string | 否 | 错误码 |
| errMsg | string | 否 | 错误信息 |
| traceId | string | 否 | 追踪 ID |
| stack | string | 否 | 错误堆栈（仅开发环境返回） |
| data | object | 否 | - |
| data.canvasId | string | 否 | 画布/工作流 ID |
| data.workflowPlan | object | 否 | - |
| data.workflowPlan.title | string | 是 | 工作流方案标题 |
| data.workflowPlan.tasks | object[] | 是 | 工作流任务列表 |
| data.workflowPlan.tasks[].id | string | 是 | 任务 ID |
| data.workflowPlan.tasks[].title | string | 是 | 任务标题 |
| data.workflowPlan.tasks[].prompt | string | 是 | 任务提示词/指令 |
| data.workflowPlan.tasks[].toolsets | string[] | 是 | 该任务使用的工具集 |
| data.workflowPlan.tasks[].dependentTasks | string[] | 否 | 依赖的任务 ID |
| data.workflowPlan.variables | object[] | 否 | 工作流变量列表 |
| data.workflowPlan.variables[].name | string | 是 | 变量名 |
| data.workflowPlan.variables[].variableType | enum(string \| option \| resource) | 否 | 变量类型 |
| data.workflowPlan.variables[].required | boolean | 否 | 是否必填 |
| data.workflowPlan.variables[].options | string[] | 否 | 可选项（仅 option 类型） |

**响应字段 (400)**

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| statusCode | number | 是 | HTTP 状态码 |
| message | string | 是 | 错误信息（可读） |
| error | string | 是 | 错误类型 |
| modelResponse | string | 否 | AI 原始回复（可能为空，长度受限） |

## 错误码
Webhook 与 API 集成常见错误码。

| 错误码 | HTTP 状态 | 消息 | 说明 |
| --- | --- | --- | --- |
| CANVAS_NOT_FOUND | 404 | 画布不存在 | 关联画布不存在。 |
| E0000 | - | 出现未知错误，请稍后重试。 | 出现未知错误，请稍后重试。 |
| E0001 | - | 无法连接到服务器，请稍后重试。 | 无法连接到服务器，请稍后重试。 |
| E0003 | - | 系统参数错误，请稍后重试。 | 系统参数错误，请稍后重试。 |
| E0004 | - | 授权过程失败，请重试 | 授权过程失败，请重试 |
| E0005 | - | 账户不存在，请注册 | 账户不存在，请注册 |
| E0006 | - | 密码错误，请重试 | 密码错误，请重试 |
| E0007 | - | 邮箱已被注册，请登录或尝试其他邮箱 | 邮箱已被注册，请登录或尝试其他邮箱 |
| E0008 | - | 验证会话不存在或已过期，请重试 | 验证会话不存在或已过期，请重试 |
| E0009 | - | 验证码错误，请重试 | 验证码错误，请重试 |
| E0010 | - | 操作过于频繁，请稍后再试 | 操作过于频繁，请稍后再试 |
| E0011 | - | 人机验证失败，请重试 | 人机验证失败，请重试 |
| E0012 | - | 身份验证已过期，请重新登录 | 身份验证已过期，请重新登录 |
| E0013 | - | 暂不支持该文件类型 | 暂不支持该文件类型 |
| E0014 | - | 暂不支持切换嵌入模型 | 暂不支持切换嵌入模型 |
| E0015 | - | 未配置对话模型，请先在设置中进行配置 | 未配置对话模型，请先在设置中进行配置 |
| E0016 | - | 未配置嵌入模型，请先在设置中进行配置 | 未配置嵌入模型，请先在设置中进行配置 |
| E0017 | - | 未配置媒体提供方，请先在设置中进行配置 | 未配置媒体提供方，请先在设置中进行配置 |
| E0018 | - | 未配置媒体模型，请先在设置中进行配置 | 未配置媒体模型，请先在设置中进行配置 |
| E1000 | - | 画布不存在，请刷新重试 | 画布不存在，请刷新重试 |
| E1002 | - | 资源不存在，请刷新重试 | 资源不存在，请刷新重试 |
| E1003 | - | 文档不存在，请刷新重试 | 文档不存在，请刷新重试 |
| E1004 | - | 引用不存在，请刷新重试 | 引用不存在，请刷新重试 |
| E1005 | - | 引用对象不存在，请刷新重试 | 引用对象不存在，请刷新重试 |
| E1006 | - | 技能不存在，请刷新重试 | 技能不存在，请刷新重试 |
| E1007 | - | 标签分类不存在，请刷新重试 | 标签分类不存在，请刷新重试 |
| E1008 | - | 标签不存在，请刷新重试 | 标签不存在，请刷新重试 |
| E1009 | - | 分享内容不存在 | 分享内容不存在 |
| E1011 | - | 执行结果不存在，请刷新重试 | 执行结果不存在，请刷新重试 |
| E1012 | - | 上传文件不存在，请重新尝试 | 上传文件不存在，请重新尝试 |
| E1013 | - | 代码组件不存在，请刷新重试 | 代码组件不存在，请刷新重试 |
| E1014 | - | 项目不存在，请刷新重试 | 项目不存在，请刷新重试 |
| E1015 | - | 提供方不存在，请刷新重试 | 提供方不存在，请刷新重试 |
| E1016 | - | 提供方项目不存在，请刷新重试 | 提供方项目不存在，请刷新重试 |
| E1017 | - | MCP 服务器不存在，请刷新重试 | MCP 服务器不存在，请刷新重试 |
| E1018 | - | 画布版本不存在，请刷新重试 | 画布版本不存在，请刷新重试 |
| E1019 | - | 提供方配置错误，请检查提供方配置 | 提供方配置错误，请检查提供方配置 |
| E1020 | - | 工具集不存在，请刷新重试 | 工具集不存在，请刷新重试 |
| E1021 | - | 工作流执行不存在，请刷新重试 | 工作流执行不存在，请刷新重试 |
| E1022 | - | 工作流 App 不存在，请刷新重试 | 工作流 App 不存在，请刷新重试 |
| E1023 | - | Copilot 会话不存在，请刷新重试 | Copilot 会话不存在，请刷新重试 |
| E1024 | - | 云盘文件不存在，请刷新重试 | 云盘文件不存在，请刷新重试 |
| E2001 | - | 存储容量不足，请升级订阅套餐 | 存储容量不足，请升级订阅套餐 |
| E2002 | - | 执行失败，积分额度不足，请升级订阅套餐 | 执行失败，积分额度不足，请升级订阅套餐 |
| E2003 | - | 不支持当前模型，请选择其他模型 | 不支持当前模型，请选择其他模型 |
| E2004 | - | 内容过长。最大长度为 10 万字符。 | 内容过长。最大长度为 10 万字符。 |
| E2005 | - | 请求数据过大。最大大小为 100KB。 | 请求数据过大。最大大小为 100KB。 |
| E3001 | - | 模型提供方出错，请稍后重试 | 模型提供方出错，请稍后重试 |
| E3002 | - | 已超出模型提供方请求速率限制，请稍后重试 | 已超出模型提供方请求速率限制，请稍后重试 |
| E3003 | - | 模型提供方响应超时，请稍后重试 | 模型提供方响应超时，请稍后重试 |
| E3004 | - | 操作已被停止 | 操作已被停止 |
| E3005 | - | 此共享内容不允许被复制 | 此共享内容不允许被复制 |
| E3006 | - | 文件过大无法直接解析，请使用 execute_code 工具处理 | 文件过大无法直接解析，请使用 execute_code 工具处理 |
| E3007 | - | 您输入的内容包含敏感信息，请修改后重试 | 您输入的内容包含敏感信息，请修改后重试 |
| E3008 | - | 当前存储后端不支持预签名上传 | 当前存储后端不支持预签名上传 |
| E3009 | - | 不允许使用此内容类型进行此操作 | 不允许使用此内容类型进行此操作 |
| E3010 | - | 上传文件大小与预期大小不匹配 | 上传文件大小与预期大小不匹配 |
| E3011 | - | 上传会话已过期，请重新获取预签名URL | 上传会话已过期，请重新获取预签名URL |
| E3012 | - | 工具调用失败 | 工具调用失败 |
| E3013 | - | 邮件发送失败 | 邮件发送失败 |
| INSUFFICIENT_CREDITS | 402 | 积分不足 | 当前操作所需积分不足。 |
| INVALID_REQUEST_BODY | 400 | 请求体非法 | 请求体格式不正确。 |
| WEBHOOK_DISABLED | 403 | Webhook 已停用 | Webhook 已停用，无法触发执行。 |
| WEBHOOK_NOT_FOUND | 404 | Webhook 不存在 | Webhook 不存在或已被删除。 |
| WEBHOOK_RATE_LIMITED | 429 | Webhook 请求限流 | 请求速率超过限制。 |
