# Tool-Engine Integration - Implementation Summary

## 概述 / Overview

本文档总结了工具层 LLM 集成的实现细节，包括类型定义的重构和循环依赖的解决方案。

This document summarizes the implementation details of tool-layer LLM integration, including type definition refactoring and circular dependency solutions.

## 改动清单 / Change List

### 1. 新增类型定义包 / New Type Definition Package

**文件 / File**: `packages/common-types/src/skill-engine.ts`

创建了共享的接口定义，避免 `@refly/agent-tools` 和 `@refly/skill-template` 之间的循环依赖。

Created shared interface definitions to avoid circular dependencies between `@refly/agent-tools` and `@refly/skill-template`.

```typescript
export interface ISkillEngine {
  chatModel(params?: ChatModelParams, scene?: ModelScene): any;
  service?: any;
  logger?: ILogger;
}
```

**关键接口 / Key Interfaces**:
- `ISkillEngine`: SkillEngine 的最小接口定义
- `ILogger`: 日志接口
- `ModelScene`: 模型使用场景类型
- `ChatModelParams`: LLM 创建参数

### 2. 更新工具基础类型 / Updated Tool Base Types

**文件 / File**: `packages/agent-tools/src/base.ts`

```typescript
import type { ISkillEngine } from '@refly/common-types';

export interface BaseToolParams {
  reflyService?: ReflyService;
  isGlobalToolset?: boolean;
  engine?: ISkillEngine; // 替换了之前的 any 类型
}
```

**改进 / Improvements**:
- ✅ 类型安全：使用具体接口替代 `any`
- ✅ 避免循环依赖：通过 `@refly/common-types` 中转
- ✅ 清晰的文档：接口包含完整的 JSDoc 注释

### 3. 更新 Sandbox 工具类型 / Updated Sandbox Tool Types

**文件 / File**: `packages/agent-tools/src/sandbox/types.ts`

```typescript
import type { ISkillEngine } from '@refly/common-types';

export interface SandboxToolParams {
  user: User;
  apiKey?: string;
  reflyService?: any;
  engine?: ISkillEngine; // 类型安全的 engine 参数
  
  // Fallback 配置参数
  openaiApiKey?: string;
  model?: string;
  temperature?: number;
  // ...
}
```

### 4. 更新包依赖 / Updated Package Dependencies

**文件 / File**: `packages/agent-tools/package.json`

添加了 `@refly/common-types` 依赖：

```json
{
  "dependencies": {
    "@refly/common-types": "workspace:*",
    // ... other dependencies
  }
}
```

### 5. 文档更新 / Documentation Updates

#### 中文文档 / Chinese Documentation
- `docs/zh/guide/tool-engine-integration.md`
  - 完整的使用指南
  - 实际示例代码
  - 最佳实践
  - 故障排查

#### 英文文档 / English Documentation
- `docs/en/guide/tool-engine-integration.md`
  - Complete usage guide
  - Real-world examples
  - Best practices
  - Troubleshooting

## 架构优势 / Architecture Benefits

### 解决循环依赖 / Resolving Circular Dependencies

**之前 / Before**:
```
@refly/agent-tools
  └─ depends on @refly/skill-template (for SkillEngine type)
     └─ depends on @refly/agent-tools (for tools)
        ❌ CIRCULAR DEPENDENCY
```

**现在 / Now**:
```
@refly/common-types
  └─ defines ISkillEngine interface

@refly/agent-tools
  └─ depends on @refly/common-types (for ISkillEngine)

@refly/skill-template
  └─ implements ISkillEngine
  └─ depends on @refly/agent-tools (for tools)
  
✅ NO CIRCULAR DEPENDENCY
```

### 类型安全 / Type Safety

**之前 / Before**:
```typescript
export interface BaseToolParams {
  engine?: any; // 缺少类型检查
}
```

**现在 / Now**:
```typescript
import type { ISkillEngine } from '@refly/common-types';

export interface BaseToolParams {
  engine?: ISkillEngine; // 完整的类型检查和 IDE 支持
}
```

### 接口清晰度 / Interface Clarity

`ISkillEngine` 接口明确定义了工具层需要的最小功能集：

```typescript
export interface ISkillEngine {
  /**
   * 创建 LLM 实例，自动支持 token 追踪
   * Creates LLM instance with automatic token tracking
   */
  chatModel(params?: ChatModelParams, scene?: ModelScene): any;
  
  /**
   * Refly 服务实例
   * Refly service instance
   */
  service?: any;
  
  /**
   * 日志实例
   * Logger instance
   */
  logger?: ILogger;
}
```

## 使用示例 / Usage Examples

### 基础用法 / Basic Usage

