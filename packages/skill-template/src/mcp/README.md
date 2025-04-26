# Model Context Protocol (MCP) 客户端库

这个库提供了与Model Context Protocol (MCP)服务器交互的完整解决方案，帮助开发者轻松实现AI工具集成和工作流编排。本库支持多种连接方式，并提供丰富的工具管理和服务编排功能。

## 功能特点

- **多种连接方式**：支持HTTP、SSE、内存中和标准输入输出
- **认证流程**：内置OAuth认证流程，简化安全连接
- **性能优化**：采用缓存机制，提高工具和资源调用性能
- **完整管理**：提供工具、资源和提示的完整管理功能
- **服务器实现**：内置多种MCP服务器实现，减少开发成本
- **工作流编排**：支持工具链和多服务器编排，实现复杂流程

## 目录结构

```
mcp/
├── core/              # 核心组件和类型定义
│   ├── MCPClient.ts   # MCP客户端实现
│   ├── MCPAssistant.ts # AI助手实现
│   ├── MCPOrchestrator.ts # 工作流编排器
│   └── types.ts       # 类型定义
├── servers/           # 内置MCP服务器实现
├── transport/         # 连接传输层实现
├── auth/              # 认证相关实现
├── utils/             # 工具函数和服务
└── examples/          # 使用示例代码
```

## 核心组件说明

### MCPClient

MCP客户端是与服务器交互的核心组件，负责连接服务器、调用工具和管理资源。

### MCPAssistant

助手组件提供与大语言模型交互的能力，能够理解和执行工具调用请求，简化AI与工具的集成流程。

### MCPOrchestrator

编排器组件用于管理复杂工作流，支持多步骤顺序执行、条件执行和错误处理。

## 快速开始

### 1. 基本连接与工具调用

```typescript
import { MCPClient } from './mcp/core/MCPClient'
import { MCPServerConfig } from './mcp/core/types'

// 创建服务器配置
const serverConfig: MCPServerConfig = {
  id: 'memory-server',
  name: '内存服务器',
  type: 'inMemory',
  isActive: true
}

// 异步函数包装
async function main() {
  // 创建客户端
  const client = new MCPClient()

  // 连接服务器
  const connected = await client.connect(serverConfig)
  if (!connected) {
    console.error('服务器连接失败')
    return
  }

  // 列出工具
  const tools = await client.listTools(serverConfig)
  console.log('可用工具:', tools)

  // 调用工具示例
  const result = await client.callTool({
    server: serverConfig,
    name: 'memory.store',
    args: { key: 'greeting', value: '你好，MCP!' }
  })

  // 处理结果
  if (result.isError) {
    console.error('工具调用出错:', result.content?.[0]?.text)
  } else {
    // 提取文本内容
    const textContent = result.content
      .filter((item) => item.type === 'text' && item.text)
      .map((item) => item.text)
      .join('\n')

    console.log('调用结果:', textContent)
  }

  // 断开连接
  await client.disconnectAll()
}

// 运行示例
main().catch(console.error)
```

### 2. 使用AI助手与工具交互

```typescript
import { MCPAssistant, MessageRole } from './mcp/core/MCPAssistant'
import { MCPClient } from './mcp/core/MCPClient'

// 创建模型提供者 (实际项目中替换为您的模型API调用)
const modelProvider = async (messages) => {
  // 示例：这里应该调用您的大语言模型API
  console.log('发送到模型的消息:', messages)

  // 模拟模型返回一个工具调用
  return `我可以帮您存储这条信息。
<tool_use>
  <n>memory-server:memory.store</n>
  <arguments>{"key": "note", "value": "这是一条重要笔记"}</arguments>
</tool_use>`
}

async function assistantExample() {
  // 创建客户端
  const client = new MCPClient()

  // 创建服务器配置
  const serverConfig = {
    id: 'memory-server',
    name: '内存服务器',
    type: 'inMemory',
    isActive: true
  }

  // 创建助手
  const assistant = new MCPAssistant({
    modelProvider,
    client,
    autoInjectTools: true
  })

  // 添加服务器
  await assistant.addServer(serverConfig)

  // 与助手对话
  const response = await assistant.run('请帮我记录一条笔记："会议在下午3点"')
  console.log('助手回复:', response)

  // 查看完整对话历史
  const messages = assistant.getMessages()
  console.log('对话历史:', messages)

  // 关闭助手
  await assistant.close()
}

// 运行示例
assistantExample().catch(console.error)
```

### 3. 使用工作流编排器

