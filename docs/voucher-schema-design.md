# Voucher System Database Schema Design

## Overview
This document describes the database schema design for the template publishing reward and voucher sharing system.

## Schema Tables

### 1. Voucher Table (`vouchers`)

存储用户获得的优惠券/折扣码信息。

**核心字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `voucherId` | String (unique) | 优惠券唯一ID |
| `uid` | String | 拥有该优惠券的用户ID |
| `discountPercent` | Int | 折扣百分比 (10-90, 代表10%-90%折扣) |
| `status` | String | 状态：unused(未使用), used(已使用), expired(已过期), invalid(无效) |
| `source` | String | 来源：template_publish(模板发布), invitation_claim(邀请领取) |
| `sourceId` | String? | 来源实体ID (模板ID或邀请ID) |
| `llmScore` | Int? | LLM评分 (0-100) |
| `expiresAt` | DateTime | 过期时间 (创建时间 + 7天) |
| `usedAt` | DateTime? | 使用时间 |
| `subscriptionId` | String? | 使用时关联的订阅ID |

**索引设计：**
- `(uid, status, expiresAt)` - 查询用户有效优惠券
- `(status, expiresAt)` - 定时清理过期券

**业务逻辑：**
1. **折扣率计算**：LLM评分 ÷ 10 = 折扣百分比（如90分 = 90% off，即1折）
2. **有效期**：7天（从创建时间开始）
3. **多券共存**：一个用户可以同时拥有多个有效优惠券
4. **使用规则**：
   - 付费时由Stripe决定是否可用（不在前端区分会员/非会员）
   - 使用后标记 `status = 'used'` 和 `usedAt`
   - 过期后自动标记 `status = 'expired'`

---

### 2. VoucherInvitation Table (`voucher_invitations`)

存储优惠券分享/邀请关系。

**核心字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `invitationId` | String (unique) | 邀请记录ID |
| `inviterUid` | String | 邀请人用户ID |
| `inviteeUid` | String? | 被邀请人用户ID（未注册时为NULL） |
| `inviteCode` | String (unique) | 唯一邀请码（用于URL参数） |
| `voucherId` | String | 关联的优惠券ID |
| `discountPercent` | Int | 分享的优惠券折扣率 |
| `status` | String | 状态：unclaimed(未领取), claimed(已领取), expired(已过期) |
| `claimedAt` | DateTime? | 领取时间 |
| `rewardGranted` | Boolean | 邀请人奖励是否已发放（2000积分） |

**索引设计：**
- `(inviterUid, status)` - 查询邀请人的邀请记录
- `(inviteeUid)` - 查询被邀请人来源
- `(inviteCode)` - 快速验证邀请码
- `(status, claimedAt)` - 统计邀请转化率

**业务逻辑：**
1. **邀请码生成**：使用UUID或随机字符串，必须全局唯一且不可猜测
2. **一次性使用**：同一邀请链接只能被领取一次（通过 `status` 和 `claimedAt` 控制）
3. **奖励发放**：
   - 被邀请人注册成功后领取优惠券
   - 被邀请人购买会员后，邀请人获得 2000 credits（通过 `rewardGranted` 标记防止重复发放）
4. **防刷机制**：
   - 邀请码全局唯一
   - 已领取的邀请码再次访问时提示"优惠券已被领取"

---

### 3. VoucherPopupLog Table (`voucher_popup_logs`)

记录用户每日优惠券弹窗触发次数（用于实现"每天前3次发布触发"）。

**核心字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `uid` | String | 用户ID |
| `templateId` | String | 触发弹窗的模板ID |
| `popupDate` | String | 弹窗日期 (YYYY-MM-DD) |
| `voucherId` | String? | 该次弹窗生成的优惠券ID |

**索引设计：**
- `(uid, popupDate)` - 查询用户当天触发次数
- `(voucherId)` - 关联优惠券记录

**业务逻辑：**
1. **每日限额**：每个用户每天最多触发3次优惠券弹窗
2. **计数逻辑**：
   - 用户发布模板时，查询 `WHERE uid = ? AND popupDate = today` 的记录数
   - 如果 < 3，则显示弹窗并插入新记录
   - 如果 >= 3，则不显示弹窗
3. **跨天重置**：按日期字段自然分组，无需手动重置
4. **审计追踪**：记录每次触发的模板ID，便于后续分析

