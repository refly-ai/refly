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
3. **挂载初始化** (仅在沙盒创建时执行一次):
   - Drive 挂载: `drive/{uid}/{canvasId}/ → /mnt/refly` (读写，包含用户上传文件和生成文件)
4. **代码执行**:
   - 直接在 `/mnt/refly` 工作目录执行代码
   - 同一 canvas 的所有执行共享相同的工作目录
5. **文件检测**: 对比执行前后工作目录状态，检测新生成的文件
6. **文件注册**: 通过 DriveService.batchCreateDriveFiles 将新文件注册到数据库
   - DriveService 自动归档同名/同 resultId 的旧文件到 archive
   - 新文件成为新的 present 版本
7. **资源释放**: 沙盒返回 idle pool，等待复用或过期

### S3 存储约定

**配置来源**: 统一使用 `objectStorage.minio.internal` 配置（与系统存储配置一致）

**存储架构**:

1. **Drive 路径** (统一存储层)
   - **S3 路径**: `{drivePrefix}/{uid}/{canvasId}/`
     - `drivePrefix`: 默认 `'drive'`，来自 `drive.storageKeyPrefix`
     - 由 `DriveService.buildS3DrivePath(uid, canvasId)` 构建
     - `uid`: 用户 ID，多用户隔离
     - `canvasId`: Canvas ID，Canvas 与 Sandbox 1:1 映射
   - **挂载点**: `/mnt/refly` (读写，工作目录)
   - **用途**: 用户上传文件 + 代码生成文件，所有文件统一存储
   - **生命周期**: 沙盒创建时挂载，复用期间保持不变

**路径管理**: 所有 S3 路径构建逻辑已统一到 `DriveService`，确保一致性

**文件版本管理**:
- 所有执行共享同一个工作目录，无版本隔离
- DriveService 通过 archive 机制在应用层管理文件版本
- 每次调用 batchCreateDriveFiles 时自动归档旧版本到 `{canvasId}-archive/`
- Present 文件永远是最新版本，历史版本带时间戳保存

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

// 重试机制（网络操作、临时故障）
const result = await guard
  .retry(() => sandbox.commands.run(mountCmd), {
    maxAttempts: 3,
    delayMs: 2000,
  })
  .orThrow((e) => new SandboxMountException(e, this.canvasId));

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

**异常定义规范**:
所有自定义异常继承自 `SandboxException`，提供:
- `code`: 机器可读的错误码
- `getFormattedMessage()`: 格式化的错误消息
- **构造函数简化**: 直接包装原始 error，无需传递过多上下文参数

**异常处理策略**:
- **默认行为**: 所有异常全部抛出，让上层调用者决定如何处理
- **降级处理**: 仅在显式设计降级策略时使用 `guard().orElse()`
- **最佳实践**: 使用 `guard().orThrow((e) => new CustomException(e))` 统一包装异常

示例：
```typescript
// ✅ 简化的异常定义
export class SandboxFileListException extends SandboxException {
  constructor(messageOrError: unknown) {
    super(messageOrError, 'SANDBOX_FILE_LIST_FAILED');
  }
}

// ✅ 默认抛出异常
async listCwdFiles(): Promise<string[]> {
  return guard(() =>
    this.sandbox.files.list(this.cwd).then(files => files.map(file => file.name)),
  ).orThrow((error) => new SandboxFileListException(error));
}

// ✅ 调用者无需处理 - 异常自然传播
const previousFiles = await wrapper.listCwdFiles(); // 失败时抛出 SandboxFileListException

// ❌ 避免隐式降级 - 除非有明确的降级策略
const previousFiles = await guard(() => wrapper.listCwdFiles()).orElse(() => []);
```

### 6. 单挂载点模式
```typescript
// Wrapper 创建时挂载 drive (读写)
static async create(context: SandboxContext, timeoutMs: number) {
  // ...
  await wrapper.mountDrive(context); // 读写，用户上传文件 + 生成文件
}

// Service 使用 DriveService 构建 S3 路径（用于日志和文件注册）
const drivePath = this.driveService.buildS3DrivePath(uid, canvasId);

// executeCode 简化 - 直接在挂载点执行
async executeCode(code: string, language: Language, logger: PinoLogger) {
  // 直接执行代码，工作目录为挂载点
  return this.sandbox.runCode(code, { language, cwd: SANDBOX_DRIVE_MOUNT_POINT });
}
```

