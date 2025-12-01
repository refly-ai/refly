# Workflow Execution Test Script

该脚本实现了完整的工作流自动化测试流程：
1. 使用 Copilot Autogen API 生成工作流
2. 使用 LLM API 自动生成工作流变量值
3. 使用 workflow/initialize-test API 执行工作流
4. 轮询 workflow/detail-test API 直到工作流完成

## 脚本功能概览

脚本包含四个核心函数：

### 1. `generate_variable_values()`
- 使用 LLM API 生成变量值（支持任意 OpenAI 兼容的 API）
- 基于用户查询和变量描述构建提示词
- 使用 temperature 0.7 保证生成结果的多样性
- 支持解析 markdown 代码块格式的 JSON 响应
- 将生成的值转换为 Refly 所需的格式：`[{"type": "text", "text": "value"}]`

### 2. `initialize_workflow()`
- 调用 `/v1/workflow/initialize-test` 端点初始化工作流执行
- 传递画布 ID、变量值和用户 ID
- 使用 `nodeBehavior: "update"` 模式
- 返回工作流执行 ID

### 3. `poll_workflow_status()`
- 调用 `/v1/workflow/detail-test` 端点轮询工作流状态
- 每 2 秒查询一次执行进度
- 显示实时进度：已完成/失败/执行中的节点数量
- 支持最大等待时间设置（默认 10 分钟）
- 检测到完成或失败时自动停止轮询
- 支持 Ctrl+C 手动中断

### 4. `test_workflow_execution()`
- 主测试函数，协调整个工作流
- 验证必需的环境变量
- 自动将 API URL 转换为前端 URL (端口 5174)
- 提供详细的进度输出和错误处理

## Prerequisites

