# 优惠券系统数据库 Schema - 已完成 ✅

## 本次提交内容

### 1. Prisma Schema 定义
**文件**: `/apps/api/prisma/schema.prisma` (行 2000-2120)

新增4张数据表:
- ✅ `Voucher` - 优惠券表
- ✅ `VoucherInvitation` - 邀请记录表
- ✅ `VoucherPopupLog` - 弹窗触发日志表
- ✅ `PromotionActivity` - 运营活动配置表

**验证状态**: ✅ Prisma schema 验证通过

### 2. 设计文档
**文件**: `/docs/voucher-schema-design.md`

包含:
- 完整的表结构说明和字段含义
- 业务逻辑详解 (折扣率计算、每日限额、邀请机制等)
- 数据流程图 (发布触发、分享邀请、领取购买)
- 索引优化建议
- 埋点字段映射
- 数据一致性保证策略

### 3. SQL 迁移脚本
**文件**: `/docs/voucher-schema-migration.sql`

可直接执行的 PostgreSQL 脚本:
- 建表语句 (包含所有字段和默认值)
- 索引创建语句
- 表和列注释
- 验证查询语句

### 4. 任务拆解文档
**文件**: `/docs/voucher-task-breakdown.md`

包含:
- 7个功能模块的详细拆解 (后端/前端任务清单)
- 依赖关系和并行开发建议
- 预估工期和排期建议
- 测试清单
- 风险点和注意事项
- 后续优化方向

---

## 快速开始

### 后端同学
1. 执行数据库迁移:
   ```bash
   cd apps/api
   psql -U your_user -d refly < ../../docs/voucher-schema-migration.sql
   ```

2. 生成 Prisma Client:
   ```bash
   npx prisma generate
   ```

3. 验证表创建成功:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'refly'
   AND table_name LIKE 'voucher%' OR table_name = 'promotion_activities';
   ```

4. 开始开发 **模块0: 后端基础设施** (见任务拆解文档)

### 前端同学
1. 阅读设计文档了解业务逻辑
2. 准备 **模块1: 优惠券弹窗组件** 的 UI 设计稿
3. 等待后端基础接口完成后开始联调

---

## 关键设计决策 (已体现在 Schema 中)

### ✅ 折扣券实现 (非固定金额)
- 字段: `discountPercent` (10-90, 代表折扣百分比)
- LLM 评分 0-100 → 折扣率 0%-90%
- 例: 90分 = 90% off = 1折

### ✅ 每日触发限制 (非首次)
- 通过 `VoucherPopupLog` 表按日期统计
- 每用户每天最多3次

### ✅ 不区分会员/非会员
- 所有用户统一领取流程
- 由 Stripe 决定是否可用
- 简化前端逻辑

### ✅ 多个优惠券共存
- 无唯一性约束
- 支持用户同时持有多张券

### ✅ 多语言活动入口
- `PromotionActivity` 表支持3个URL字段
- 根据用户语言选择跳转

---

## 数据表关系

```
User (现有表)
  ↓ 1:N
Voucher ← 1:N → VoucherInvitation
  ↓ 1:1              ↓ 1:1
VoucherPopupLog    User (invitee)
```

---

## 下一步

### 后端 (优先级🔴)
1. **执行数据库迁移** (本文件顶部步骤)
2. **实现 LLM 评分服务** (模板质量评估)
3. **开发基础 CRUD 接口** (优惠券、邀请、活动)

### 前端 (优先级🔴)
1. **等待后端接口** (预计 3-4 天)
2. **准备 UI 组件** (优惠券弹窗、海报页面)
3. **了解 Stripe 集成** (折扣参数传递)

### 产品/测试 (优先级🟡)
1. **确认 LLM 评分标准** (逻辑清晰度、输入简单性权重)
2. **准备测试用例** (见任务拆解文档第四部分)
3. **设计海报视觉稿** (Heading/Body/Subtext)

---

## FAQ

**Q: 为什么不直接用 Prisma migrate?**
A: 项目目前没有 migrations 文件夹,可能使用其他迁移工具。提供了 SQL 脚本供团队使用。

**Q: 优惠券有效期为什么是7天?**
A: 根据最新需求变更,原14天改为7天 (见聊天记录)。

**Q: 会员用户能领取优惠券吗?**
A: 能。所有用户都能领取,但具体能否使用由 Stripe 决定 (可能会员套餐不支持折扣)。

**Q: 邀请人奖励什么时候发放?**
A: 被邀请人购买会员后发放 2000 credits (通过 `VoucherInvitation.rewardGranted` 防重)。

**Q: 海报页面是前端还是后端生成?**
A: 建议前端先用 `html2canvas`,如果效果不好再考虑后端 Puppeteer。

---

## 联系方式

如有疑问请联系:
- Schema 设计: AI Assistant (本次会话)
- 需求澄清: @孙庆雨 Eli (产品)
- 技术实现: @席瑞 (研发)

---

**创建时间**: 2025-12-05
**Schema 版本**: v1.0
**状态**: ✅ 已验证,可投入开发




1.折扣券生成与弹窗触发


含每日前 3 次限制、7 天有效期、统一领取

接入 LLM 模板质量评分（0–100），按“每 10 分 = 10% 折扣”映射为折扣率（最低 10% off，最高 90% off 即 1 折），生成 7 天有效折扣券；

实现“每天发布的前 3 次”触发弹窗逻辑（按用户+日期统计，跨天重置），后端记录防超额；

弹窗ui实现

弹窗不再区分会员/非会员，统一展示“立即使用 / 分享好友”按钮；

后台提供曝光记录接口并在触发时上报 voucher_popup_display埋点；

新增埋点 daily_publish_trigger_limit_reached



2、分享交互与海报展示页面开发

邀请码生成、领取限制、奖励发放

点击 Share 跳转海报展示页面，提供下载海报与复制链接功能；

后台生成唯一 invite_code 并绑定邀请人，限制同一链接仅可领取一次，被邀请人注册后发放折扣券，邀请人获 +2000 bonus credits（幂等发放）；

埋点 poster_download、share_link_copied、voucher_share_click


3.多入口折扣券抵扣与 Stripe 可用性判定
所有购买入口（画布内、模板详情页、Pricing 页面、领取弹窗、发布弹窗）检测用户有效折扣券并实时展示折后价；

前端在发起支付前调用“券可用性校验接口”，Stripe Checkout 按业务规则（如套餐限制）决定是否可用，若不可用则提示用户；

支付成功时标记券已用；

后台校验券状态、有效期、每日次数；

埋点 voucher_use_now_click、voucher_applied（带 entry_point）


4.自测与bug修复

验证首次发布弹窗、LLM 评分降级、会员/非会员分支、分享链路、受邀者领取与奖励发放、多入口券后价展示、多语言跳转、埋点数据完整性、邀请奖励积分发放幂等；

覆盖异常与防刷场景