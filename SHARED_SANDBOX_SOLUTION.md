# Shared Sandbox Solution - CodeInterpreter with File Access

## 问题回顾

使用 `CodeInterpreter.create()` 会创建独立的 `Sandbox` 实例，导致：
- 文件上传到 `Sandbox A`
- 代码执行在 `Sandbox B`（CodeInterpreter 内部的 sandbox）
- 结果：`FileNotFoundError`

## 解决方案

**使用 `CodeInterpreter` 构造函数，传入现有的 `Sandbox` 实例**

通过访问 `Sandbox` 的内部属性（`connectionConfig` 和 `api`），我们可以创建一个 `CodeInterpreter`，它使用**同一个 `Sandbox` 实例**。

### 核心实现

```typescript
// 1. 创建 Sandbox
this.sandbox = await Sandbox.create('code-interpreter', { ... });

// 2. 访问 Sandbox 的内部属性
const sandboxInternal = this.sandbox as any;
const connectionConfig = sandboxInternal.connectionConfig;
const api = sandboxInternal.api;

// 3. 使用构造函数创建 CodeInterpreter，传入同一个 Sandbox
this.codeInterpreter = new CodeInterpreter(
  this.sandbox,        // 使用同一个 Sandbox 实例！
  connectionConfig,    // 从 Sandbox 获取配置
  api                  // 从 Sandbox 获取 API 客户端
);

// 4. 创建执行上下文
this._defaultContext = await this.codeInterpreter.createCodeContext({
  language: 'python',
  cwd: '/workspace',
});
```

### 架构图

```
┌─────────────────────────────────────────────────────┐
│                    CodeBox                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  this.sandbox (Sandbox)                             │
│  ├─ files.write('/workspace/file.csv')  ← 文件上传  │
│  ├─ connectionConfig                                │
│  ├─ api                                             │
│  └─ File System                                     │
│     └─ /workspace/file.csv ✅                        │
│                                                     │
│  this.codeInterpreter (CodeInterpreter)             │
│  ├─ constructor(this.sandbox, config, api)  ← 共享  │
│  ├─ execute(code, contextId)             ← 代码执行 │
│  └─ Uses SAME Sandbox and File System! ✅           │
│                                                     │
└─────────────────────────────────────────────────────┘

文件和代码都在同一个 Sandbox 的文件系统 → 可以正常访问！
```

## 代码实现

### `packages/sandbox-agent/src/sandbox/codebox-adapter.ts`

```typescript
async start(): Promise<CodeBoxStatus> {
  // 1. 创建 Sandbox
  this.sandbox = await Sandbox.create('code-interpreter', {
    timeoutMs: this.options.timeoutMs || 1800000,
    metadata: this.options.metadata || {},
    apiKey: this.options.apiKey || process.env.SCALEBOX_API_KEY || '',
  });

  const info = await this.sandbox.getInfo();
  this._sessionId = info.sandboxId;

  // 2. 创建 CodeInterpreter，使用同一个 Sandbox
  try {
    const sandboxInternal = this.sandbox as any;
    const connectionConfig = sandboxInternal.connectionConfig;
    const api = sandboxInternal.api;

    if (connectionConfig && api) {
      // 使用构造函数，传入现有的 Sandbox
      this.codeInterpreter = new CodeInterpreter(
        this.sandbox,
        connectionConfig,
        api
      );
      console.log('[CodeBox] CodeInterpreter created with shared Sandbox instance');

      // 创建默认上下文
      this._defaultContext = await this.codeInterpreter.createCodeContext({
        language: 'python',
        cwd: '/workspace',
      });
      console.log('[CodeBox] Default context created:', this._defaultContext.id);
    }
  } catch (error) {
    console.warn('[CodeBox] Failed to create CodeInterpreter:', error);
    console.log('[CodeBox] Falling back to Sandbox session-level persistence');
  }

  return 'running';
}

async run(code: string, context?: CodeContext): Promise<CodeBoxOutput> {
  const executionContext = context || this._defaultContext;

  let result: ExecutionResult;

  // 使用 CodeInterpreter 执行代码（带上下文持久化）
  if (this.codeInterpreter && executionContext) {
    result = await this.codeInterpreter.execute({
      language: 'python',
      code,
      contextId: executionContext.id,
    });
  } else {
    // 降级到 Sandbox.runCode（session-level 持久化）
    result = await this.sandbox.runCode(code, {
      language: 'python',
    });
  }

  // 处理结果...
  return { type: 'text', content: result.stdout || '' };
}
```

## 技术细节

### 为什么这样有效？

1. **`CodeInterpreter` 构造函数签名**：
   ```typescript
   constructor(sandbox: Sandbox, config: ConnectionConfig, api: ApiClient)
   ```
   
2. **`Sandbox` 内部属性**：
   ```typescript
   protected readonly connectionConfig: ConnectionConfig;
   protected readonly api: ApiClient;
   ```

3. **通过 TypeScript 类型断言访问**：
   ```typescript
   const sandboxInternal = this.sandbox as any;
   const connectionConfig = sandboxInternal.connectionConfig;
   const api = sandboxInternal.api;
   ```

4. **创建共享 `CodeInterpreter`**：
   - `CodeInterpreter` 使用传入的 `Sandbox` 实例
   - 不会创建新的 `Sandbox`
   - 所有操作都在同一个文件系统中

### 优势

