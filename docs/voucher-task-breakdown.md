# 优惠券活动需求 - 任务拆解

## 一、已完成：数据表设计 ✅

### 完成内容
1. ✅ 设计并实现了4张核心数据表的 Prisma Schema
   - `Voucher` (优惠券表)
   - `VoucherInvitation` (邀请记录表)
   - `VoucherPopupLog` (弹窗触发日志表)
   - `PromotionActivity` (运营活动配置表)

2. ✅ 创建了完整的设计文档
   - 文件位置: `/docs/voucher-schema-design.md`
   - 包含表结构说明、业务逻辑、数据流程、索引优化建议

3. ✅ 生成了可执行的 SQL 迁移脚本
   - 文件位置: `/docs/voucher-schema-migration.sql`
   - 包含建表语句、索引创建、注释添加

4. ✅ 验证了 Prisma Schema 语法正确性
   - 运行 `npx prisma validate` 通过

### 关键设计决策

#### 1. 折扣券实现 (需求变更)
- **原需求**: 固定金额券 ($5/$10/$15/$18)
- **新需求**: 折扣券 (按LLM评分计算折扣率)
- **实现方式**:
  - 字段: `discountPercent` (Int, 10-90)
  - 计算公式: `score / 10 = 折扣百分比`
  - 示例: 90分 → 90% off → 即1折

#### 2. 每日触发限制 (需求变更)
- **原需求**: 首次发布触发
- **新需求**: 每天发布的前3次触发
- **实现方式**:
  - 表: `VoucherPopupLog`
  - 逻辑: 查询当天(`popup_date`)已触发次数，< 3 则显示弹窗

#### 3. 会员区分取消 (需求变更)
- **原需求**: 弹窗区分会员/非会员，不同按钮和文案
- **新需求**: 统一允许领取，由Stripe决定能否使用
- **简化点**:
  - 前端无需会员判断逻辑
  - 后端发券不区分身份
  - 减少一半的前端开发工作量

#### 4. 多语言跳转
- **实现**: `PromotionActivity` 表支持3个URL字段
  - `landingPageUrl` (默认)
  - `landingPageUrlZh` (中文)
  - `landingPageUrlEn` (英文)
- **逻辑**: 根据用户产品语言选择对应URL，无则用默认

---

## 二、待开发功能模块

### 模块 0: 后端基础设施 (前置任务, 优先级: 🔴 最高)

**负责**: 后端开发

#### 任务列表
1. **数据库迁移**
   - [ ] 执行 SQL 迁移脚本 (`voucher-schema-migration.sql`)
   - [ ] 验证表结构和索引创建成功
   - [ ] 生成 Prisma Client

2. **LLM 评分服务**
   - [ ] 实现模板质量评分接口
     - 输入: 模板结构数据 (JSON)
     - 输出: 评分 (0-100)
     - 评估维度: 逻辑清晰度、输入简单性、通用性
   - [ ] 容错处理: 超时/异常时返回默认分数 (如50分)
   - [ ] 监控告警: 评分服务可用性监控

3. **基础 CRUD 接口**
   - [ ] 优惠券相关接口
     - `POST /api/vouchers` - 创建优惠券
     - `GET /api/vouchers` - 查询用户有效优惠券
     - `PATCH /api/vouchers/:id/use` - 标记优惠券已使用
   - [ ] 邀请相关接口
     - `POST /api/voucher-invitations` - 创建邀请
     - `GET /api/voucher-invitations/:code` - 验证邀请码
     - `POST /api/voucher-invitations/:id/claim` - 领取优惠券
   - [ ] 活动配置接口
     - `GET /api/promotion-activities` - 查询上架活动

**预估工期**: 3-4天

---

### 模块 1: 优惠券发放逻辑 (优先级: 🔴 高)

**负责**: 后端 + 前端

#### 后端任务
1. **发布触发检测**
   - [ ] 监听模板发布事件
   - [ ] 查询当天触发次数 (`VoucherPopupLog.popup_date = today`)
   - [ ] 如果 < 3次，继续流程；否则跳过