- Python 3.x with `requests` library installed
- Refly API server running (default: http://localhost:5800)
- Valid Refly user ID
- LLM API endpoint and key (OpenAI compatible API)

## Installation

```bash
# Install required dependencies
pip install requests
```

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `REFLY_USER_ID` | Yes | Your Refly user ID | - |
| `LLM_ENDPOINT` | Yes | LLM API endpoint (OpenAI compatible) | - |
| `LLM_API_KEY` | Yes | LLM API key | - |

## Usage

### Basic Usage

```bash
REFLY_USER_ID="your_user_id" LLM_ENDPOINT="https://litellm.powerformer.net/v1" LLM_API_KEY="your_key" python scripts/workflow-autogen/test-workflow-autogen.py
```

### With Custom Model

```bash
MODEL_NAME="openai/gpt-4o-mini" REFLY_USER_ID="your_user_id" LLM_ENDPOINT="https://litellm.powerformer.net/v1" LLM_API_KEY="your_key" python scripts/workflow-autogen/test-workflow-autogen.py
```

### With Custom API URL

```bash
API_URL="http://production:5800" REFLY_USER_ID="your_user_id" LLM_ENDPOINT="https://litellm.powerformer.net/v1" LLM_API_KEY="your_key" python scripts/workflow-autogen/test-workflow-autogen.py
```

### With Custom Locale

```bash
LOCALE="zh-CN" REFLY_USER_ID="your_user_id" LLM_ENDPOINT="https://litellm.powerformer.net/v1" LLM_API_KEY="your_key" python scripts/workflow-autogen/test-workflow-autogen.py
```

### Using DeepSeek API

```bash
REFLY_USER_ID="your_user_id" LLM_ENDPOINT="https://api.deepseek.com/v1" LLM_API_KEY="your_key" MODEL_NAME="deepseek-chat" python scripts/workflow-autogen/test-workflow-autogen.py
```

## 执行流程

### 第一步：生成工作流
- 调用 `/v1/copilot-autogen/generate` API
- 传递用户查询（query）、用户 ID（uid）和语言环境（locale）
- 接收工作流计划，包括节点、边和变量定义
- 获取画布 ID（canvasId）

### 第二步：生成变量值
- 如果工作流包含变量，调用 LLM API 生成值
- 构建包含用户查询和变量描述的提示词
- LLM API 返回 JSON 格式的变量值
- 将生成的值映射回原始变量，转换为 Refly 格式
- 如果没有变量，跳过此步骤

### 第三步：执行工作流
- 调用 `/v1/workflow/initialize-test` API
- 传递画布 ID、填充好的变量和用户 ID
- 设置 `nodeBehavior: "update"` 以更新节点状态
- 接收工作流执行 ID

### 第四步：轮询工作流状态
- 调用 `/v1/workflow/detail-test` API 查询执行状态
- 每 2 秒轮询一次，最多等待 10 分钟
- 实时显示进度：
  - 当前状态（executing/finish/failed）
  - 已完成节点数 / 总节点数
  - 失败节点数
  - 正在执行的节点数
  - 已用时间
- 检测到完成或失败时停止轮询
- 如果失败，显示失败节点的详细错误信息

### 第五步：显示最终结果
- 输出画布 URL（自动转换为前端端口 5174）
- 输出工作流执行 ID 和最终状态
- 显示完成的节点统计
- 用户可以在浏览器中打开画布 URL 查看执行结果

## 重要说明

### 测试端点安全性

该脚本使用 **未认证的测试端点** 进行本地开发：

#### `/v1/workflow/initialize-test`
- ❌ 不需要 JWT 认证
- ⚠️ 直接在请求体中接受 `uid` 参数
- ✅ 仅用于本地测试环境
- 🚫 生产环境必须禁用此端点

#### `/v1/workflow/detail-test`
- ❌ 不需要 JWT 认证
- ⚠️ 通过查询参数接受 `uid` 和 `executionId`
- ✅ 仅用于本地测试环境
- 🚫 生产环境必须禁用此端点

### 变量值格式

生成的变量值使用以下格式：
```json
{
  "name": "variable_name",
  "value": [
    {
      "type": "text",
      "text": "generated_value"
    }
  ]
}
```

### LLM API 配置

- **默认模型**: `openai/gpt-4o`
- **Temperature**: `0.7`（平衡创造性和准确性）
- **超时时间**: 30 秒
- **API 格式**: OpenAI 兼容的 `/v1/chat/completions` 端点
- **响应格式**: 支持纯 JSON 和 markdown 代码块包裹的 JSON

## 输出示例

```
Testing Workflow Execution...
Endpoint: http://localhost:5800/v1/copilot-autogen/generate

User ID: user123
Query: 输入一周工作总结，自动提炼并生成 3 篇专业、有洞察力的 LinkedIn 帖子。
Locale: en-US

Sending request...

✅ Workflow generated successfully!
   Canvas ID: canvas_xxx
   Nodes Count: 5
   Edges Count: 4
   Variables: 3

🤖 Generating variable values with LLM...
   - weeklyReport: "本周完成了项目A的核心功能开发，包括用户认证模块和数据..."
   - tone: "专业且有洞察力"
   - platform: "LinkedIn"

🚀 Initializing workflow execution...
   Execution ID: we_xxx

✅ Workflow execution started!
   Canvas URL: http://localhost:5174/canvas/canvas_xxx
   Execution ID: we_xxx

⏳ Polling workflow execution status...
   Poll interval: 2s
   Max wait time: 600s
   [1] Status: executing | Progress: 1/5 | Failed: 0 | Executing: 1 | Time: 2.0s
   [2] Status: executing | Progress: 2/5 | Failed: 0 | Executing: 1 | Time: 4.1s
   [3] Status: executing | Progress: 3/5 | Failed: 0 | Executing: 1 | Time: 6.2s
   [4] Status: executing | Progress: 4/5 | Failed: 0 | Executing: 1 | Time: 8.3s
   [5] Status: executing | Progress: 5/5 | Failed: 0 | Executing: 0 | Time: 10.4s

✅ Workflow completed successfully!
   Total time: 10.4s
   Total polls: 5
   Nodes executed: 5/5

📊 Final Results:
   Canvas URL: http://localhost:5174/canvas/canvas_xxx
   Execution ID: we_xxx
   Status: finish
   Completed nodes: 5/5
```

**说明**：
- 脚本会在每个步骤显示详细进度
- 变量值会被截断显示（超过 50 字符显示省略号）
- 轮询期间实时显示工作流执行进度
- 画布 URL 会自动从 API URL (5800) 转换为前端 URL (5174)
- 脚本会等待工作流完成后才结束

## 自定义查询

要测试不同的工作流，可以编辑脚本中的 `query` 变量（第 20-22 行）：

```python
query = """
输入一周工作总结，自动提炼并生成 3 篇专业、有洞察力的 LinkedIn 帖子。
"""
```

### 查询建议

好的工作流查询应该：
- **明确输入**：清楚说明输入内容是什么
- **明确输出**：说明期望的输出格式和数量
- **提供上下文**：包含足够的上下文信息帮助 AI 理解意图
- **具体要求**：如风格、语气、平台等具体要求

示例查询：
```python
# 示例 1：内容创作
query = "输入产品描述，生成 5 条不同风格的社交媒体文案"

# 示例 2：数据分析
query = "输入销售数据 CSV，分析趋势并生成可视化图表和摘要报告"

# 示例 3：文档处理
query = "输入技术文档，提取关键信息并生成简明的 README 文件"
```

## 错误处理

脚本实现了完善的错误处理机制：

### 环境变量检查
- `REFLY_USER_ID` 未设置：显示使用说明并退出
- `DEEPSEEK_API_KEY` 未设置：显示使用说明并退出

### API 调用错误
- **连接失败**：检查 API 服务器是否运行
- **HTTP 错误**：显示状态码和响应详情
- **超时错误**：工作流生成超时 5 分钟，DeepSeek API 超时 30 秒

### 数据解析错误
- **JSON 解析失败**：显示原始响应内容，帮助调试
- **响应格式错误**：如果 API 返回 `success: false`，显示完整响应

### 工作流执行错误
- **无执行 ID**：初始化失败时显示详细错误信息
- **变量生成失败**：显示 DeepSeek API 的错误响应

所有错误都会显示清晰的错误消息，并以状态码 1 退出。

## LLM API 使用

该脚本支持任意 OpenAI 兼容的 LLM API 生成变量值。

### 支持的 LLM 提供商

#### LiteLLM (推荐)
```bash
export LLM_ENDPOINT="https://litellm.powerformer.net/v1"
export LLM_API_KEY="your-litellm-key"
export MODEL_NAME="openai/gpt-4o"  # 或其他模型
```

#### DeepSeek
```bash
export LLM_ENDPOINT="https://api.deepseek.com/v1"
export LLM_API_KEY="your-deepseek-key"
export MODEL_NAME="deepseek-chat"
```

#### OpenAI
```bash
export LLM_ENDPOINT="https://api.openai.com/v1"
export LLM_API_KEY="your-openai-key"
export MODEL_NAME="gpt-4o"
```

### API 调用详情
```python
# LLM API 配置
endpoint = f"{LLM_ENDPOINT}/chat/completions"  # 自动处理路径
model = MODEL_NAME  # 默认 openai/gpt-4o
temperature = 0.7
timeout = 30  # seconds
```

### 响应格式处理
脚本支持多种 API 响应格式：
1. **纯 JSON**：直接解析
2. **Markdown 代码块**：自动提取 ` ```json ... ``` ` 或 ` ``` ... ``` ` 中的 JSON

## 故障排除

### ❌ "Connection failed" 错误
**原因**：无法连接到 Refly API 服务器

**解决方案**：
- 确认 API 服务器正在运行
- 检查端口是否正确（默认：5800）
- 验证 `API_URL` 环境变量是否正确
- 尝试访问 `http://localhost:5800/health` 检查服务器状态

### ❌ "REFLY_USER_ID environment variable is not set"
**原因**：缺少必需的用户 ID 环境变量

**解决方案**：
```bash
# 方式 1：直接在命令前设置
REFLY_USER_ID="your_user_id" python test-workflow-autogen.py

# 方式 2：导出环境变量
export REFLY_USER_ID="your_user_id"
python test-workflow-autogen.py
```

### ❌ "LLM_ENDPOINT environment variable is not set"
**原因**：缺少必需的 LLM API 端点

**解决方案**：
```bash
# 设置 LLM API 端点（OpenAI 兼容）
export LLM_ENDPOINT="https://litellm.powerformer.net/v1"
# 或使用 DeepSeek
export LLM_ENDPOINT="https://api.deepseek.com/v1"
```

### ❌ "LLM_API_KEY environment variable is not set"
**原因**：缺少必需的 LLM API 密钥

**解决方案**：
```bash
# 设置对应的 API 密钥
export LLM_API_KEY="your-api-key"
```

### ❌ "Error parsing LLM response as JSON"
**原因**：LLM API 返回的内容无法解析为 JSON

**可能原因**：
1. API 账户积分不足
2. API 返回错误消息而非 JSON
3. 网络问题导致响应不完整
4. 模型名称不正确

**解决方案**：
- 检查 API 账户余额
- 查看脚本输出的"Response content"了解详情
- 重新运行脚本
- 检查 LLM API 状态
- 验证 MODEL_NAME 是否正确

### ❌ "Request timeout (waited 5 minutes)"
**原因**：工作流生成超过 5 分钟

**解决方案**：
- 简化查询，减少工作流复杂度
- 检查 Copilot Autogen 服务是否正常运行
- 查看 API 服务器日志了解详情

### ❌ "Workflow initialization failed"
**原因**：工作流执行初始化失败

**解决方案**：
- 检查画布 ID 是否有效
- 验证变量格式是否正确
- 查看返回的错误详情
- 确认用户 ID 存在于数据库中

### ❌ "Error polling workflow status: HTTP 401"
**原因**：轮询工作流状态时认证失败

**解决方案**：
- 确保使用的是 `detail-test` 测试端点
- 检查是否正确传递了 `uid` 参数
- 确认 API 服务器已启用测试端点

### ⏰ "Timeout: Workflow execution exceeded 600s wait time"
**原因**：工作流执行时间超过最大等待时间（10 分钟）

**解决方案**：
- 检查工作流是否卡住或有错误
- 在浏览器中打开画布 URL 查看实际状态
- 考虑简化工作流减少执行时间
- 查看 API 服务器日志了解详情

### ❌ "Workflow execution failed"
**原因**：工作流执行过程中有节点失败

**输出示例**：
```
❌ Workflow execution failed!
   Total time: 15.3s
   Failed nodes: 1/5

   Failed nodes:
     - node_xxx: Extract Key Points
       Error: Model API call failed: timeout...
```

**解决方案**：
- 查看失败节点的错误信息
- 检查相关的 AI 模型是否可用
- 验证节点配置是否正确
- 在浏览器中查看详细的错误信息

## 技术栈

- **Python**: 3.x
- **依赖库**: requests
- **AI 模型**: 任意 OpenAI 兼容的 LLM API
- **API 端点**:
  - `/v1/copilot-autogen/generate` - 工作流生成
  - `/v1/workflow/initialize-test` - 工作流执行（测试端点）
  - `/v1/workflow/detail-test` - 工作流状态查询（测试端点）

## 许可证

与 Refly 项目主许可证相同。

