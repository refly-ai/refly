# 优惠券系统实现分阶段计划

## 📋 分阶段拆分（用户版本）vs 原始模块对照

---

## ✅ **阶段1: 折扣券生成与弹窗触发**

### 用户描述的功能
- 含每日前 3 次限制、7 天有效期、统一领取
- 接入 LLM 模板质量评分（0–100），按"每 10 分 = 10% 折扣"映射为折扣率（最低 10% off，最高 90% off 即 1 折），生成 7 天有效折扣券
- 实现"每天发布的前 3 次"触发弹窗逻辑（按用户+日期统计，跨天重置），后端记录防超额
- 弹窗 UI 实现
- 弹窗不再区分会员/非会员，统一展示"立即使用 / 分享好友"按钮
- 后台提供曝光记录接口并在触发时上报 voucher_popup_display 埋点
- 新增埋点 daily_publish_trigger_limit_reached

### 对应原始模块
**✅ 模块0: 后端基础设施**
- [x] 数据库迁移 (执行 SQL 脚本)
- [x] 生成 Prisma Client
- [x] LLM 评分服务实现
  - 模板质量评分接口 (0-100)
  - 容错处理 (超时返回默认分数)
  - 监控告警
- [x] 基础 CRUD 接口
  - `POST /api/vouchers` - 创建优惠券
  - `GET /api/vouchers` - 查询用户有效优惠券

**✅ 模块1: 优惠券发放逻辑**
- [x] 后端任务
  - 监听模板发布事件
  - 查询当天触发次数 (每日前3次判断)
  - 调用 LLM 评分服务
  - 计算折扣率 (score / 10)
  - 插入 Voucher 记录 (expiresAt = now + 7天)
  - 插入 VoucherPopupLog 记录
  - 埋点触发: voucher_popup_display
- [x] 前端任务
  - 创建 VoucherRewardModal 组件
  - 展示恭喜文案 + 优惠券折扣率
  - 统一按钮: "Use It Now" + "Share"
  - 埋点: voucher_popup_display

### ⚠️ 遗漏检查
**缺少的内容：**
1. ❌ **"Use It Now" 按钮交互**
   - 需求: 点击后跳转 Stripe 月付页面
   - 应该在阶段1实现基础跳转（不含折扣计算）
   - 或者明确放到阶段3

2. ⚠️ **埋点 `voucher_use_now_click`**
   - 你列出了 `daily_publish_trigger_limit_reached`
   - 但缺少 `voucher_use_now_click`（点击 Use It Now 按钮时触发）
   - 建议补充到阶段1

### 🔧 建议补充
```markdown
### 阶段1 补充内容：
- "Use It Now" 按钮点击事件
  - 跳转到 Stripe 月付购买页面（不带折扣，只是路由跳转）
  - 埋点: voucher_use_now_click
- 埋点实现
  - voucher_popup_display ✅ (已有)
  - voucher_use_now_click ⚠️ (需补充)
  - daily_publish_trigger_limit_reached ✅ (已有)
```

---

## ✅ **阶段2: 分享交互与海报展示页面开发**

### 用户描述的功能
- 邀请码生成、领取限制、奖励发放
- 点击 Share 跳转海报展示页面，提供下载海报与复制链接功能
- 后台生成唯一 invite_code 并绑定邀请人，限制同一链接仅可领取一次，被邀请人注册后发放折扣券，邀请人获 +2000 bonus credits（幂等发放）
- 埋点 poster_download、share_link_copied、voucher_share_click

### 对应原始模块
**✅ 模块2: 海报展示页面**
- [x] 前端任务
  - 点击 Share 按钮 → 调用后端获取邀请数据
  - 跳转海报展示页面 (新路由/弹层)
  - 海报内容渲染 (Heading/Body/Subtext/Link + 二维码)
  - 下载海报功能 (html2canvas 或服务端生成)
  - 复制分享链接功能
  - 埋点: voucher_share_click, poster_download, share_link_copied
- [x] 后端任务
  - `POST /api/voucher-invitations` 接口
    - 生成唯一 invite_code (UUID)
    - 插入 VoucherInvitation 记录
    - 返回海报数据 (shareUrl, qrCodeUrl)
  - (可选) 服务端海报生成