2. **LLM 评分与优惠券生成**
   - [ ] 调用 LLM 评分服务
   - [ ] 计算折扣率: `discountPercent = Math.floor(score / 10)`
   - [ ] 插入 `Voucher` 记录
     - `source = 'template_publish'`
     - `expiresAt = createdAt + 7 days`
   - [ ] 插入 `VoucherPopupLog` 记录

3. **接口实现**
   - [ ] `POST /api/templates/:id/publish` 扩展
     - 返回: `{ success, voucher: { voucherId, discountPercent, expiresAt } }`
   - [ ] 埋点触发: `voucher_popup_display`

#### 前端任务
1. **优惠券弹窗组件**
   - [ ] 创建 `VoucherRewardModal` 组件
   - [ ] 展示内容:
     - 恭喜文案 + 优惠券折扣率
     - "To celebrate your great work, we're giving you a X% off Voucher (valid for 7 days)"
   - [ ] 按钮:
     - **Use It Now** → 跳转 Stripe 月付页面
     - **Share** → 打开海报展示页面

2. **触发逻辑**
   - [ ] 在 Publish 面板点击 "Publish" 后调用发布接口
   - [ ] 如果返回 `voucher` 数据，显示弹窗
   - [ ] 埋点: `voucher_popup_display`

**预估工期**: 2-3天

---

### 模块 2: 海报展示页面 (优先级: 🔴 高)

**负责**: 前端 + 后端

#### 前端任务
1. **海报页面开发**
   - [ ] 创建独立路由或弹层页面
   - [ ] 海报内容:
     - Heading: "Unlock Plus for Just $XX.XX!"
     - Body: "You're invited to enjoy full access to Refly Plus with a X% discount"
     - Subtext: "Voucher valid for 7 days."
     - 邀请链接 + 二维码
   - [ ] 交互功能:
     - **下载海报**: 使用 `html2canvas` 或服务端生成图片
     - **复制分享链接**: 复制到剪贴板 + Toast 提示
   - [ ] 二维码生成:
     - 扫码跳转: 游客页(未登录) / 工作台(已登录)

2. **埋点实现**
   - [ ] `poster_download` - 下载海报按钮点击
   - [ ] `share_link_copied` - 复制链接按钮点击

#### 后端任务
1. **邀请链接生成**
   - [ ] `POST /api/voucher-invitations` 接口
     - 输入: `{ voucherId, inviterUid }`
     - 生成唯一 `inviteCode` (UUID 或随机字符串)
     - 插入 `VoucherInvitation` 记录
     - 返回: `{ inviteCode, shareUrl, qrCodeUrl }`

2. **(可选) 服务端海报生成**
   - [ ] 如果前端 `html2canvas` 效果不佳
   - [ ] 使用 Puppeteer/Playwright 生成海报图片
   - [ ] 返回图片 URL

**预估工期**: 3-4天

---

### 模块 3: 邀请领取流程 (优先级: 🔴 高)

**负责**: 后端 + 前端

#### 后端任务
1. **邀请验证接口**
   - [ ] `GET /api/voucher-invitations/:code/verify`
     - 验证邀请码有效性
     - 返回: `{ valid, status, discountPercent, inviterInfo }`
     - 状态: `unclaimed` / `claimed` / `expired`

2. **邀请领取接口**
   - [ ] `POST /api/voucher-invitations/:code/claim`
     - 检查邀请码状态 (必须是 `unclaimed`)
     - 创建新优惠券给被邀请人
       - `source = 'invitation_claim'`
       - `sourceId = invitationId`
     - 更新邀请记录:
       - `status = 'claimed'`
       - `inviteeUid = currentUser.uid`
       - `claimedAt = now()`
     - 返回: `{ voucher: { voucherId, discountPercent, expiresAt } }`
     - **事务保证**: 原子性操作

3. **奖励发放逻辑**
   - [ ] 监听被邀请人购买会员事件
   - [ ] 给邀请人发放 2000 credits
     - 检查 `rewardGranted = false`
     - 调用积分系统接口
     - 标记 `rewardGranted = true`
   - [ ] 埋点: `voucher_claim`

