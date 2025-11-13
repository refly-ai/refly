# Sandbox File System Access Fix

## 问题描述

在使用 sandbox 工具执行代码时，上传的文件无法被 Python 代码读取，报 `FileNotFoundError` 错误。

### 错误现象

```python
q1_2024_path = "/workspace/13f-berkshire-hathaway-q1-2024.csv"
q1_2024 = pd.read_csv(q1_2024_path)

# 报错
FileNotFoundError: [Errno 2] No such file or directory: '/workspace/13f-berkshire-hathaway-q1-2024.csv'
```

## 根本原因

问题的根本原因是：**`CodeInterpreter.create()` 会创建自己的独立 `Sandbox` 实例**，导致文件系统不一致。

### 原始实现的问题

```typescript
// In CodeBox.start()
// 1. 创建 Sandbox 用于文件操作
this.sandbox = await Sandbox.create('code-interpreter', { ... });

// 2. 创建 CodeInterpreter（内部会创建另一个 Sandbox！）
this.codeInterpreter = await CodeInterpreter.create({ ... });

// 3. 上传文件到 this.sandbox
await this.sandbox.files.write('/workspace/file.csv', buffer);

// 4. 执行代码在 this.codeInterpreter（使用的是不同的 Sandbox）
result = await this.codeInterpreter.execute({ code, contextId });

// ❌ 结果：文件在 Sandbox A，代码在 Sandbox B 执行，找不到文件！
```

### 架构图

**原始实现（错误）：**

```
┌─────────────────────────────────────────┐
│           CodeBox                       │
├─────────────────────────────────────────┤
│                                         │
│  this.sandbox (Sandbox A)               │
│  ├─ files.write('/workspace/file.csv')  │ ← 文件上传到这里
│  └─ File System A                       │
│                                         │
│  this.codeInterpreter                   │
│  └─ private sandbox (Sandbox B)         │
│     ├─ execute(code)                    │ ← 代码在这里执行
│     └─ File System B (空的！)           │
│                                         │
└─────────────────────────────────────────┘

文件在 File System A，代码在 File System B 执行 → FileNotFoundError
```

**正确实现：**

```
┌─────────────────────────────────────────┐
│           CodeBox                       │
├─────────────────────────────────────────┤
│                                         │
│  this.sandbox (Sandbox)                 │
│  ├─ files.write('/workspace/file.csv')  │ ← 文件上传
│  ├─ runCode(code)                       │ ← 代码执行（同一个 Sandbox）
│  └─ File System                         │ ← 同一个文件系统！
│     └─ /workspace/file.csv ✅           │
│                                         │
└─────────────────────────────────────────┘

文件和代码都在同一个 Sandbox → 可以正常访问
```

## 解决方案

### 核心修复

**移除 `CodeInterpreter` 的使用，直接使用 `Sandbox.runCode()`**

`Sandbox` 本身就支持：
1. ✅ 代码执行（`runCode()`）
2. ✅ 状态持久化（session-level，同一个 sandbox 中的多次 `runCode()` 调用共享状态）
3. ✅ 文件系统访问（`files.write()`, `files.read()`）

### 代码修改

**修改前（`packages/sandbox-agent/src/sandbox/codebox-adapter.ts`）：**

```typescript
async start(): Promise<CodeBoxStatus> {
  // 创建 Sandbox
  this.sandbox = await Sandbox.create('code-interpreter', { ... });
  
  // ❌ 创建独立的 CodeInterpreter
  this.codeInterpreter = await CodeInterpreter.create({ ... });
  this._defaultContext = await this.codeInterpreter.createCodeContext({ ... });
  
  return 'running';
}

async run(code: string, context?: CodeContext): Promise<CodeBoxOutput> {
  // ❌ 使用 CodeInterpreter 执行代码（不同的 Sandbox）
  if (this.codeInterpreter && executionContext) {
    result = await this.codeInterpreter.execute({
      code,
      contextId: executionContext.id,
    });
  }
}
```

**修改后：**

```typescript
async start(): Promise<CodeBoxStatus> {
  // 创建 Sandbox
  this.sandbox = await Sandbox.create('code-interpreter', { ... });
  
  // ✅ 不创建 CodeInterpreter，使用 Sandbox 的内置持久化
  console.log('[CodeBox] Using Sandbox built-in state persistence (session-level)');
  
  return 'running';
}

async run(code: string, _context?: CodeContext): Promise<CodeBoxOutput> {
  // ✅ 直接使用 Sandbox.runCode()
  // Sandbox 会自动维护 session-level 的状态持久化
  const result = await this.sandbox.runCode(code, {
    language: 'python',
  });
}
```

## 技术细节

### Scalebox SDK 架构理解

1. **`Sandbox`**
   - 容器环境，包含完整的文件系统和 Python 运行时
   - 支持文件操作：`files.write()`, `files.read()`, `files.makeDir()` 等
   - 支持代码执行：`runCode(code, options)`
   - **内置 session-level 状态持久化**：同一个 sandbox 实例中的多次 `runCode()` 调用会共享变量、函数、导入等状态