### 7. 一次性挂载策略
```typescript
// Wrapper 创建时一次性挂载 drive，之后不再变动
static async create(context: SandboxContext, timeoutMs: number) {
  // ...
  await wrapper.mountDrive(context);      // 读写，包含所有文件
  return wrapper;
}

// 挂载方法简化 - 只挂载一次，带重试机制
private async mountDrive(context: SandboxContext) {
  const mountCmd = buildS3MountCommand(s3Config, s3DrivePath, mountPoint);
  // ... 执行挂载，带重试机制
}
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
[待提交] feat(sandbox): simplify to single mount point architecture
  - 移除双挂载点设计：统一为单一挂载点架构
    - DriveService: 移除 buildS3WorkflowPath 方法
    - ScaleboxWrapper: 移除 mountWorkflow 方法，drive 改为读写模式
    - ScaleboxWrapper: SANDBOX_DRIVE_MOUNT_POINT 改为 `/mnt/refly`
    - ScaleboxService: 文件注册改用 buildS3DrivePath
    - ScaleboxPool: 移除 s3WorkflowPath 传递
    - Config: 移除 drive.workflowStorageKeyPrefix 配置
  - 统一存储路径：drive/{uid}/{canvasId}/ (包含用户上传文件 + 生成文件)
  - 工具描述更新：告知模型单一挂载点，避免删除/覆盖用户文件
  - 架构简化：减少 FUSE 挂载点，降低初始化开销和复杂度

[待提交] feat(sandbox): remove version isolation and simplify workflow architecture
  - 移除 version 参数：彻底移除 version 相关的逻辑
    - OpenAPI Schema: 移除 SandboxExecuteRequest.version 必填字段
    - DriveService: buildS3WorkflowPath 移除 version 参数
    - ScaleboxWrapper: 移除 currentWorkflowPath 缓存和动态 remount 逻辑
    - ScaleboxService/Processor: 移除 version 传递和验证
    - ScaleboxDTO: 移除 ScaleboxExecutionJobData.version 字段
    - Agent Tool: 移除 version 校验逻辑
  - 一次性挂载策略：Workflow 在沙盒创建时挂载一次，之后不再变动
    - 移除 unmountWorkflow 方法
    - 移除 nonempty 挂载选项和卸载稳定延迟逻辑
    - 简化 executeCode 方法签名，移除 workflowPath 参数
  - 路径结构简化：workflow/{uid}/{canvasId}/ (移除 version 层级)
  - 工具描述更新：告知模型 workflow 目录共享，建议使用时间戳避免覆盖
  - 文件版本管理：依赖 DriveService archive 机制在应用层管理版本

5ef546575 WIP: feat(sandbox): centralize path management and optimize mount/unmount reliability
  - 路径管理重构：集中所有 S3 路径构建逻辑到 DriveService
    - 新增 DriveService.buildS3DrivePath(uid, canvasId) 用于用户资源
    - 新增 DriveService.buildS3WorkflowPath(uid, canvasId, version) 用于工作流文件
    - 移除 scalebox.utils 中的分散路径构建函数
  - 命名标准化：统一使用 "drive" 和 "workflow" 术语
    - 挂载点: /mnt/refly/drive (只读) 和 /mnt/refly/workflow (读写)
    - 方法重命名: mountResources → mountDrive
    - 常量重命名: SANDBOX_RESOURCES_MOUNT_POINT → SANDBOX_DRIVE_MOUNT_POINT
  - 配置增强：新增 drive.workflowStorageKeyPrefix 配置项（默认 'sandbox'）
  - 挂载优化：使用 s3fs nonempty 标志避免 "device busy" 错误
  - 工具描述简化：移除 Python helper 函数注入，直接使用路径

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
6. **Drive 文件索引**: 提供文件列表接口让模型了解可用资源
7. **Workflow 清理策略**: 定期清理过期 version 的 workflow 目录

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

### 单挂载点架构
- **为什么移除双挂载点设计**:
  - **架构简化**: 单一挂载点减少复杂度，降低 FUSE 操作出错概率
  - **性能提升**: 减少一个挂载点，降低初始化开销
  - **成本可控**: 通过工具描述约束模型行为，避免误删用户文件
  - **统一存储**: 用户上传文件和生成文件统一管理，简化路径逻辑
- **为什么移除 version 隔离**:
  - **架构简化**: 移除动态 remount 逻辑，减少 FUSE 操作出错概率
  - **性能提升**: 一次挂载永久使用，避免频繁的卸载/挂载开销
  - **应用层版本管理**: DriveService 的 archive 机制已在应用层实现文件版本管理
  - **风险可控**: 文件覆盖风险通过 archive 机制和工具描述告知模型处理
- **为什么一次性挂载**:
  - 沙盒创建时挂载，复用期间保持不变
  - 同一 canvas 的所有执行共享工作空间，简化逻辑
  - 减少 FUSE 操作，提升稳定性
- **为什么路径管理集中到 DriveService**:
  - 单一数据源，确保路径构建逻辑一致性
  - 配置统一管理，便于环境切换
  - 降低路径错误概率，提升可维护性
- **为什么 DriveService archive 机制足够**:
  - 自动归档同名/同 resultId 的旧文件到 `{canvasId}-archive/` 带时间戳
  - Present 文件永远是最新版本，满足 90% 使用场景
  - 历史文件可查询和恢复，提供版本追溯能力
- **为什么读写挂载可以接受**:
  - 通过工具描述明确告知模型不要删除/覆盖用户上传文件
  - DriveService archive 机制提供自动备份保护
  - 简化架构带来的收益大于潜在风险

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

**核心 Sandbox 模块** (单挂载点架构 + 路径管理重构):
- `apps/api/src/modules/tool/sandbox/scalebox.wrapper.ts` - 实现单挂载点 + 移除 workflow 挂载逻辑
- `apps/api/src/modules/tool/sandbox/scalebox.service.ts` - 使用 DriveService 构建路径，移除 workflow path
- `apps/api/src/modules/tool/sandbox/scalebox.pool.ts` - 移除 s3WorkflowPath 传递
- `apps/api/src/modules/tool/sandbox/scalebox.processor.ts` - 移除 version 参数
- `apps/api/src/modules/tool/sandbox/scalebox.utils.ts` - 移除 buildS3Path 函数（迁移到 DriveService）
- `apps/api/src/modules/tool/sandbox/scalebox.constants.ts` - 更新 SANDBOX_DRIVE_MOUNT_POINT 为 `/mnt/refly`
- `apps/api/src/modules/tool/sandbox/scalebox.dto.ts` - 移除 ScaleboxExecutionJobData.version 字段
- `apps/api/src/modules/tool/sandbox/scalebox.exception.ts` - 异常定义更新
- `apps/api/src/modules/drive/drive.service.ts` - 移除 buildS3WorkflowPath 方法

**配置和模块集成**:
- `apps/api/src/modules/config/app.config.ts` - 移除 `drive.workflowStorageKeyPrefix` 配置
- `apps/api/src/modules/tool/tool.module.ts` - 集成 Sandbox 模块
- `packages/agent-tools/src/inventory.ts` - 注册 SandboxToolset
- `packages/agent-tools/src/index.ts` - 导出 Sandbox 工具
- `packages/agent-tools/src/builtin/interface.ts` - 类型定义更新
- `packages/agent-tools/src/base.ts` - 基础工具类更新

**API Schema**:
- `packages/openapi-schema/schema.yml` - SandboxExecuteRequest 移除 version，支持文件生成结果
- `packages/openapi-schema/src/schemas.gen.ts` - 自动生成的 Schema
- `packages/openapi-schema/src/types.gen.ts` - 自动生成的 TypeScript 类型

**Agent 工具层**:
- `packages/agent-tools/src/sandbox/index.ts` - 移除 version 校验，更新工具描述（单挂载点模式）

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