#### 前端任务
1. **URL 参数检测**
   - [ ] 在应用入口检测 `?invite={code}`
   - [ ] 存储到 localStorage 或 state

2. **游客页处理**
   - [ ] 未登录用户访问带邀请码链接
   - [ ] 点击 "Get Started" → 跳转登录/注册页
   - [ ] 登录/注册成功后 → 跳转工作台 + 显示优惠券领取弹窗

3. **优惠券领取弹窗**
   - [ ] 创建 `VoucherClaimModal` 组件
   - [ ] 展示内容:
     - "You've received a X% off Voucher!"
     - 优惠券信息 (折扣率、有效期)
   - [ ] 按钮:
     - **Claim** → 调用领取接口 → 成功后跳转 Stripe
   - [ ] 已领取提示: "This voucher has already been claimed."

4. **埋点实现**
   - [ ] `auth::signup_success` - 加 `entry_point` 字段
   - [ ] `voucher_claim` - 领取成功

**预估工期**: 3-4天

---

### 模块 4: 会员购买流程优惠券抵扣 (优先级: 🔴 高)

**负责**: 后端 + 前端

#### 后端任务
1. **优惠券可用性查询**
   - [ ] `GET /api/vouchers/available`
     - 查询用户有效优惠券 (按折扣率降序)
     - 返回: `{ vouchers: [{ voucherId, discountPercent, expiresAt }] }`

2. **Stripe Checkout 集成**
   - [ ] 创建 Checkout Session 时传入优惠券信息
   - [ ] 计算折扣后价格
     - `discountedPrice = originalPrice * (1 - discountPercent / 100)`
   - [ ] Stripe 折扣应用 (可能需要用 Stripe Coupon API)
   - [ ] 支付成功 Webhook 处理:
     - 标记优惠券: `status = 'used'`, `usedAt = now()`, `subscriptionId = xxx`
     - 触发埋点: `voucher_applied`

3. **券可用性校验**
   - [ ] (可选) `POST /api/vouchers/:id/validate` 接口
   - [ ] 校验当前用户是否符合使用条件
   - [ ] 返回: `{ canUse, reason }`

#### 前端任务
1. **购买流程改造**
   - [ ] 在多个入口 (画布、模板详情页、Pricing页) 调用优惠券查询接口
   - [ ] 如果有可用优惠券:
     - **会员购买弹窗**: 显示折扣后价格 (月付默认选中)
     - **Pricing 页面**: 显示折扣标签 "X% off applied"
     - **Stripe 页面**: 显示折扣信息

2. **"Use It Now" 按钮实现**
   - [ ] 从优惠券弹窗点击 → 直接跳转 Stripe 月付页面
   - [ ] URL 参数带上 `voucherId`
   - [ ] 埋点: `voucher_use_now_click`

3. **购买弹窗 UI 更新**
   - [ ] 不再展示折扣后价格 (需求变更)
   - [ ] 只在 Stripe 页面显示抵扣

4. **埋点实现**
   - [ ] `voucher_use_now_click` - Use It Now 按钮
   - [ ] `voucher_applied` - 支付成功时触发 (后端)

**预估工期**: 3-4天

---

### 模块 5: 多语言活动入口 (优先级: 🟡 中)

**负责**: 后端 + 前端

#### 后端任务
1. **活动配置接口**
   - [ ] `GET /api/promotion-activities`
     - 查询条件: `status = 'published'`, `position = ?`, `deletedAt IS NULL`
     - 排序: `createdAt DESC`
     - 返回: `{ activities: [{ activityId, activityText, imageUrl, landingPageUrl, landingPageUrlZh, landingPageUrlEn }] }`

#### 前端任务
1. **活动入口组件**
   - [ ] 在 Dashboard 和 Marketplace 页面添加固定位置展示
   - [ ] 调用活动配置接口
   - [ ] 只展示当前上架活动

