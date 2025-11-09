# 工具层 LLM 集成指南

## 概述

本文档说明如何在工具层（Tool Layer）中集成 LLM 调用，确保 Token 使用追踪和积分扣费的正确性。

## 架构说明

### 调用链路

```
skill.service.ts
  ↓ prepareInvokeSkillJobData
skill-invoker.service.ts
  ↓ buildInvokeConfig (传递 engine)
agent.ts / skill
  ↓ agentNode (selectedTools 来自 config.configurable)
tool.service.ts
  ↓ instantiateRegularToolsets (传递 engine 到工具集)
SandboxToolset
  ↓ initializeTools (使用 engine 参数)
SandboxGenerateResponse
  ↓ _call (通过 engine.chatModel() 创建 LLM)
CodeInterpreterSession
  ↓ 使用预配置的 LLM 实例
```

### 关键组件

1. **SkillEngine**: 提供统一的 LLM 实例创建和配置管理
2. **BaseToolParams**: 基础工具参数接口，包含 `engine` 字段
3. **ToolService**: 负责实例化工具集并传递 engine
4. **Tool**: 工具实现，使用 `engine.chatModel()` 创建 LLM

## 使用指南

### 1. 为工具添加 Engine 支持

#### 步骤 1: 扩展工具参数接口

在你的工具参数接口中添加 `engine` 字段：

```typescript
import { SkillEngine } from '@refly/skill-template';

export interface MyToolParams {
  user: User;
  apiKey?: string;
  reflyService?: any;
  
  /**
   * SkillEngine instance for creating LLM instances.
   * When provided, the tool should use engine.chatModel() to create LLM instances,
   * which ensures proper token usage tracking and credit billing.
   */
  engine?: SkillEngine;
  
  // Other tool-specific parameters
  // ...
}
```

#### 步骤 2: 在工具实现中使用 Engine

在工具的 `_call` 方法中使用 `engine.chatModel()` 创建 LLM 实例：

```typescript
export class MyTool extends AgentBaseTool<MyToolParams> {
  name = 'myTool';
  toolsetKey = 'my-toolset';
  
  protected params: MyToolParams;

  constructor(params: MyToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      // 方式 1: 使用 engine 创建 LLM（推荐）
      if (this.params.engine) {
        const llm = this.params.engine.chatModel({
          temperature: 0.1,
        });
        
        // 使用 llm 进行调用
        const response = await llm.invoke(messages);
        
        return {
          status: 'success',
          data: response,
          summary: 'Operation completed successfully',
        };
      }
      
      // 方式 2: Fallback - 手动创建 LLM（不推荐，仅用于兼容性）
      const llm = new ChatOpenAI({
        apiKey: this.params.openaiApiKey,
        // ... other configs
      });
      
      // ...
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to process request',
        summary: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

#### 步骤 3: 传递预配置的 LLM 实例（针对第三方库）

如果你使用的第三方库需要 LLM 实例作为参数（如 sandbox-agent），可以这样做：

```typescript
async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
  // 创建第三方库的配置对象
  const createLibraryOptions = () => {
    const baseOptions = {
      apiKey: this.params.apiKey,
      // ... other options
    };

    // 如果 engine 可用，创建 LLM 实例并传递
    if (this.params.engine) {
      const llm = this.params.engine.chatModel({
        temperature: this.params.temperature ?? 0.1,
      });
      
      return {
        ...baseOptions,
        llm, // 传递预配置的 LLM 实例
      };
    }

    // Fallback: 传递配置参数让第三方库自己创建 LLM
    return {
      ...baseOptions,
      openaiApiKey: this.params.openaiApiKey,
      model: this.params.model,
      temperature: this.params.temperature,
    };
  };

  // 使用配置创建第三方库实例
  const library = new ThirdPartyLibrary(createLibraryOptions());
  const result = await library.execute(input);
  
  return {
    status: 'success',
    data: result,
  };
}
```

### 2. Token 使用追踪

使用 `engine.chatModel()` 创建的 LLM 实例会自动参与 Token 使用追踪：

```typescript
// 在工具中使用 engine.chatModel()
const llm = this.params.engine.chatModel({ temperature: 0.1 });

// 调用 LLM - Token usage 会自动被追踪
const response = await llm.invoke(messages, {
  ...config,
  metadata: {
    // LangChain 会自动记录 token usage
  },
});

// 不需要手动处理 token usage，系统会自动：
// 1. 在 streamEvents 的 on_chat_model_end 事件中收集 token usage
// 2. 通过 resultAggregator.addUsageItem() 记录
// 3. 在 skill 完成后通过 processCreditUsageReport() 进行批量扣费
```

### 3. 积分扣费流程

积分扣费是自动的，不需要在工具层手动处理：

```
1. LLM 调用产生 token usage
   ↓
2. streamEvents 触发 on_chat_model_end 事件
   ↓
3. skill-invoker.service 收集 token usage
   └─ resultAggregator.addUsageItem(runMeta, usage)
   ↓
