# 数据同步脚本使用说明

从测试环境生成加密数据的 SQL 文件，供本地开发环境手动执行。

## 快速开始

```bash
# 从项目根目录运行
cd /path/to/refly

SOURCE_DATABASE_URL="postgresql://user:pass@test-host:5432/refly" \
SOURCE_ENCRYPTION_KEY="64位十六进制密钥..." \
ENCRYPTION_KEY="本地环境的64位十六进制密钥..." \
pnpm --filter @refly/api exec ts-node -r tsconfig-paths/register src/scripts/sync-data-from-test.ts
```

## 环境变量

| 变量                      | 必需 | 说明                                                |
| ------------------------- | ---- | --------------------------------------------------- |
| `SOURCE_DATABASE_URL`   | 是   | 测试环境的 PostgreSQL 连接 URL（只读访问）          |
| `SOURCE_ENCRYPTION_KEY` | 推荐 | 测试环境的加密密钥（64 个十六进制字符）             |
| `ENCRYPTION_KEY`          | 推荐 | 目标环境的加密密钥（64 个十六进制字符，用于重加密） |

注意：不再需要 `DATABASE_URL`，脚本只会读取源数据库并生成 SQL 文件。

## 工作原理

脚本实现"先解密后重加密"策略并生成 SQL：

1. 连接到测试环境数据库（只读）
2. 使用测试环境密钥解密数据
3. 使用目标环境密钥重新加密
4. 生成 INSERT SQL 语句
5. 输出到 `apps/api/scripts/output/sync-data-{timestamp}.sql`

## 配置同步范围

编辑脚本中的 `SYNC_CONFIGS` 数组：

```typescript
const SYNC_CONFIGS: SyncConfig[] = [
  {
    table: "toolsets", // 数据库表名（复数形式）
    where: { key: "perplexity" }, // 查询条件
    encryptedFields: ["authData"], // 需要重加密的字段
  },
  // 可添加更多配置...
];
```

### 字段说明

- `table`: 数据库表名（如 `toolsets`, `providers`, `users` 等）
  - 脚本会自动将表名映射到对应的 Prisma 模型名进行查询
  - 生成的 SQL 使用实际的数据库表名
- `where`: 查询条件，用于过滤要同步的记录
- `encryptedFields`: 需要解密和重加密的字段列表

## 执行生成的 SQL

脚本会在 `apps/api/scripts/output/` 目录生成 SQL 文件。

### 手动执行 SQL

```bash
# 1. 审查生成的 SQL 文件
cat apps/api/scripts/output/sync-data-2026-01-14T10-00-00.sql

# 2. 备份本地数据库（推荐）
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# 3. 执行 SQL
psql $DATABASE_URL < apps/api/scripts/output/sync-data-2026-01-14T10-00-00.sql
```

### 验证结果

```sql
-- 查看同步的数据
SELECT * FROM refly.toolset WHERE key = 'perplexity';

-- 检查字段
SELECT key, auth_type, enabled, created_at FROM refly.toolset WHERE key = 'perplexity';
```

## 常见问题

### ❌ 错误：`ts-node: command not found`

**原因**：项目使用 pnpm workspace，不能用 `npx`

**解决**：使用 `pnpm exec` 或 `pnpm --filter @refly/api exec`

### ❌ 错误：解密失败

**原因**：`SOURCE_ENCRYPTION_KEY` 不正确

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
3. 使用 psql 测试：`psql "$SOURCE_DATABASE_URL" -c "SELECT 1"`
4. 检查是否需要 VPN 或 SSH 隧道

### ❌ 错误：执行 SQL 时出现 duplicate key error

**原因**：目标数据库中已存在相同的记录

**解决**：

1. 手动删除冲突的记录后再执行 SQL
2. 或修改生成的 SQL，将 `INSERT` 改为 `INSERT ... ON CONFLICT DO UPDATE`

## 安全注意事项

- ⚠️ **不要将加密密钥提交到 Git**
- ⚠️ **不要将生成的 SQL 文件提交到 Git**（包含敏感数据）
- ⚠️ **运行前必须备份目标数据库**：`pg_dump $DATABASE_URL > backup.sql`
- ⚠️ **执行 SQL 前必须审查文件内容**
- ✅ 脚本只读取源数据库，不会修改任何数据
- ✅ 解密数据仅在内存中临时存储
- ✅ 生成的 SQL 文件可以多次执行（但可能因主键冲突而失败）

## 输出文件管理

生成的 SQL 文件默认保存在：

```
apps/api/scripts/output/sync-data-{timestamp}.sql
```

建议：

- 定期清理旧的 SQL 文件
- 将 `apps/api/scripts/output/` 添加到 `.gitignore`
- 执行完成后可删除 SQL 文件