### ⚠️ 遗漏检查
**缺少的内容：**
1. ❌ **邀请领取流程（阶段2只做了分享，没做领取）**
   - 受邀者点击链接后的流程
   - 优惠券领取弹窗
   - 奖励发放逻辑

   **建议**: 这部分应该属于 **模块3: 邀请领取流程**，你可能漏掉了这个模块！

### 🔧 建议调整
```markdown
### 阶段2 应该分为两部分：

#### 2A: 分享功能（模块2）
- Share 按钮交互
- 海报展示页面开发
- 邀请码生成接口
- 埋点: voucher_share_click, poster_download, share_link_copied

#### 2B: 邀请领取流程（模块3）⚠️ 你遗漏了这个！
- URL 参数检测 (?invite={code})
- 游客页 → 登录/注册 → 领取弹窗
- 邀请验证接口 (GET /api/voucher-invitations/:code/verify)
- 邀请领取接口 (POST /api/voucher-invitations/:code/claim)
- 奖励发放逻辑 (邀请人 +2000 credits)
- 埋点: auth::signup_success (加 entry_point), voucher_claim
```

**或者把 2B 单独作为阶段2.5或阶段3的前置任务**

---

## ⚠️ **阶段3: 多入口折扣券抵扣与 Stripe 可用性判定**

### 用户描述的功能
- 所有购买入口（画布内、模板详情页、Pricing 页面、领取弹窗、发布弹窗）检测用户有效折扣券并实时展示折后价
- 前端在发起支付前调用"券可用性校验接口"，Stripe Checkout 按业务规则（如套餐限制）决定是否可用，若不可用则提示用户
- 支付成功时标记券已用
- 后台校验券状态、有效期、每日次数
- 埋点 voucher_use_now_click、voucher_applied（带 entry_point）

### 对应原始模块
**✅ 模块4: 会员购买流程优惠券抵扣**
- [x] 后端任务
  - `GET /api/vouchers/available` - 查询用户有效券
  - `POST /api/vouchers/:id/validate` - 券可用性校验
  - Stripe Checkout 集成
    - 创建 Session 时传入券信息
    - 计算折扣后价格
    - Webhook 处理 (标记券已用)
  - 埋点: voucher_applied
- [x] 前端任务
  - 多入口查询有效券
  - 会员购买弹窗适配（月付默认选中，显示折后价）
  - "Use It Now" 按钮实现（直接跳 Stripe 月付）
  - 埋点: voucher_use_now_click, voucher_applied

### ⚠️ 遗漏检查
**可能缺少的内容：**
1. ⚠️ **会员购买弹窗的需求变更**
   - 需求稿说: "会员购买弹窗中不再展示折扣后的价格"
   - 但阶段3描述: "实时展示折后价"
   - **需要和产品确认**: 到底在哪里展示折后价？
     - 购买弹窗内？❌ (需求稿说不展示)
     - 只在 Stripe 页面？✅
     - Pricing 页面？(需求稿没提)

2. ✅ **埋点完整**
   - voucher_use_now_click ✅
   - voucher_applied (带 entry_point) ✅

### 🔧 建议明确
```markdown
### 阶段3 需要明确的细节：
1. 折后价展示位置
   - ❌ 会员购买弹窗中 (需求稿明确说不展示)
   - ✅ 只在 Stripe Checkout 页面展示折后价
   - ❓ Pricing 页面是否展示？(需产品确认)

2. 多入口支持
   - 画布内购买按钮
   - 模板详情页购买按钮
   - Pricing 页面
   - 领取弹窗 (邀请领取后直接跳转)
   - 发布弹窗 ("Use It Now" 按钮)
```

---

## ✅ **阶段4: 自测与 bug 修复**

### 用户描述的功能
- 验证首次发布弹窗、LLM 评分降级、会员/非会员分支、分享链路、受邀者领取与奖励发放、多入口券后价展示、多语言跳转、埋点数据完整性、邀请奖励积分发放幂等
- 覆盖异常与防刷场景

### 对应原始模块
**✅ 模块6: 埋点实现 (遗漏部分)**
**✅ 测试清单**