```typescript
/**
 * Ensure API key is set in environment variable.
 * Required by some SDKs that read from process.env.
 */
function ensureApiKey(apiKey?: string): void {
  if (apiKey && (!process.env.YOUR_SDK_API_KEY || process.env.YOUR_SDK_API_KEY !== apiKey)) {
    process.env.YOUR_SDK_API_KEY = apiKey;
  }
}

export class MyTool extends AgentBaseTool<MyToolParams> {
  async _call(input: any): Promise<ToolCallResult> {
    // 1. 确保 API key 设置在环境变量中（某些 SDK 需要）
    ensureApiKey(this.params.apiKey);
    
    // 2. 使用 engine 创建 LLM
    if (this.params.engine) {
      const llm = this.params.engine.chatModel({
        temperature: 0.1,
      });
      
      const response = await llm.invoke(messages);
      return { status: 'success', data: response };
    }
    
    // 3. Fallback 逻辑
    // ...
  }
}
```

### 传递给第三方库 / Passing to Third-party Libraries

```typescript
async _call(input: any): Promise<ToolCallResult> {
  // 确保 API key 在环境变量中
  ensureApiKey(this.params.apiKey);
  
  const createLibraryOptions = () => {
    const baseOptions = {
      // 双重保险：既传递参数也设置环境变量
      apiKey: this.params.apiKey ?? process.env.YOUR_SDK_API_KEY,
    };
    
    if (this.params.engine) {
      return {
        ...baseOptions,
        llm: this.params.engine.chatModel({ temperature: 0.1 }),
        // ... other options
      };
    }
    
    // Fallback configuration
    return {
      ...baseOptions,
      openaiApiKey: this.params.openaiApiKey,
      // ...
    };
  };

  const library = new ThirdPartyLibrary(createLibraryOptions());
  // ...
}
```

## 迁移指南 / Migration Guide

### 对于现有工具 / For Existing Tools

如果你有使用 `any` 类型的工具参数：

If you have tool parameters using `any` type:

```typescript
// 之前 / Before
export interface MyToolParams {
  engine?: any;
}

// 现在 / Now
import type { ISkillEngine } from '@refly/common-types';

export interface MyToolParams {
  engine?: ISkillEngine;
}
```

### 对于新工具 / For New Tools

直接使用 `ISkillEngine` 类型：

Directly use `ISkillEngine` type:

```typescript
import type { ISkillEngine } from '@refly/common-types';
import { AgentBaseTool } from '@refly/agent-tools';

export interface NewToolParams {
  user: User;
  engine?: ISkillEngine;
  // ... other params
}

export class NewTool extends AgentBaseTool<NewToolParams> {
  async _call(input: any): Promise<ToolCallResult> {
    if (this.params.engine) {
      const llm = this.params.engine.chatModel({ temperature: 0.1 });
      // Use llm...
    }
    // ...
  }
}
```

## 验证清单 / Verification Checklist

### 类型检查 / Type Checking

- [x] `ISkillEngine` 接口在 `@refly/common-types` 中定义
- [x] `BaseToolParams` 使用 `ISkillEngine` 类型
- [x] `SandboxToolParams` 使用 `ISkillEngine` 类型
- [x] `@refly/agent-tools` 依赖 `@refly/common-types`
- [x] 没有循环依赖

### 功能验证 / Functional Verification

- [x] Engine 正确传递到工具层
- [x] 工具可以使用 `engine.chatModel()` 创建 LLM
- [x] Token usage 自动追踪
- [x] 积分扣费逻辑正常工作
- [x] Fallback 机制正常工作

### 文档完整性 / Documentation Completeness

- [x] 中文使用指南
- [x] 英文使用指南
- [x] 类型定义文档
- [x] 示例代码
- [x] 最佳实践
- [x] 故障排查指南

## 下一步 / Next Steps

### 建议的改进 / Recommended Improvements

1. **扩展 ISkillEngine 接口**
   - 添加更多工具可能需要的方法
   - 考虑添加配置访问方法

2. **创建工具开发模板**
   - 提供标准的工具模板
   - 包含 engine 集成示例

3. **添加测试工具**
   - 创建 mock ISkillEngine 实现
   - 简化工具单元测试

### 潜在的扩展点 / Potential Extension Points

1. **多模型支持**
   ```typescript
   interface ISkillEngine {
     chatModel(...): BaseChatModel;
     embeddingModel(...): Embeddings;
     imageModel(...): ImageGenerator;
   }
   ```

2. **配置访问**
   ```typescript
   interface ISkillEngine {
     getConfig(key: string): any;
     setConfig(key: string, value: any): void;
   }
   ```

3. **监控和日志**
   ```typescript
   interface ISkillEngine {
     trackMetric(name: string, value: number): void;
     logger: ILogger;
   }
   ```

## 相关资源 / Related Resources

- [工具-Engine 集成指南](./docs/zh/guide/tool-engine-integration.md)
- [Tool-Engine Integration Guide](./docs/en/guide/tool-engine-integration.md)
- [Common Types 包文档](./packages/common-types/README.md)
- [Agent Tools 包文档](./packages/agent-tools/README.md)

## 联系方式 / Contact

如有问题或建议，请：
- 创建 Issue
- 提交 Pull Request
- 在 Discord 社区讨论

For questions or suggestions:
- Create an Issue
- Submit a Pull Request
- Discuss in Discord community