| 特性 | CodeInterpreter.create() | new CodeInterpreter(sandbox) |
|------|-------------------------|------------------------------|
| 文件系统 | ❌ 独立的（新 Sandbox） | ✅ 共享的（同一个 Sandbox） |
| 上下文管理 | ✅ 支持 | ✅ 支持 |
| 状态持久化 | ✅ Context-level | ✅ Context-level |
| 文件访问 | ❌ 无法访问上传的文件 | ✅ 可以访问上传的文件 |
| 资源使用 | ❌ 两个 Sandbox 实例 | ✅ 一个 Sandbox 实例 |

### 降级策略

如果 `CodeInterpreter` 创建失败（例如，无法访问内部属性），代码会自动降级到 `Sandbox.runCode()`，使用 session-level 的状态持久化：

```typescript
try {
  // 尝试创建 CodeInterpreter
  this.codeInterpreter = new CodeInterpreter(this.sandbox, config, api);
} catch (error) {
  // 降级到 Sandbox.runCode()
  console.warn('[CodeBox] Falling back to Sandbox session-level persistence');
}

// 在 run() 方法中
if (this.codeInterpreter && executionContext) {
  // 使用 CodeInterpreter（context-level 持久化）
  result = await this.codeInterpreter.execute({ code, contextId });
} else {
  // 降级到 Sandbox（session-level 持久化）
  result = await this.sandbox.runCode(code, { language: 'python' });
}
```

## 验证

### 测试场景

```typescript
const codebox = new CodeBox({ apiKey: process.env.SCALEBOX_API_KEY });
await codebox.start();

// 1. 上传文件到 Sandbox
await codebox.upload('data.csv', Buffer.from('name,age\nAlice,30\nBob,25', 'utf-8'));

// 2. 使用 CodeInterpreter 执行代码（带上下文持久化）
const result1 = await codebox.run(`
import pandas as pd
df = pd.read_csv('/workspace/data.csv')
print(df.head())
`);

console.log(result1.content);
// 应该成功输出:
//     name  age
// 0  Alice   30
// 1    Bob   25

// 3. 验证上下文持久化（变量 df 应该仍然存在）
const result2 = await codebox.run(`
print(f"DataFrame shape: {df.shape}")
print(f"DataFrame columns: {df.columns.tolist()}")
`);

console.log(result2.content);
// 应该成功输出:
// DataFrame shape: (2, 2)
// DataFrame columns: ['name', 'age']

await codebox.stop();
```

### 预期结果

✅ **文件访问成功** - 代码可以读取上传的文件  
✅ **上下文持久化** - 变量在多次执行间保持  
✅ **函数和类定义持久化** - 定义的函数和类可以在后续执行中使用  
✅ **导入持久化** - 已导入的模块在后续执行中仍然可用

## 与其他方案的对比

### 方案 1：使用 CodeInterpreter.create()（原始问题）

```typescript
this.sandbox = await Sandbox.create('code-interpreter');
this.codeInterpreter = await CodeInterpreter.create();  // ❌ 创建新的 Sandbox
```

❌ **问题**：两个独立的 Sandbox，文件系统分离

### 方案 2：只使用 Sandbox.runCode()（之前的临时方案）

```typescript
this.sandbox = await Sandbox.create('code-interpreter');
result = await this.sandbox.runCode(code, { language: 'python' });  // ✅ 文件访问
```

✅ **优点**：文件系统统一  
❌ **缺点**：失去显式的上下文管理能力（多个独立上下文）

### 方案 3：使用 CodeInterpreter 构造函数（当前方案）✅

```typescript
this.sandbox = await Sandbox.create('code-interpreter');
this.codeInterpreter = new CodeInterpreter(this.sandbox, config, api);  // ✅ 共享 Sandbox
```

✅ **优点**：
- 文件系统统一
- 保留显式的上下文管理
- Context-level 状态持久化
- 支持多个独立上下文

## 注意事项

### TypeScript 类型断言

由于 `connectionConfig` 和 `api` 是 `protected` 属性，我们使用类型断言来访问它们：

```typescript
const sandboxInternal = this.sandbox as any;
```

这是**安全的**，因为：
1. 我们只是读取属性，不修改它们
2. 这些属性在 `Sandbox` 初始化后就存在
3. 如果属性不存在，会通过 `if` 检查处理
4. 有降级策略：如果失败，使用 `Sandbox.runCode()`

### SDK 版本兼容性

这个方案依赖于 `Sandbox` 的内部结构。如果未来 SDK 版本改变了内部结构，可能需要调整。不过：

1. 有健壮的错误处理
2. 有降级策略
3. 不会导致程序崩溃，只会降级到 session-level 持久化

## 总结

通过使用 `CodeInterpreter` 构造函数并传入现有的 `Sandbox` 实例，我们实现了：

1. ✅ **解决文件访问问题** - 文件和代码在同一个文件系统
2. ✅ **保留上下文管理** - 支持显式的 context 管理
3. ✅ **Context-level 持久化** - 比 session-level 更灵活
4. ✅ **支持多个上下文** - 可以创建多个独立的上下文
5. ✅ **降级策略** - 如果 CodeInterpreter 不可用，自动降级
6. ✅ **资源优化** - 只使用一个 Sandbox 实例

这是一个**完整且健壮的解决方案**，同时保留了 `CodeInterpreter` 的所有优势，并解决了文件系统分离的问题。