### ⚠️ 遗漏检查
**缺少的模块：**
1. ❌ **模块5: 多语言活动入口** (完全遗漏！)
   - Dashboard 和 Marketplace 活动入口组件
   - 调用活动配置接口
   - 多语言 URL 跳转逻辑
   - 埋点: activity_entry_click_dashboard, activity_entry_click_marketplace

   **重要性**: 🟡 中等 (独立功能，可并行开发或放到阶段5)

2. ❌ **模块7: 定时任务与数据清理** (完全遗漏！)
   - 过期优惠券清理定时任务
   - 日志归档
   - 数据统计

   **重要性**: 🟢 低 (可放到阶段5或后期优化)

### 🔧 建议补充
```markdown
### 阶段4 应该只做测试，新增两个阶段：

#### 阶段5: 运营活动入口 (模块5) ⚠️ 你遗漏了！
- Dashboard 活动入口组件
- Marketplace 活动入口组件
- GET /api/promotion-activities 接口
- 多语言 URL 跳转
- 埋点: activity_entry_click_dashboard, activity_entry_click_marketplace

#### 阶段6: 定时任务与优化 (模块7) ⚠️ 你遗漏了！
- 过期优惠券清理 (每小时)
- 日志归档 (每天)
- 数据统计接口
```

---

## 🚨 **总结：遗漏的任务**

### ❌ **严重遗漏（必须补充）**

| 遗漏内容 | 原属模块 | 建议放入阶段 | 影响 |
|---------|---------|------------|------|
| **邀请领取流程** | 模块3 | 阶段2B 或独立阶段2.5 | 🔴 高 - 分享链接点击后无法领取 |
| **Use It Now 基础交互** | 模块1/模块4 | 阶段1 (基础跳转) + 阶段3 (折扣逻辑) | 🔴 高 - 发布弹窗按钮无效 |
| **运营活动入口** | 模块5 | 新增阶段5 | 🟡 中 - 独立功能，可并行 |

### ⚠️ **可选遗漏（建议补充）**

| 遗漏内容 | 原属模块 | 建议放入阶段 | 影响 |
|---------|---------|------------|------|
| **定时清理任务** | 模块7 | 新增阶段6 | 🟢 低 - 数据会有脏数据但不影响功能 |
| **埋点 voucher_use_now_click** | 模块1 | 阶段1 | 🟡 中 - 数据统计不完整 |
| **Pricing 页面折后价展示** | 模块4 | 阶段3 | ❓ 需产品确认 |

---

## ✅ **修正后的完整分阶段计划**

### **阶段0: 前置准备（后端独立完成）**
- ✅ 数据库迁移 (执行 SQL 脚本)
- ✅ 生成 Prisma Client
- ✅ LLM 评分服务
- ✅ 基础 CRUD 接口

**预估工期**: 2-3天
**前后端依赖**: 后端完成后前端才能开始

---

### **阶段1: 折扣券生成与弹窗触发**
#### 后端
- [x] 监听模板发布事件
- [x] 每日前3次触发判断 (VoucherPopupLog)
- [x] LLM 评分 → 折扣率计算
- [x] 生成 Voucher 记录 (7天有效期)
- [x] 埋点: voucher_popup_display

#### 前端
- [x] VoucherRewardModal 组件
- [x] 统一文案和按钮 (Use It Now + Share)
- [x] "Use It Now" 基础跳转 (跳转到 Stripe 月付页面，不带折扣) **⚠️ 补充**
- [x] 埋点: voucher_popup_display, voucher_use_now_click **⚠️ 补充**

#### 埋点
- [x] voucher_popup_display
- [x] voucher_use_now_click **⚠️ 补充**
- [x] daily_publish_trigger_limit_reached

**预估工期**: 2-3天

---

### **阶段2A: 分享功能（海报展示页面）**
#### 后端
- [x] POST /api/voucher-invitations (生成邀请码)
- [x] 返回海报数据 (shareUrl, qrCodeUrl)

#### 前端
- [x] Share 按钮交互
- [x] 海报展示页面 (独立路由/弹层)
- [x] 海报内容渲染 (文案 + 二维码)
- [x] 下载海报 (html2canvas)
- [x] 复制分享链接

#### 埋点
- [x] voucher_share_click
- [x] poster_download
- [x] share_link_copied

**预估工期**: 2-3天