2. **多语言跳转逻辑**
   - [ ] 获取用户产品语言 (`uiLocale` 或全局状态)
   - [ ] 点击事件:
     - 如果语言为中文 且 `landingPageUrlZh` 存在 → 跳转中文URL
     - 如果语言为英文 且 `landingPageUrlEn` 存在 → 跳转英文URL
     - 否则 → 跳转 `landingPageUrl`
   - [ ] 新标签页打开

3. **埋点实现**
   - [ ] `activity_entry_click_dashboard` - Dashboard 入口点击
   - [ ] `activity_entry_click_marketplace` - Marketplace 入口点击

**预估工期**: 1-2天

---

### 模块 6: 埋点实现 (优先级: 🟡 中)

**负责**: 前端 + 后端

#### 埋点列表

| 事件名称 | 事件ID | User Properties | Event Properties | 触发时机 | 负责 |
|---------|--------|----------------|-----------------|---------|------|
| Dashboard 活动入口点击 | `activity_entry_click_dashboard` | `user_type` | - | Dashboard 点击活动入口 | 前端 |
| Marketplace 活动入口点击 | `activity_entry_click_marketplace` | `user_type` | - | Marketplace 点击活动入口 | 前端 |
| Use It Now 点击 | `voucher_use_now_click` | `user_type` | `voucher_value` | 弹窗点击 Use It Now | 前端 |
| Share 点击 | `voucher_share_click` | `user_type` | `voucher_value` | 弹窗点击 Share/Share Now | 前端 |
| 海报下载 | `poster_download` | `user_type` | `voucher_value` | 下载海报 | 前端 |
| 分享链接复制 | `share_link_copied` | `user_type` | `voucher_value` | 复制分享链接 | 前端 |
| 优惠券弹窗曝光 | `voucher_popup_display` | `user_type` | `voucher_value` | 优惠券弹窗展示 | 前端 |
| 优惠券领取 | `voucher_claim` | - | - | 检测到优惠券已领取 | 后端 |
| 优惠券折扣应用 | `voucher_applied` | - | `voucher_value`, `entry_point` | 成功使用优惠券购买 | 后端 |
| 注册成功 | `auth::signup_success` | - | `entry_point` | 通过邀请链接完成注册 | 后端 |

**注意事项**:
- `user_type`: 需要从用户订阅状态判断 (free / plus)
- `voucher_value`: 改为 `discountPercent` (10-90)
- `entry_point`:
  - 购买入口: `canvas` / `template_detail` / `pricing_page` / `claim_popup` / `publish_popup`
  - 注册入口: `visitor_page` / `template_detail`

**预估工期**: 1-2天

---

### 模块 7: 定时任务与数据清理 (优先级: 🟢 低)

**负责**: 后端

#### 任务列表
1. **过期优惠券清理**
   - [ ] 定时任务 (每小时执行)
   - [ ] 查询: `status = 'unused' AND expiresAt < NOW()`
   - [ ] 更新: `status = 'expired'`

2. **日志归档**
   - [ ] 归档 30 天前的 `VoucherPopupLog`
   - [ ] 定时任务 (每天凌晨执行)

3. **数据统计**
   - [ ] 优惠券发放/使用/过期统计
   - [ ] 邀请转化率统计
   - [ ] 导出报表接口 (可选)

**预估工期**: 1-2天

---

## 三、依赖关系与并行开发建议

### 关键路径 (Critical Path)
```
模块0 (后端基础) → 模块1 (优惠券发放) → 模块2 (海报页面)
                                     ↓
                                  模块3 (邀请领取) → 模块4 (购买抵扣)
```

### 可并行开发
- **模块5 (多语言入口)** - 独立功能，可与模块2/3并行
- **模块6 (埋点)** - 可在各模块开发过程中同步添加
- **模块7 (定时任务)** - 核心功能稳定后再开发

### 建议排期
| 模块 | 预估工期 | 依赖 | 建议开始时间 |
|------|---------|------|-------------|
| 模块0 | 3-4天 | - | Week 1 Day 1 |
| 模块1 | 2-3天 | 模块0 | Week 1 Day 4 |
| 模块2 | 3-4天 | 模块1 | Week 2 Day 2 |
| 模块3 | 3-4天 | 模块1 | Week 2 Day 2 (并行) |
| 模块4 | 3-4天 | 模块1 | Week 3 Day 1 |
| 模块5 | 1-2天 | 模块0 | Week 2 Day 2 (并行) |
| 模块6 | 1-2天 | - | 各模块开发中同步 |
| 模块7 | 1-2天 | 模块4 | Week 3 Day 5 |