```typescript
import { MCPOrchestrator } from './mcp/core/MCPOrchestrator'
import { MCPClient } from './mcp/core/MCPClient'

async function workflowExample() {
  // 创建客户端
  const client = new MCPClient()

  // 创建编排器
  const orchestrator = new MCPOrchestrator(client)

  // 添加服务器
  orchestrator.addServer({
    id: 'memory-server',
    name: '内存服务器',
    type: 'inMemory',
    isActive: true
  })

  // 添加搜索服务器
  orchestrator.addServer({
    id: 'search-server',
    name: '搜索服务器',
    type: 'inMemory',
    isActive: true
  })

  // 初始化服务器连接
  await orchestrator.initializeAll()

  // 定义工作流
  const workflow = [
    // 第1步：存储用户查询
    {
      server: 'memory-server',
      tool: 'memory.store',
      args: { key: 'user-query', value: '春节是什么时候？' },
      outputVar: 'storeResult'
    },
    // 第2步：获取查询
    {
      server: 'memory-server',
      tool: 'memory.retrieve',
      args: { key: 'user-query' },
      outputVar: 'query',
      // 条件执行 - 只有当存储成功时
      condition: "{{storeResult}} !== ''"
    },
    // 第3步：执行搜索
    {
      server: 'search-server',
      tool: 'search',
      args: { query: '{{query}}' },
      outputVar: 'searchResults',
      // 错误处理 - 如果搜索失败，使用备份搜索
      onError: {
        server: 'search-server',
        tool: 'backup.search',
        args: { query: '{{query}}' },
        outputVar: 'searchResults'
      }
    }
  ]

  // 执行工作流
  const result = await orchestrator.executeWorkflow(workflow, {
    workflowId: 'query-workflow',
    recordHistory: true,
    initialContext: {
      // 可选：初始上下文变量
    }
  })

  // 检查结果
  if (result.success) {
    console.log('工作流执行成功')
    console.log('最终上下文:', result.context)

    // 访问特定结果
    console.log('搜索结果:', result.context.searchResults)
  } else {
    console.error('工作流执行失败:', result.error)
  }

  // 关闭编排器
  await orchestrator.close()
}

// 运行示例
workflowExample().catch(console.error)
```

## 实际应用场景

### 场景1：智能助手与工具集成

创建一个能够调用多种工具的智能助手，可以：

- 处理自然语言请求
- 搜索知识库
- 生成和编辑内容
- 存储和检索信息

### 场景2：多步骤自动化工作流

实现复杂的数据处理和分析流程：

- 从多个源收集数据
- 处理和转换数据
- 分析结果并生成报告
- 根据结果触发后续操作

### 场景3：AI增强型应用

构建结合AI和传统工具的应用：

- 让AI理解用户意图
- 调用适当的工具和API
- 整合结果并提供连贯的体验

## 参数说明

### 服务器配置 (MCPServerConfig)

| 参数     | 类型     | 必填 | 说明                                                |
| -------- | -------- | ---- | --------------------------------------------------- |
| id       | string   | 是   | 服务器唯一标识符                                    |
| name     | string   | 是   | 服务器显示名称                                      |
| type     | string   | 是   | 连接类型：'inMemory'/'sse'/'streamableHttp'/'stdio' |
| baseUrl  | string   | 否   | HTTP/SSE连接的基础URL                               |
| command  | string   | 否   | stdio连接的命令                                     |
| args     | string[] | 否   | 命令参数                                            |
| env      | object   | 否   | 环境变量                                            |
| headers  | object   | 否   | HTTP头信息                                          |
| isActive | boolean  | 否   | 是否启用服务器                                      |

### 工具调用结果 (MCPCallToolResponse)

| 参数    | 类型    | 说明                             |
| ------- | ------- | -------------------------------- |
| isError | boolean | 是否发生错误                     |
| content | array   | 内容数组，每个元素包含类型和文本 |

### 工作流步骤 (WorkflowStep)

| 参数      | 类型          | 必填 | 说明           |
| --------- | ------------- | ---- | -------------- |
| server    | string        | 是   | 服务器ID或名称 |
| tool      | string        | 是   | 工具名称       |
| args      | object        | 是   | 工具参数       |
| outputVar | string        | 是   | 输出变量名     |
| condition | string        | 否   | 条件表达式     |
| onError   | string/object | 否   | 错误处理策略   |

## 高级用法

查看 `examples/` 目录中的示例代码，了解如何实现更高级的功能，如：

- 复杂条件流程
- 嵌套工作流
- 动态工具调用
- 多服务器协同
- 自定义传输层实现

## 常见问题解答

1. **如何处理工具调用错误？**

   - 使用 `isError` 字段检查结果状态
   - 在工作流中使用 `onError` 定义错误处理步骤

2. **如何在步骤之间传递数据？**

   - 使用 `outputVar` 设置变量名
   - 在后续步骤中使用 `{{变量名}}` 引用

3. **如何扩展自定义工具？**
   - 实现自定义MCP服务器
   - 注册工具函数
   - 通过MCPClient连接使用

## 贡献指南

欢迎贡献代码和改进建议！请遵循以下步骤：

1. Fork项目仓库
2. 创建功能分支
3. 提交变更
4. 创建Pull Request

## 许可证

请参阅项目根目录的LICENSE文件