4. Skill 执行完成后批量处理积分
   └─ processCreditUsageReport()
       ├─ 从 steps 中提取 token usage
       ├─ 查找对应的 provider items 和 credit billing 配置
       └─ 调用 syncBatchTokenCreditUsage() 进行批量扣费
```

## 实际示例：Sandbox Tool

### 参数接口定义

```typescript
// packages/agent-tools/src/sandbox/types.ts
export interface SandboxToolParams {
  user: User;
  apiKey?: string;
  reflyService?: any;
  
  /**
   * SkillEngine instance for creating LLM instances.
   * When provided, the sandbox agent will use engine.chatModel() to create LLM instances,
   * which ensures proper token usage tracking and credit billing.
   */
  engine?: SkillEngine;
  
  // Model configuration - only used when engine is not available (fallback)
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  // ... other fallback configs
}
```

### 工具实现

```typescript
// packages/agent-tools/src/sandbox/index.ts
export class SandboxGenerateResponse extends AgentBaseTool<SandboxToolParams> {
  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    // 创建会话配置的工厂函数
    const createSessionOptions = () => {
      const baseOptions = {
        apiKey: this.params.apiKey,
        // ... other options
      };

      // 优先使用 engine 创建 LLM
      if (this.params.engine) {
        const llm = this.params.engine.chatModel({
          temperature: this.params.temperature ?? 0.1,
        });
        
        return {
          ...baseOptions,
          llm, // 传递 LLM 实例给 sandbox-agent
        };
      }

      // Fallback 配置
      return {
        ...baseOptions,
        openaiApiKey: this.params.openaiApiKey,
        model: this.params.model,
        temperature: this.params.temperature,
      };
    };

    // 创建并使用会话
    const session = new CodeInterpreterSession(createSessionOptions());
    await session.start();
    
    const response = await session.generateResponse(input.message, files);
    
    return {
      status: 'success',
      data: response,
    };
  }
}
```

### 第三方库适配

```typescript
// packages/sandbox-agent/src/session.ts
export interface CodeInterpreterSessionOptions {
  /**
   * Pre-configured LLM instance to use for code interpretation.
   * When provided, this takes precedence over model configuration parameters.
   * This is the recommended approach for integration with systems that need
   * to track token usage and billing (e.g., Refly's SkillEngine).
   */
  llm?: BaseChatModel;
  
  // Fallback configuration
  openaiApiKey?: string;
  model?: string;
  temperature?: number;
  // ...
}

export class CodeInterpreterSession {
  constructor(options: CodeInterpreterSessionOptions = {}) {
    // 优先使用传入的 LLM 实例
    this.llm = options.llm || this.chooseLLM();
  }
  
  private chooseLLM(): BaseChatModel {
    // Fallback: 根据配置创建 LLM
    // ...
  }
}
```

## 最佳实践

### 1. 优先使用 Engine

始终优先使用 `engine.chatModel()` 创建 LLM 实例：

```typescript
// ✅ 推荐
if (this.params.engine) {
  const llm = this.params.engine.chatModel({ temperature: 0.1 });
}

// ❌ 不推荐（除非作为 fallback）
const llm = new ChatOpenAI({
  apiKey: this.params.openaiApiKey,
});
```

### 2. 提供 Fallback 机制

为了向后兼容和独立测试，提供 fallback 配置：

```typescript
const createSessionOptions = () => {
  const baseOptions = { /* ... */ };

  // 优先使用 engine
  if (this.params.engine) {
    return {
      ...baseOptions,
      llm: this.params.engine.chatModel({ temperature: 0.1 }),
    };
  }

  // Fallback 到手动配置
  return {
    ...baseOptions,
    openaiApiKey: this.params.openaiApiKey,
    model: this.params.model,
  };
};
```

### 3. 避免重复的 Token 追踪

不要在工具层手动记录 token usage，系统会自动处理：

```typescript
// ❌ 不需要这样做
const response = await llm.invoke(messages);
const tokenUsage = response.usage_metadata; // 不需要手动处理
// recordTokenUsage(tokenUsage); // 不需要手动记录

// ✅ 正确做法：直接使用，系统会自动追踪
const response = await llm.invoke(messages);
return { status: 'success', data: response };
```

### 4. 使用合适的 Temperature

根据工具的用途设置合适的 temperature：

```typescript
// 代码生成、数据分析等需要准确性的任务
const llm = this.params.engine.chatModel({ temperature: 0.1 });

// 创意写作、内容生成等需要多样性的任务
const llm = this.params.engine.chatModel({ temperature: 0.7 });
```

### 5. 正确处理 API Key

参考 Scalebox 工具的最佳实践，确保 API key 正确设置：

```typescript
/**
 * Ensure API key is set in environment variable.
 * This is required by some underlying SDKs that expect the API key in process.env.
 */
function ensureApiKey(apiKey?: string): void {
  if (apiKey && (!process.env.YOUR_SDK_API_KEY || process.env.YOUR_SDK_API_KEY !== apiKey)) {
    process.env.YOUR_SDK_API_KEY = apiKey;
  }
}