2. **`CodeInterpreter`**
   - 高级代码执行服务，提供显式的 **context 管理**
   - `CodeInterpreter.create()` 会**创建自己的 `Sandbox` 实例**
   - 支持多个独立的 context，每个 context 有独立的状态

3. **关键发现**
   - 如果使用 `CodeInterpreter.create()`，它会创建一个**新的** `Sandbox`
   - 这个新 `Sandbox` 与我们用于文件上传的 `Sandbox` **不是同一个实例**
   - 因此文件系统是**分离的**，导致无法访问上传的文件

### 为什么 Session-Level 持久化足够？

Scalebox SDK 的 `Sandbox.runCode()` 已经内置了 session-level 的状态持久化：

```python
# 第一次执行
await sandbox.runCode('x = 10; y = 20')

# 第二次执行 - x 和 y 仍然可用！
result = await sandbox.runCode('print(x + y)')  # 输出: 30
```

这对于大多数用例已经足够，包括：
- 变量持久化
- 函数定义持久化
- 类定义持久化
- 模块导入持久化
- **文件系统访问**（最重要！）

### Context Management vs Session-Level Persistence

| 特性 | CodeInterpreter Context | Sandbox Session |
|------|------------------------|-----------------|
| 状态持久化 | ✅ 支持 | ✅ 支持 |
| 多个独立上下文 | ✅ 支持 | ❌ 不支持 |
| 文件系统访问 | ❌ 独立文件系统 | ✅ 共享文件系统 |
| 实现复杂度 | 高（需要管理 context） | 低（自动管理） |
| 适用场景 | 需要隔离的并行任务 | 顺序执行的任务流 |

对于 Refly 的 sandbox 工具：
- ✅ **需要**：文件上传和代码执行共享文件系统
- ✅ **需要**：状态持久化（变量、函数等）
- ❌ **不需要**：多个独立的上下文并行执行

因此，**Session-Level Persistence 是更合适的选择**。

## 验证修复

### 测试场景

```typescript
const codebox = new CodeBox({ apiKey: process.env.SCALEBOX_API_KEY });
await codebox.start();

// 1. 上传文件
await codebox.upload('data.csv', Buffer.from('name,age\nAlice,30\nBob,25', 'utf-8'));

// 2. 读取文件并处理（应该成功）
const result = await codebox.run(`
import pandas as pd
df = pd.read_csv('/workspace/data.csv')
print(df.head())
`);

console.log(result.content);
// 应该输出:
//     name  age
// 0  Alice   30
// 1    Bob   25

// 3. 测试状态持久化
const result2 = await codebox.run(`
print(f"DataFrame shape: {df.shape}")
print(f"DataFrame still available: {type(df)}")
`);

console.log(result2.content);
// 应该输出:
// DataFrame shape: (2, 2)
// DataFrame still available: <class 'pandas.core.frame.DataFrame'>

await codebox.stop();
```

## 影响和优势

### 优势

1. ✅ **修复了文件访问问题**：文件和代码在同一个 Sandbox
2. ✅ **简化了架构**：移除了 `CodeInterpreter` 的复杂性
3. ✅ **保持了状态持久化**：Sandbox 的 session-level 持久化足够强大
4. ✅ **性能提升**：减少了一个 Sandbox 实例的创建和管理
5. ✅ **内存节省**：不需要维护两个 Sandbox 实例

### 权衡

- ❌ 失去了显式的 context 管理能力（多个独立上下文）
  - 对于 Refly 的用例，这不是问题，因为我们的任务是顺序执行的
  - 如果未来需要多个独立上下文，可以创建多个 `CodeBox` 实例

## 文档更新

需要更新以下文档：

1. ✅ `CONTEXT_PERSISTENCE.md` - 说明当前使用 session-level 持久化
2. ✅ `WORKSPACE_PATH_FIX.md` - 已过时，删除或更新
3. ✅ `SANDBOX_FILE_SYSTEM_FIX.md` - 本文档

## 未来改进

如果未来需要显式的 context 管理，可以考虑：

### 选项 1：使用 CodeInterpreter 的构造函数

```typescript
// 将现有 Sandbox 传递给 CodeInterpreter
this.codeInterpreter = new CodeInterpreter(
  this.sandbox,  // 使用同一个 Sandbox
  config,
  api
);
```

但这需要访问 `config` 和 `api` 对象，可能需要深入 SDK 的内部实现。

### 选项 2：创建多个 CodeBox 实例

如果需要多个独立的上下文：

```typescript
// 为每个独立任务创建一个 CodeBox
const codebox1 = new CodeBox();
await codebox1.start();

const codebox2 = new CodeBox();
await codebox2.start();

// 每个 CodeBox 有独立的 Sandbox 和文件系统
```

## 总结

通过移除 `CodeInterpreter` 并直接使用 `Sandbox.runCode()`，我们：

1. ✅ **解决了文件访问问题** - 文件和代码在同一个文件系统
2. ✅ **保持了状态持久化** - Sandbox 的 session-level 持久化工作良好
3. ✅ **简化了实现** - 减少了一层抽象和复杂性
4. ✅ **提升了性能和资源使用** - 只需要一个 Sandbox 实例

这是一个**根本性的架构修复**，解决了文件系统分离的核心问题。

