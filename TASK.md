# Sandbox 代码执行功能 - 任务上下文

> **IMPORTANT**:
> 1. 本文档记录的是特性开发分支 `feat/sandbox-optimization` 的完整状态。任务期间无需考虑向后兼容性或保留历史代码痕迹（如注释掉的代码、弃用标记等）。所有设计和实现以当前最终状态为准，不需要为中间迭代留档。
> 2. **任务执行期间应按需更新本文档**，确保关键设计决策、架构变更、文件清单等内容与代码保持同步，以便后续会话能快速恢复准确的上下文。

## 任务目标

实现和优化基于 Scalebox SDK 的安全代码沙盒执行环境，支持文件持久化、资源池化和队列管理。

## 核心架构

### 执行流程
1. **请求入口**: Agent 工具调用 → API Service → BullMQ Queue
2. **资源获取**: SandboxPool (Redis-based) → 复用 idle 沙盒或创建新沙盒
3. **文件持久化**: S3 通过 s3fs 挂载到沙盒 `/mnt/refly/canvas`
4. **代码执行**: SandboxWrapper 封装 Scalebox SDK 执行
5. **资源释放**: 沙盒返回 idle pool，等待复用或过期

### S3 存储约定
- **路径**: `s3://refly-devbox-private/tmp/perish/canvas/{canvasId}/`
- **挂载点**: `/mnt/refly/canvas` (Canvas 与 Sandbox 1:1 映射)
- **临时前缀**: `tmp/perish` (开发测试，可安全删除)

## 关键代码风格

### 1. 配置管理规范
**设计原则**：配置读取与默认值管理分离
- **app.config.ts**: 只负责读取 `process.env.*`，不提供默认值
- **constants.ts**: 统一维护 `*_DEFAULT_*` 常量作为默认值
- **service.ts**: 使用 `@Config` 装饰器时从 constants 引入默认值
- **对象配置**: 使用 `@Config.object` 装饰器简化复杂配置注入
- **必填参数**: 在调用位置使用 `guard` 验证

**示例**：
```typescript
// constants.ts
export const SCALEBOX_DEFAULT_TIMEOUT = 30000;
export const S3_DEFAULT_CONFIG = {
  endpoint: 's3.us-east-1.amazonaws.com',
  port: 443,
  accessKey: '',  // 必填，由环境变量提供
  secretKey: '',  // 必填，由环境变量提供
  bucket: 'refly-devbox-private',
} as const;

// app.config.ts
sandbox: {
  scalebox: {
    timeout: process.env.SCALEBOX_TIMEOUT,
    s3: {
      endpoint: process.env.SANDBOX_S3_ENDPOINT,
      accessKey: process.env.SANDBOX_S3_ACCESS_KEY,
      // ... 其他 S3 配置
    },
  },
}

// service.ts
@Config.integer('sandbox.scalebox.timeout', SCALEBOX_DEFAULT_TIMEOUT)
private timeout: number;

@Config.object('sandbox.scalebox.s3', S3_DEFAULT_CONFIG)
private s3ConfigRaw: S3Config;

private getS3Config(): S3Config {
  // 必填参数使用 guard 验证
  guard.notEmpty(this.s3ConfigRaw.accessKey)
    .orThrow(() => new Error('S3 accessKey is required'));
  return this.s3ConfigRaw;
}
```

### 2. Guard 错误处理模式
```typescript
// 抛出异常
const result = await guard(() => doWork()).orThrow((e) => new CustomException(e));

// 提供降级
const result = await guard(() => doWork()).orElse((error) => {
  logger.warn(error, 'Fallback logic');
  return null;
});

// 资源清理保证
return guard.defer(
  () => this.acquireResource(),
  () => this.releaseResource()
);

// 最大努力执行（失败不影响主流程）
await guard.bestEffort(
  () => this.cleanup(),
  (error) => logger.warn(error, 'Cleanup failed')
);
```

### 3. 配置装饰器
```typescript
@Config.string('sandbox.scalebox.apiKey', '')
private scaleboxApiKey: string;

@Config.integer('sandbox.scalebox.maxQueueSize', DEFAULT_VALUE)
private maxQueueSize: number;
```

### 4. 结构化日志
```typescript
this.logger.info(
  {
    sandboxId: wrapper.sandboxId,
    canvasId: wrapper.canvasId,
    executionTime,
  },
  'Code execution completed'
);
```

### 5. 异常体系
所有自定义异常继承自 `SandboxException`，提供:
- `code`: 机器可读的错误码
- `getFormattedMessage()`: 格式化的错误消息

## 核心文件索引

### Backend (NestJS)
- **服务主入口**: `apps/api/src/modules/tool/sandbox/scalebox.service.ts`
  - `execute()`: 对外 API，队列调度
  - `executeCode()`: 内部执行逻辑

- **沙盒池管理**: `apps/api/src/modules/tool/sandbox/scalebox.pool.ts`
  - `acquire()`: 获取可用沙盒（复用或新建）
  - `release()`: 释放沙盒到 idle pool