export class MyTool extends AgentBaseTool<MyToolParams> {
  async _call(input: any): Promise<ToolCallResult> {
    // 确保 API key 设置在环境变量中
    ensureApiKey(this.params.apiKey);
    
    try {
      // 创建 SDK 实例时同时传递 API key 和使用环境变量
      const sdk = await YourSDK.create({
        apiKey: this.params.apiKey ?? process.env.YOUR_SDK_API_KEY,
        // ... other options
      });
      
      // ... 使用 SDK
    } catch (error) {
      // ... error handling
    }
  }
}
```

**为什么需要这样做**：
- 某些 SDK 会从 `process.env` 读取 API key
- 同时在参数中传递 API key 作为备用
- 确保在多用户/多租户环境中正确隔离 API key

## 类型定义位置

### 当前方案（临时）

为了避免循环依赖，当前在相关接口中使用 `any` 类型：

```typescript
// packages/agent-tools/src/base.ts
export interface BaseToolParams {
  engine?: any; // 使用 any 避免循环依赖
}
```

### 推荐方案

将共享的接口类型移到 `@refly/common-types` 包中：

```typescript
// packages/common-types/src/skill-engine.ts
/**
 * Minimal interface for SkillEngine that tools need to access.
 * This avoids circular dependency between @refly/agent-tools and @refly/skill-template.
 */
export interface ISkillEngine {
  /**
   * Create a chat model instance with the specified parameters.
   * This ensures proper token usage tracking and credit billing.
   */
  chatModel(params?: {
    temperature?: number;
    topP?: number;
    [key: string]: any;
  }, scene?: 'chat' | 'agent' | 'titleGeneration' | 'queryAnalysis'): any;
  
  service?: any;
  logger?: any;
}

// packages/agent-tools/src/base.ts
import { ISkillEngine } from '@refly/common-types';

export interface BaseToolParams {
  engine?: ISkillEngine;
}
```

这样做的好处：
1. ✅ 避免循环依赖
2. ✅ 类型安全
3. ✅ 清晰的接口定义
4. ✅ 便于文档化

## 测试建议

### 1. 功能测试

```typescript
describe('MyTool with engine', () => {
  it('should use engine.chatModel() when engine is provided', async () => {
    const mockEngine = {
      chatModel: jest.fn().mockReturnValue(mockLLM),
    };
    
    const tool = new MyTool({
      user: mockUser,
      engine: mockEngine,
    });
    
    await tool.invoke(input);
    
    expect(mockEngine.chatModel).toHaveBeenCalledWith({
      temperature: 0.1,
    });
  });
  
  it('should fallback to manual LLM creation when engine is not provided', async () => {
    const tool = new MyTool({
      user: mockUser,
      openaiApiKey: 'test-key',
    });
    
    await tool.invoke(input);
    
    // Verify fallback behavior
  });
});
```

### 2. Token 追踪测试

```typescript
describe('Token usage tracking', () => {
  it('should track token usage from engine-created LLM', async () => {
    const resultAggregator = new ResultAggregator(/* ... */);
    
    // Execute skill with tool that uses engine
    await executeSkillWithTool();
    
    const steps = await resultAggregator.getSteps();
    const tokenUsage = steps[0].tokenUsage;
    
    expect(tokenUsage).toBeDefined();
    expect(tokenUsage.inputTokens).toBeGreaterThan(0);
    expect(tokenUsage.outputTokens).toBeGreaterThan(0);
  });
});
```

### 3. 积分扣费测试

```typescript
describe('Credit billing', () => {
  it('should correctly bill credits for tool LLM usage', async () => {
    const initialCredits = await getCredits(user.uid);
    
    // Execute tool that uses LLM
    await executeTool();
    
    const finalCredits = await getCredits(user.uid);
    const creditUsed = initialCredits - finalCredits;
    
    expect(creditUsed).toBeGreaterThan(0);
  });
});
```

## 故障排查

### 问题 1: Token Usage 未被追踪

**症状**：使用工具后没有 token usage 记录

**可能原因**：
- 没有使用 `engine.chatModel()` 创建 LLM
- LLM 调用不在 streamEvents 追踪范围内

**解决方案**：
```typescript
// 确保使用 engine.chatModel()
const llm = this.params.engine.chatModel({ temperature: 0.1 });

// 确保在正确的 config 上下文中调用
const response = await llm.invoke(messages, config);
```

### 问题 2: 积分未正确扣除

**症状**：工具执行后积分没有变化

**可能原因**：
- Token usage 没有正确记录到 steps 中
- Provider item 没有配置 credit billing

**解决方案**：
1. 检查 token usage 是否被记录
2. 检查 provider item 的 creditBilling 配置
3. 查看 `processCreditUsageReport` 的日志

### 问题 3: 循环依赖错误

**症状**：`Cannot access 'X' before initialization`

**解决方案**：
1. 临时方案：使用 `any` 类型
2. 长期方案：将接口移到 `@refly/common-types`

## 相关资源

- [SkillEngine 文档](./skill-engine.md)
- [工具开发指南](./tool-development.md)
- [积分计费系统](./credit-billing.md)
- [API 参考](../../api/skill-engine.md)