---

### 4. PromotionActivity Table (`promotion_activities`)

运营活动配置表（虽然你不做后台，但前端需要读取活动入口信息）。

**核心字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `activityId` | String (unique) | 活动ID |
| `activityName` | String | 活动名称（后台管理用） |
| `activityText` | String | 活动入口展示文案 |
| `imageUrl` | String | 活动图片URL（必填） |
| `landingPageUrl` | String | 默认落地页URL |
| `landingPageUrlZh` | String? | 中文落地页URL |
| `landingPageUrlEn` | String? | 英文落地页URL |
| `positions` | String[] | 展示位置数组：["dashboard", "marketplace"] |
| `status` | String | 状态：draft(草稿), published(已上架), unpublished(已下架) |

**索引设计：**
- `(status, deletedAt)` - 前端查询当前上架活动
- `(createdAt)` - 按创建时间排序

**业务逻辑：**
1. **多位置展示**：
   - 一个活动可以同时在多个位置展示
   - `positions` 数组存储所有展示位置，如 `["dashboard", "marketplace"]`
   - 前端查询时使用数组包含查询：`WHERE 'dashboard' = ANY(positions)`
2. **多语言支持**：
   - 若用户语言为中文且 `landingPageUrlZh` 存在，跳转中文URL
   - 若用户语言为英文且 `landingPageUrlEn` 存在，跳转英文URL
   - 否则跳转 `landingPageUrl`
3. **前端查询**：
   - Dashboard: `WHERE status = 'published' AND 'dashboard' = ANY(positions) AND deletedAt IS NULL`
   - Marketplace: `WHERE status = 'published' AND 'marketplace' = ANY(positions) AND deletedAt IS NULL`
4. **展示规则**：每个页面只展示当前上架的活动（按创建时间倒序）

---

## 数据流程

### 模板发布触发优惠券流程

```
1. 用户在 Publish 面板点击 "Publish"
   ↓
2. 检查当天触发次数
   SELECT COUNT(*) FROM voucher_popup_logs
   WHERE uid = ? AND popup_date = CURDATE()
   ↓
3. 如果 < 3次
   ↓
4. 调用 LLM 评分服务（0-100分）
   ↓
5. 计算折扣率：score / 10 (最低10%, 最高90%)
   ↓
6. 插入优惠券记录
   INSERT INTO vouchers (
     voucherId, uid, discountPercent, source,
     sourceId, llmScore, expiresAt, status
   ) VALUES (
     uuid(), user.uid, score/10, 'template_publish',
     template.id, score, NOW() + 7 DAYS, 'unused'
   )
   ↓
7. 插入弹窗日志
   INSERT INTO voucher_popup_logs (
     uid, templateId, popupDate, voucherId
   ) VALUES (
     user.uid, template.id, CURDATE(), voucher.id
   )
   ↓
8. 展示优惠券弹窗
```

### 分享优惠券流程

```
1. 用户点击 "Share" 按钮
   ↓
2. 生成邀请记录
   INSERT INTO voucher_invitations (
     invitationId, inviterUid, inviteCode,
     voucherId, discountPercent, status
   ) VALUES (
     uuid(), user.uid, randomCode(),
     voucher.id, voucher.discountPercent, 'unclaimed'
   )
   ↓
3. 生成分享链接：https://refly.ai?invite={inviteCode}
   ↓
4. 展示海报页面（含二维码、文案、下载/复制功能）
```

### 邀请领取流程

```
1. 被邀请人访问 https://refly.ai?invite={code}
   ↓
2. 查询邀请记录
   SELECT * FROM voucher_invitations
   WHERE inviteCode = ? AND status = 'unclaimed'
   ↓
3. 如果已被领取：提示"优惠券已被领取"
   ↓
4. 如果未注册：跳转注册页
   ↓
5. 注册/登录成功后
   ↓
6. 显示优惠券领取弹窗
   ↓
7. 点击领取：
   - 创建新优惠券给被邀请人
   - 更新邀请记录：status = 'claimed', inviteeUid = user.uid
   ↓
8. 被邀请人购买会员后：
   - 给邀请人发放 2000 credits
   - 标记 rewardGranted = true
```

### 购买时使用优惠券流程

