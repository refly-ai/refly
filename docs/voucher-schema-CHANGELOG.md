# Voucher System Schema - Changelog

## 2025-12-05 - v1.1

### 🔧 修改内容

#### 1. PromotionActivity 表字段调整

**变更1: imageUrl 改为必填**
- **原设计**: `imageUrl String? @map("image_url")` (可为 NULL)
- **新设计**: `imageUrl String @map("image_url")` (必填)
- **原因**: 根据后台功能需求，活动图片为必填字段

**变更2: position 改为 positions 数组**
- **原设计**: `position String @map("position")` (单个值)
- **新设计**: `positions String[] @default([]) @map("positions")` (数组)
- **原因**: 支持一个活动同时在多个位置展示

**变更3: 索引调整**
- **移除**: `@@index([status, position, deletedAt])`
- **新增**: `@@index([status, deletedAt])`
- **原因**: positions 改为数组后，索引策略调整

### 📊 数据库迁移影响

#### SQL 变更
```sql
-- 旧字段
position VARCHAR(50) NOT NULL,
image_url TEXT,

-- 新字段
positions TEXT[] NOT NULL DEFAULT '{}',
image_url TEXT NOT NULL,
```

#### 索引变更
```sql
-- 移除旧索引
DROP INDEX IF EXISTS idx_promotion_activities_status;

-- 创建新索引
CREATE INDEX idx_promotion_activities_status ON refly.promotion_activities(status, deleted_at);
```

### 🔍 业务逻辑变更

#### 原逻辑（单位置）
```typescript
// 查询 Dashboard 活动
const activities = await prisma.promotionActivity.findMany({
  where: {
    status: 'published',
    position: 'dashboard',
    deletedAt: null
  }
});
```

#### 新逻辑（多位置）
```typescript
// 查询 Dashboard 活动
const activities = await prisma.promotionActivity.findMany({
  where: {
    status: 'published',
    positions: { has: 'dashboard' },  // 数组包含查询
    deletedAt: null
  }
});

// 或使用原始 SQL
const activities = await prisma.$queryRaw`
  SELECT * FROM promotion_activities
  WHERE status = 'published'
    AND 'dashboard' = ANY(positions)
    AND deleted_at IS NULL
`;
```

### 📝 后台 CRUD 接口影响

#### 创建活动
```typescript
// 旧接口
{
  activityName: "Creator Contest",
  activityText: "Join the Creator Contest",
  imageUrl: "https://...",  // 可选
  landingPageUrl: "https://...",
  position: "dashboard",     // 单个值
  status: "draft"
}

// 新接口
{
  activityName: "Creator Contest",
  activityText: "Join the Creator Contest",
  imageUrl: "https://...",           // 必填
  landingPageUrl: "https://...",
  positions: ["dashboard", "marketplace"],  // 数组
  status: "draft"
}
```

#### 查询活动列表
```typescript
// 后台列表展示（无变化）
const activities = await prisma.promotionActivity.findMany({
  where: { deletedAt: null },
  orderBy: { createdAt: 'desc' },
  select: {
    activityId: true,
    activityName: true,
    landingPageUrl: true,
    positions: true,     // 返回数组
    status: true,
    createdAt: true
  }
});
```

### ✅ 迁移步骤（如果已有旧数据）

如果数据库中已有 `promotion_activities` 表的旧数据：

```sql
-- Step 1: 添加新列 positions（临时允许 NULL）
ALTER TABLE refly.promotion_activities
ADD COLUMN positions TEXT[];

-- Step 2: 将旧 position 数据迁移到 positions 数组
UPDATE refly.promotion_activities
SET positions = ARRAY[position]
WHERE positions IS NULL;

-- Step 3: 设置默认值并添加 NOT NULL 约束
ALTER TABLE refly.promotion_activities
ALTER COLUMN positions SET DEFAULT '{}',
ALTER COLUMN positions SET NOT NULL;

-- Step 4: 删除旧列
ALTER TABLE refly.promotion_activities
DROP COLUMN position;

-- Step 5: 修改 image_url 为必填（注意：如果已有 NULL 数据，需先清理）
-- 先检查是否有 NULL 值
SELECT COUNT(*) FROM refly.promotion_activities WHERE image_url IS NULL;

-- 如果有 NULL，先更新或删除这些记录
-- UPDATE refly.promotion_activities SET image_url = 'default.png' WHERE image_url IS NULL;

-- 然后添加 NOT NULL 约束
ALTER TABLE refly.promotion_activities
ALTER COLUMN image_url SET NOT NULL;

-- Step 6: 更新索引
DROP INDEX IF EXISTS refly.idx_promotion_activities_status;
CREATE INDEX idx_promotion_activities_status ON refly.promotion_activities(status, deleted_at);
```

### 🧪 测试检查清单

- [ ] 创建活动时 positions 必须提供数组
- [ ] 创建活动时 imageUrl 必须提供
- [ ] 一个活动可以同时在 Dashboard 和 Marketplace 展示
- [ ] Dashboard 页面只显示 positions 包含 'dashboard' 的活动
- [ ] Marketplace 页面只显示 positions 包含 'marketplace' 的活动
- [ ] 上架期间不可修改/删除（后端业务逻辑验证）
- [ ] 活动列表按创建时间倒序排列
- [ ] 软删除功能正常

### 📚 相关文档更新

- ✅ `voucher-schema-design.md` - 已更新表结构说明和查询逻辑
- ✅ `voucher-schema-migration.sql` - 已更新建表语句
- ✅ `schema.prisma` (API & Admin) - 已同步更新

### 🚀 后续操作建议

1. **后端开发**：
   - 更新活动 CRUD 接口，适配 positions 数组字段
   - 添加 imageUrl 必填校验
   - 实现上架期间不可修改/删除的业务逻辑

2. **前端开发**：
   - 管理后台：位置选择改为多选框（Checkbox）
   - Dashboard/Marketplace：查询条件改为数组包含判断

3. **数据迁移**（如果已有数据）：
   - 执行上述迁移 SQL
   - 验证数据完整性

---

**版本**: v1.1
**修改日期**: 2025-12-05
**修改人**: AI Assistant
**审核状态**: 待审核
