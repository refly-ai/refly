# Sandbox 代码执行功能 - 任务上下文

> **IMPORTANT**:
> 1. 本文档记录的是特性开发分支 `feat/sandbox-optimization` 的完整状态。任务期间无需考虑向后兼容性或保留历史代码痕迹（如注释掉的代码、弃用标记等）。所有设计和实现以当前最终状态为准，不需要为中间迭代留档。
> 2. **任务执行期间应按需更新本文档**，确保关键设计决策、架构变更、文件清单等内容与代码保持同步，以便后续会话能快速恢复准确的上下文。

## 任务目标

实现和优化基于 Scalebox SDK 的安全代码沙盒执行环境，支持文件持久化、资源池化和队列管理。

## 核心架构

### 执行流程
1. **请求入口**: Agent 工具调用 → API Service → BullMQ Queue (携带 version 参数)
2. **资源获取**: SandboxPool (Redis-based) → 复用 idle 沙盒或创建新沙盒
3. **双挂载初始化**:
   - Input 挂载: `drive/{uid}/{canvasId}/ → /mnt/refly/input` (只读，用户资源)
   - Output 动态挂载: `sandbox/{uid}/{canvasId}/{version}/ → /mnt/refly/output` (读写，执行输出)
4. **代码执行**:
   - Python 代码自动注入 `input_path()` / `output_path()` 辅助函数
   - SandboxWrapper 检测 version 变化，按需 remount output 目录
   - 在 `/mnt/refly/output` 工作目录执行代码
5. **文件检测**: 对比执行前后 output 目录状态，检测新生成的文件
6. **文件上传**: 通过 DriveService 将生成文件持久化（使用 output S3 路径）
7. **资源释放**: 沙盒返回 idle pool，等待复用或过期

### S3 存储约定

**配置来源**: 统一使用 `objectStorage.minio.internal` 配置（与系统存储配置一致）

**双路径架构**:

1. **Input 路径** (用户资源层)
   - **S3 路径**: `{drivePrefix}/{uid}/{canvasId}/`
     - `drivePrefix`: 默认 `'drive'`，来自 `drive.storageKeyPrefix`
   - **挂载点**: `/mnt/refly/input` (只读)
   - **用途**: 用户上传文件、历史执行结果
   - **生命周期**: 沙盒创建时挂载，复用期间保持不变

2. **Output 路径** (执行结果层)
   - **S3 路径**: `sandbox/{uid}/{canvasId}/{version}/`
     - `uid`: 用户 ID，多用户隔离
     - `canvasId`: Canvas ID，Canvas 与 Sandbox 1:1 映射
     - `version`: 执行版本号，每次执行独立目录
   - **挂载点**: `/mnt/refly/output` (读写，工作目录)
   - **用途**: 当前执行生成的文件
   - **生命周期**: 每次 `executeCode()` 前检查，version 变化时重新挂载

**临时前缀**: `tmp/perish` 仍用于开发测试，可安全删除

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

### 6. 双挂载点模式
```typescript
// Wrapper 创建时挂载 input (只读)
static async create(context: SandboxContext, timeoutMs: number) {
  // ...
  await wrapper.mountInput(context); // 只读，用户资源
  // Output 在 executeCode 时动态挂载
}

// Service 构建完整 output 路径并传递给 executeCode
const outputPath = buildS3Path.output(
  S3_SANDBOX_PATH_PREFIX,
  uid,
  canvasId,
  version
); // sandbox/{uid}/{canvasId}/{version}/

// executeCode 接收完整 outputPath
async executeCode(code: string, language: Language, outputPath: string, logger: PinoLogger) {
  // 检测路径变化，按需 remount
  if (this.currentOutputPath !== outputPath) {
    await this.remountOutput(outputPath, logger);
    this.currentOutputPath = outputPath;
  }

  // 注入 helper 函数（Python）
  const finalCode = this.injectPathHelpers(code, language);

  // 执行代码
  return this.sandbox.runCode(finalCode, { language, cwd: OUTPUT_MOUNT_POINT });
}
```

### 7. Python Helper 函数注入
```python
# 自动注入到用户代码前
def input_path(filename: str) -> str:
    """Get full path for reading input files"""
    return f"/mnt/refly/input/{filename}"

def output_path(filename: str) -> str:
    """Get full path for writing output files"""
    return f"/mnt/refly/output/{filename}"

# 用户代码示例
import pandas as pd
df = pd.read_csv(input_path('data.csv'))    # 读取用户上传文件
df.to_csv(output_path('result.csv'))         # 生成输出文件
```

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
[待提交] feat(sandbox): implement dual-mount architecture with input/output isolation
  - 架构重构：单一挂载点 → 双挂载点（input 只读 + output 读写）
  - Input 路径：drive/{uid}/{canvasId}/ → /mnt/refly/input (只读，用户资源)
  - Output 路径：sandbox/{uid}/{canvasId}/{version}/ → /mnt/refly/output (读写，执行结果)
  - 实现 version 参数贯穿全链路（OpenAPI → Service → Wrapper）
  - 动态 output remounting：检测 version 变化自动重新挂载
  - Python helper 函数自动注入：input_path() / output_path()
  - 移除旧的 SANDBOX_MOUNT_POINT 常量
  - 工具描述更新：引导模型使用正确的读写路径