```
1. 用户触发购买（任意入口）
   ↓
2. 查询有效优惠券
   SELECT * FROM vouchers
   WHERE uid = ? AND status = 'unused' AND expiresAt > NOW()
   ORDER BY discountPercent DESC
   LIMIT 1
   ↓
3. 如果有券，计算折扣价
   discountedPrice = originalPrice * (1 - discountPercent / 100)
   ↓
4. 在购买弹窗和 Stripe 页面展示折扣后价格
   ↓
5. 调用 Stripe Checkout 时传入折扣信息
   ↓
6. Stripe 验证是否可用（会员套餐限制等）
   ↓
7. 支付成功后：
   UPDATE vouchers
   SET status = 'used', usedAt = NOW(), subscriptionId = ?
   WHERE voucherId = ?
   ↓
8. 触发埋点：voucher_applied
```

---

## 索引优化建议

1. **vouchers 表**：
   - 最常查询：用户有效优惠券 → `(uid, status, expiresAt)`
   - 定时清理：过期券 → `(status, expiresAt)`

2. **voucher_invitations 表**：
   - 邀请链接验证：`(inviteCode)` (unique)
   - 用户邀请列表：`(inviterUid, status)`
   - 被邀请人溯源：`(inviteeUid)`

3. **voucher_popup_logs 表**：
   - 每日计数：`(uid, popupDate)` (复合索引)
   - 优惠券关联：`(voucherId)`

4. **promotion_activities 表**：
   - 前端查询：`(status, position, deletedAt)` (复合索引)
   - 排序：`(createdAt)`

---

## 数据一致性保证

1. **邀请码唯一性**：
   - `inviteCode` 字段设置 `@unique` 约束
   - 使用 UUID 或加密随机字符串生成

2. **防止重复发放奖励**：
   - `rewardGranted` 布尔标记
   - 在发放积分前检查该字段，发放后立即标记

3. **过期处理**：
   - 定时任务扫描 `vouchers.expiresAt < NOW() AND status = 'unused'`
   - 批量更新 `status = 'expired'`

4. **防止同一邀请码多次领取**：
   - 领取时更新 `status = 'claimed'`
   - 查询时加条件 `status = 'unclaimed'`
   - 使用数据库事务确保原子性

---

## 埋点字段映射

根据需求稿中的埋点需求，以下是字段与埋点的对应关系：

| 埋点事件 | 关键字段 | 来源表 |
|----------|----------|--------|
| `voucher_popup_display` | `voucherId`, `discountPercent` | `vouchers` |
| `voucher_use_now_click` | `voucherId`, `discountPercent` | `vouchers` |
| `voucher_share_click` | `voucherId`, `discountPercent` | `vouchers` |
| `poster_download` | `voucherId`, `discountPercent` | `vouchers` |
| `share_link_copied` | `inviteCode`, `discountPercent` | `voucher_invitations` |
| `voucher_claim` | `invitationId`, `inviteeUid` | `voucher_invitations` |
| `voucher_applied` | `voucherId`, `subscriptionId`, `discountPercent` | `vouchers` |

---

## 后续优化方向

1. **性能优化**：
   - `popupDate` 可以考虑改为 `Date` 类型并加索引（如果查询量大）
   - 定期归档/删除过期的 `voucher_popup_logs`（如保留30天）

2. **功能扩展**：
   - 支持优惠券叠加使用（需增加 `usageLimit` 和 `usageCount` 字段）
   - 支持不同类型的优惠券（固定金额、折扣率、免费试用等）

3. **安全加固**：
   - `inviteCode` 加密存储或使用签名机制
   - 限制同一IP/设备的注册频率（防刷）

---

## 总结

这套 schema 设计满足以下核心需求：

✅ 支持一个用户持有多个优惠券
✅ 折扣券形式（按百分比计算，不展示有效期倒计时）
✅ 每天前3次发布触发（通过 `VoucherPopupLog` 实现）
✅ 分享邀请机制（通过 `VoucherInvitation` 实现）
✅ 邀请奖励发放（2000 credits）
✅ 多语言活动入口跳转（通过 `PromotionActivity` 实现）
✅ 完整的埋点数据支持
✅ 数据一致性和安全性保障

所有表设计遵循项目现有规范：
- 使用 `BigInt` 主键
- 使用 `@map` 指定数据库列名
- 添加详细的注释
- 合理的索引设计
- Timestamptz 时间类型
- 软删除支持（`PromotionActivity`）