- **沙盒包装器**: `apps/api/src/modules/tool/sandbox/scalebox.wrapper.ts`
  - `create()`: 创建新沙盒并挂载 S3
  - `reconnect()`: 重连已有沙盒
  - `mountS3()`: s3fs 挂载逻辑

- **队列处理器**: `apps/api/src/modules/tool/sandbox/scalebox.processor.ts`
  - BullMQ worker，消费执行任务

- **常量和配置**: `apps/api/src/modules/tool/sandbox/scalebox.constants.ts`
  - S3 配置、超时、队列大小等

### Agent 工具
- **工具定义**: `packages/agent-tools/src/sandbox/index.ts`
  - `Execute` 工具: 执行代码的 LangChain 工具
  - `SandboxToolset`: 工具集导出

### 配置和 Schema
- **应用配置**: `apps/api/src/modules/config/app.config.ts:217-226`
  - `sandbox.scalebox.*` 配置项

- **API Schema**: `packages/openapi-schema/schema.yml:8315-8373`
  - `SandboxExecuteRequest`
  - `SandboxExecuteResponse`

## 最近改动 (git log)

```
5ee41c388 WIP: refactor sandbox error handling and logging
d8e362fc7 refactor(sandbox): implement manual s3fs mounting and optimize architecture
85a239201 refactor(config): handle multiple input types in decorators
cb986c6c0 fix(config): handle falsy values correctly in decorators
fca66869f refactor(config): rename config.service.ts to config.decorator.ts
```

## 待优化项

1. **S3 配置外部化**: 将 `S3_CONFIG` 从常量移到环境变量
2. **错误信息截断**: 当前限制 1000 字符，考虑可配置
3. **监控指标**: 添加 Pool stats、Queue metrics 暴露
4. **健康检查**: 定期清理过期/不健康的沙盒
5. **并发优化**: 根据实际负载调整 `CONCURRENCY` 和 `MAX_SANDBOXES`

## 关键设计决策

- **为什么用 Redis Pool 而非内存池**: 支持多实例部署，避免沙盒资源浪费
- **为什么用 s3fs 而非 SDK**: 保持文件系统语义，Agent 代码无需修改
- **为什么 1:1 Canvas-Sandbox 映射**: 简化路径管理，避免权限泄露
- **为什么用 BullMQ**: 支持超时控制、任务持久化和重试

## 本次任务变更文件

### 新增文件

**核心 Sandbox 模块**:
- `apps/api/src/modules/tool/sandbox/scalebox.service.ts` - 服务主入口
- `apps/api/src/modules/tool/sandbox/scalebox.pool.ts` - Redis 沙盒池管理
- `apps/api/src/modules/tool/sandbox/scalebox.wrapper.ts` - Scalebox SDK 封装
- `apps/api/src/modules/tool/sandbox/scalebox.processor.ts` - BullMQ 队列处理器
- `apps/api/src/modules/tool/sandbox/scalebox.module.ts` - NestJS 模块定义
- `apps/api/src/modules/tool/sandbox/scalebox.exception.ts` - 结构化异常体系
- `apps/api/src/modules/tool/sandbox/scalebox.dto.ts` - 内部 DTO 定义
- `apps/api/src/modules/tool/sandbox/scalebox.utils.ts` - 工具函数
- `apps/api/src/modules/tool/sandbox/scalebox.constants.ts` - 常量配置

**基础设施工具**:
- `apps/api/src/utils/guard.ts` - Rust 风格错误处理
- `apps/api/src/modules/config/config.decorator.ts` - 配置装饰器

**Agent 工具层**:
- `packages/agent-tools/src/sandbox/index.ts` - LangChain 工具定义

**文档**:
- `SANDBOX_REDIS_MIGRATION.md` - Redis 池迁移说明文档

### 修改文件

**配置和模块集成**:
- `apps/api/src/modules/config/app.config.ts` - 添加 `sandbox.scalebox.*` 配置
- `apps/api/src/modules/tool/tool.module.ts` - 集成 Sandbox 模块
- `packages/agent-tools/src/inventory.ts` - 注册 SandboxToolset
- `packages/agent-tools/src/index.ts` - 导出 Sandbox 工具
- `packages/agent-tools/src/builtin/interface.ts` - 类型定义更新

**API Schema**:
- `packages/openapi-schema/schema.yml` - 添加 `SandboxExecuteRequest/Response`
- `packages/openapi-schema/src/schemas.gen.ts` - 自动生成的 Schema
- `packages/openapi-schema/src/types.gen.ts` - 自动生成的 TypeScript 类型

**开发环境**:
- `.vscode/launch.json` - 调试配置更新
- `apps/api/nodemon.json` - Nodemon 配置
- `apps/api/package.json` - 依赖项更新（@scalebox/sdk, bullmq）
- `pnpm-lock.yaml` - 依赖锁定文件

**Skill 引擎**:
- `apps/api/src/modules/skill/skill-engine.service.ts` - 集成 Sandbox 工具
- `apps/api/src/modules/skill/skill-invoker.service.ts` - 调用逻辑调整

### 删除文件

无（本次任务为新功能开发，未删除文件）