---

### **阶段2B: 邀请领取流程** **⚠️ 新增（你遗漏的）**
#### 后端
- [x] GET /api/voucher-invitations/:code/verify (验证邀请码)
- [x] POST /api/voucher-invitations/:code/claim (领取优惠券)
- [x] 奖励发放逻辑 (邀请人 +2000 credits，幂等)

#### 前端
- [x] URL 参数检测 (?invite={code})
- [x] 游客页 → 登录/注册流程
- [x] VoucherClaimModal 组件 (领取弹窗)
- [x] 已领取提示

#### 埋点
- [x] auth::signup_success (加 entry_point)
- [x] voucher_claim

**预估工期**: 2-3天

---

### **阶段3: 多入口折扣券抵扣与 Stripe 集成**
#### 后端
- [x] GET /api/vouchers/available (查询用户有效券)
- [x] POST /api/vouchers/:id/validate (券可用性校验)
- [x] Stripe Checkout 集成
  - 传入券信息
  - 计算折后价
  - Webhook 标记券已用

#### 前端
- [x] 多入口检测有效券
  - 画布内购买按钮
  - 模板详情页
  - Pricing 页面
  - 领取弹窗 (直接跳转)
  - 发布弹窗 ("Use It Now" 完整逻辑)
- [x] Stripe 页面展示折后价 (❌ 不在会员购买弹窗)

#### 埋点
- [x] voucher_applied (带 entry_point)

**预估工期**: 3-4天

---

### **阶段4: 全面自测与 Bug 修复**
- [x] 功能测试 (所有流程)
- [x] 边界测试 (异常场景)
- [x] 埋点验证
- [x] 性能测试
- [x] 防刷机制验证

**预估工期**: 2-3天

---

### **阶段5: 运营活动入口** **⚠️ 新增（你遗漏的）**
#### 后端
- [x] GET /api/promotion-activities (查询上架活动)

#### 前端
- [x] Dashboard 活动入口组件
- [x] Marketplace 活动入口组件
- [x] 多语言 URL 跳转逻辑

#### 埋点
- [x] activity_entry_click_dashboard
- [x] activity_entry_click_marketplace

**预估工期**: 1-2天
**优先级**: 🟡 中 (可与阶段3并行开发)

---

### **阶段6: 定时任务与优化（可选）** **⚠️ 新增（你遗漏的）**
- [x] 过期优惠券清理 (每小时)
- [x] 日志归档 (每天)
- [x] 数据统计接口

**预估工期**: 1-2天
**优先级**: 🟢 低 (可后期优化)

---

## 📊 **总工期估算**

| 阶段 | 工期 | 可并行 |
|-----|------|--------|
| 阶段0 (前置) | 2-3天 | ❌ 必须先完成 |
| 阶段1 | 2-3天 | ❌ 依赖阶段0 |
| 阶段2A | 2-3天 | ✅ 可与2B并行部分工作 |
| 阶段2B | 2-3天 | ✅ 后端可与2A并行 |
| 阶段3 | 3-4天 | ✅ 可与阶段5并行 |
| 阶段4 | 2-3天 | ❌ 依赖前面所有 |
| 阶段5 | 1-2天 | ✅ 可与阶段3并行 |
| 阶段6 | 1-2天 | ✅ 可最后做 |

**最快路径**: 约 2-3 周 (前后端并行 + 部分阶段并行)
**保守估计**: 约 3-4 周

---

## 🎯 **最终建议**

### **必须补充的内容**
1. ✅ **阶段2B: 邀请领取流程** (完全遗漏，必须加上)
2. ✅ **阶段1: Use It Now 基础交互** (阶段1只做跳转，阶段3做折扣)
3. ✅ **阶段5: 运营活动入口** (独立功能，可并行)

### **可选补充的内容**
4. ⚠️ **阶段6: 定时任务** (优先级低，可后期做)
5. ⚠️ **埋点完整性** (确保所有埋点在对应阶段实现)

### **需要产品确认的**
- 会员购买弹窗是否展示折后价？(需求稿说不展示，但逻辑上应该提示有券)
- Pricing 页面是否展示折后价？(需求稿未提)

---

**文档创建时间**: 2025-12-05
**版本**: v1.0