81a20cbff feat(sandbox): add file generation support and unify S3 configuration
  - 迁移 S3 配置从 sandbox.scalebox.s3 到 objectStorage.minio.internal 实现统一存储管理
  - 添加文件生成检测（对比执行前后目录状态）
  - 集成 DriveService 持久化生成的文件和元数据
  - 引入 uid 参数实现多用户隔离
  - 优化 S3 路径结构：tmp/perish/canvas/{canvasId} → {prefix}/{uid}/{canvasId}
  - UI 增强：支持显示多个生成的文件
```

## 待优化项

1. **错误信息截断**: 当前限制 1000 字符，考虑可配置
2. **监控指标**: 添加 Pool stats、Queue metrics 暴露
3. **健康检查**: 定期清理过期/不健康的沙盒
4. **并发优化**: 根据实际负载调整 `CONCURRENCY` 和 `MAX_SANDBOXES`
5. **文件生成优化**: 考虑支持大文件、文件过滤规则等
6. **多语言 helper 函数**: 扩展到 JavaScript/TypeScript 等其他语言
7. **Input 文件索引**: 提供 list_input_files() 让模型了解可用资源
8. **Output 清理策略**: 定期清理过期 version 的 output 目录

## 关键设计决策

### 基础架构
- **为什么用 Redis Pool 而非内存池**: 支持多实例部署，避免沙盒资源浪费
- **为什么用 s3fs 而非 SDK**: 保持文件系统语义，Agent 代码无需修改
- **为什么 1:1 Canvas-Sandbox 映射**: 简化路径管理，避免权限泄露
- **为什么用 BullMQ**: 支持超时控制、任务持久化和重试

### 存储策略
- **为什么统一 S3 配置**: 复用系统级存储配置，避免配置冗余，便于统一管理
- **为什么引入 uid 路径隔离**: 支持多用户并发使用，防止文件访问冲突
- **为什么检测文件生成**: 自动将代码生成的文件（图表、数据文件等）持久化到用户 Drive，提升用户体验

### 双挂载点架构 (新增)
- **为什么区分 Input/Output**:
  - **安全性**: Input 只读防止意外修改用户资源
  - **清晰性**: 明确区分用户资源与执行产物
  - **可追溯性**: Output 按 version 隔离，便于版本对比和回溯
- **为什么 version 必填**: 确保每次执行都有独立的 output 目录，避免文件覆盖冲突
- **为什么动态 remount Output**:
  - 沙盒可复用，但每次执行需要独立的 output 空间
  - 缓存机制避免相同 outputPath 重复挂载，提升性能
- **为什么 Context 不包含 s3OutputPath**:
  - Context 职责明确：仅包含沙盒**初始化**时需要的信息
  - Output 路径是**执行时**动态的（依赖 version），由 Service 构建并传递
  - 职责分离：创建逻辑 vs 执行逻辑
- **为什么注入 helper 函数**:
  - 降低模型路径错误概率（模型只需调用函数，无需记忆路径）
  - 统一路径管理，便于未来扩展（如路径验证、权限检查）
  - 提升代码可读性和可维护性

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

**核心 Sandbox 模块** (双挂载点架构重构):
- `apps/api/src/modules/tool/sandbox/scalebox.wrapper.ts` - 实现双挂载点 + 动态 remounting + Python helper 注入
- `apps/api/src/modules/tool/sandbox/scalebox.pool.ts` - Context 传递 input/output 路径
- `apps/api/src/modules/tool/sandbox/scalebox.service.ts` - 支持 version 参数，文件上传使用 output 路径
- `apps/api/src/modules/tool/sandbox/scalebox.processor.ts` - 传递 version 参数
- `apps/api/src/modules/tool/sandbox/scalebox.utils.ts` - buildS3Path 拆分为 input/output 变体
- `apps/api/src/modules/tool/sandbox/scalebox.constants.ts` - 新增 INPUT/OUTPUT 挂载点，移除旧常量
- `apps/api/src/modules/tool/sandbox/scalebox.dto.ts` - ScaleboxExecutionJobData 添加 version 字段

**配置和模块集成**:
- `apps/api/src/modules/config/app.config.ts` - 添加 `sandbox.scalebox.*` 配置，移除独立 S3 配置，添加 MinIO region 支持
- `apps/api/src/modules/tool/tool.module.ts` - 集成 Sandbox 模块
- `packages/agent-tools/src/inventory.ts` - 注册 SandboxToolset
- `packages/agent-tools/src/index.ts` - 导出 Sandbox 工具
- `packages/agent-tools/src/builtin/interface.ts` - 类型定义更新
- `packages/agent-tools/src/base.ts` - 基础工具类更新

**API Schema**:
- `packages/openapi-schema/schema.yml` - SandboxExecuteRequest 添加 version (required)，支持文件生成结果
- `packages/openapi-schema/src/schemas.gen.ts` - 自动生成的 Schema
- `packages/openapi-schema/src/types.gen.ts` - 自动生成的 TypeScript 类型

**Agent 工具层**:
- `packages/agent-tools/src/sandbox/index.ts` - 读取 version，更新工具描述（引导模型使用 helper 函数）

**UI 组件**:
- `packages/ai-workspace-common/src/components/markdown/plugins/tool-call/render.tsx` - 工具调用结果渲染，支持多文件显示

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