**总工期**: 约 3-4 周 (前端 + 后端并行)

---

## 四、测试清单

### 功能测试
- [ ] 模板发布触发优惠券 (每天前3次)
- [ ] LLM 评分映射为折扣率正确
- [ ] 优惠券7天有效期计算正确
- [ ] 分享链接生成和领取流程
- [ ] 邀请码一次性使用限制
- [ ] 已领取提示正确显示
- [ ] 多个优惠券共存
- [ ] Stripe 购买抵扣正确
- [ ] 邀请人奖励发放正确 (2000 credits)
- [ ] 多语言URL跳转正确

### 边界测试
- [ ] 第4次发布不触发弹窗
- [ ] 跨天重置触发次数
- [ ] LLM 评分服务异常降级
- [ ] 同一邀请码重复领取拦截
- [ ] 已过期优惠券无法使用
- [ ] 会员用户购买后邀请人奖励发放

### 性能测试
- [ ] 查询用户有效优惠券 (<100ms)
- [ ] 邀请码验证 (<50ms)
- [ ] 海报生成 (<2s)

### 埋点验证
- [ ] 所有埋点事件正确上报
- [ ] `user_type` 字段准确
- [ ] `voucher_value` 为折扣率而非金额
- [ ] `entry_point` 字段完整

---

## 五、风险点与注意事项

### 技术风险
1. **LLM 评分稳定性**
   - 风险: 评分服务超时/异常导致用户无法获得优惠券
   - 缓解: 实现降级策略 (默认50分) + 监控告警

2. **Stripe 折扣集成**
   - 风险: Stripe API 可能不支持动态折扣率
   - 缓解: 提前调研 Stripe Coupon API 或 Checkout Session 折扣参数

3. **二维码跳转兼容性**
   - 风险: 移动端扫码后无法正确跳转
   - 缓解: 测试主流扫码工具 (微信、支付宝、iOS相机)

### 业务风险
1. **防刷机制**
   - 风险: 用户恶意注册小号刷优惠券
   - 缓解:
     - 限制同一IP/设备注册频率
     - 监控异常邀请行为
     - 人工审核奖励发放

2. **优惠券滥用**
   - 风险: 用户分享优惠券后自己注册小号领取
   - 缓解:
     - 邀请人和被邀请人不能是同一设备/IP
     - 新用户注册后一定时间内才能购买会员

### 数据一致性
1. **并发领取同一邀请码**
   - 解决: 使用数据库事务 + 唯一约束

2. **重复发放奖励**
   - 解决: `rewardGranted` 布尔标记 + 幂等性检查

---

## 六、后续优化方向

1. **A/B 测试**
   - 测试不同折扣率对转化率的影响
   - 测试不同弹窗文案的效果

2. **个性化推荐**
   - 根据用户行为调整触发频率
   - 根据模板类型调整折扣率

3. **社交分享增强**
   - 支持一键分享到 Twitter/LinkedIn
   - 自动生成社交媒体海报

4. **数据看板**
   - 优惠券发放/使用/转化率
   - 邀请链路分析
   - ROI 计算

---

## 七、相关文档

- **Schema 设计文档**: `/docs/voucher-schema-design.md`
- **SQL 迁移脚本**: `/docs/voucher-schema-migration.sql`
- **Prisma Schema**: `/apps/api/prisma/schema.prisma` (行 2000-2120)
- **原始需求稿**: (见聊天记录)

---

## 八、联系人

- **产品**: @孙庆雨 Eli
- **设计**: @范桢
- **研发**: @席瑞
- **测试**: @尚欣雨
- **运营**: @李锦威Joey
- **CC**: @黄巍

---

**文档创建时间**: 2025-12-05
**最后更新**: 2025-12-05
**版本**: v1.0
