# 数据同步脚本使用说明

从测试环境同步加密数据到本地开发环境。

## 快速开始

```bash
# 从项目根目录运行
cd /path/to/refly

TEST_ENV_DATABASE_URL="postgresql://user:pass@test-host:5432/refly" \
TEST_ENV_ENCRYPTION_KEY="64位十六进制密钥..." \
pnpm --filter @refly/api exec ts-node -r tsconfig-paths/register src/scripts/sync-data-from-test.ts
```

## 环境变量

| 变量                      | 必需 | 说明                                                 |
| ------------------------- | ---- | ---------------------------------------------------- |
| `TEST_ENV_DATABASE_URL`   | 是   | 测试环境的 PostgreSQL 连接 URL                       |
| `TEST_ENV_ENCRYPTION_KEY` | 推荐 | 测试环境的加密密钥（64 个十六进制字符）              |
| `DATABASE_URL`            | 是   | 本地数据库 URL（从 .env 读取）                       |
| `ENCRYPTION_KEY`          | 可选 | 本地加密密钥（从 .env 读取，未设置时使用开发默认值） |

## 工作原理

脚本实现"先解密后重加密"策略：

1. 连接到测试环境和本地数据库（双 Prisma 客户端）
2. 使用测试环境密钥解密数据
3. 使用本地密钥重新加密
4. 通过 upsert 写入本地数据库（已存在则更新，不存在则创建）

## 配置同步范围

编辑脚本中的 `SYNC_CONFIGS` 数组：

```typescript
const SYNC_CONFIGS: SyncConfig[] = [
  {
    table: "toolset", // Prisma 模型名
    where: { key: "perplexity" }, // 查询条件
    encryptedFields: ["authData"], // 需要重加密的字段
    idField: "key", // 唯一标识字段（用于 upsert）
  },
  // 可添加更多配置...
];
```

### idField 说明

`idField` 用于判断记录是否已存在（upsert 操作）：

- **必须是有 `@unique` 约束的字段**
- **不能使用自增主键 `pk`**（不同环境值不同）
- **应该使用业务唯一标识**（如 `key`, `providerId`, `uid` 等）

示例：

```typescript
// ✅ 正确
idField: "key"; // toolsets 表，key 字段有 @unique
idField: "providerId"; // providers 表，providerId 有 @unique
idField: "uid"; // users 表，uid 有 @unique

// ❌ 错误
idField: "pk"; // 自增主键，不同环境值不同
idField: "name"; // 可能重复，没有 @unique
```

## 常见问题

### ❌ 错误：`ts-node: command not found`

**原因**：项目使用 pnpm workspace，不能用 `npx`

**解决**：使用 `pnpm exec` 或 `pnpm --filter @refly/api exec`

### ❌ 错误：解密失败

**原因**：`TEST_ENV_ENCRYPTION_KEY` 不正确

**解决**：

- 确认密钥是 64 个十六进制字符（0-9, a-f）
- 从测试环境获取正确的 `ENCRYPTION_KEY` 值

```bash
# 验证密钥长度
echo -n "your-key" | wc -c  # 应该输出 64
```

### ❌ 错误：数据库连接失败

**解决**：

1. 检查 URL 格式：`postgresql://username:password@hostname:port/database`
2. 测试网络连接：`nc -zv test-db-host 5432`
3. 使用 psql 测试：`psql "$TEST_ENV_DATABASE_URL" -c "SELECT 1"`
4. 检查是否需要 VPN 或 SSH 隧道

### ❌ 错误：Unique constraint failed

**原因**：`idField` 配置不正确

**解决**：确保 `idField` 指向的字段在 Prisma schema 中有 `@unique` 约束

## 验证同步结果

```sql
-- 查看同步的数据
SELECT * FROM toolsets WHERE key = 'perplexity';

-- 检查字段
SELECT key, auth_type, enabled, created_at FROM toolsets WHERE key = 'perplexity';
```

## 安全注意事项

- ⚠️ **不要将加密密钥提交到 Git**
- ⚠️ **运行前建议备份本地数据库**：`pg_dump $DATABASE_URL > backup.sql`
- ✅ 脚本可以安全地多次运行（幂等性）
- ✅ 解密数据仅在内存中临时存储
