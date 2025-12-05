# 阶段1：折扣券生成与弹窗触发 - 设计文档

## 📋 概述

本文档详细描述阶段1的技术实现方案，重点讨论 **LLM 模板质量评分** 的设计。

---

## 一、功能目标

### 核心需求
1. **LLM 模板质量评分**：接入 LLM 对已发布模板进行质量评估（0-100分）
2. **折扣率计算**：每 10 分 = 10% 折扣（最低 10% off，最高 90% off）
3. **每日触发限制**：每用户每天发布的前 3 次触发弹窗
4. **优惠券生成**：生成 7 天有效期的折扣券
5. **弹窗 UI**：统一展示"Use It Now" + "Share"按钮
6. **埋点上报**：`voucher_popup_display`、`voucher_use_now_click`、`daily_publish_trigger_limit_reached`

---

## 二、LLM 模板质量评分 - 方案讨论

### 2.1 评分时机选择

#### **方案A：在模板发布时同步评分（推荐 ✅）**

```
用户点击 Publish → 触发评分 → 等待结果 → 显示弹窗（带折扣券）
```

**优点**：
- 用户体验连贯，发布后立即看到奖励
- 评分与发布紧密结合，数据一致性好
- 简化系统架构

**缺点**：
- 增加发布等待时间（预计 2-5 秒）
- LLM 调用失败会影响弹窗展示

#### **方案B：异步评分（后台队列）**

```
用户点击 Publish → 立即返回 → 后台队列评分 → 评分完成后生成优惠券 → 下次进入时通知
```

**优点**：
- 发布流程不受影响
- 可以重试失败的评分任务

**缺点**：
- 用户无法立即看到奖励
- 需要额外的通知机制
- 系统复杂度增加

#### **推荐方案：A + 降级机制**

采用**同步评分 + 超时降级**策略：
- 正常情况：同步调用 LLM 评分，等待 2-5 秒
- 超时/异常：使用默认分数（如 50 分），保证弹窗正常显示
- 后续优化：可以在后台异步更新评分（V2）

---

### 2.2 评分维度设计

根据需求稿和现有代码分析，建议从以下维度评估模板质量：

#### **维度1：结构完整性（30分）**
- 节点数量合理性（不宜过多或过少）
- 节点类型多样性（是否包含多种技能）
- 节点连接逻辑清晰度

#### **维度2：输入设计（25分）**
- 变量命名规范性（是否语义化）
- 变量描述完整性
- 输入参数数量合理性（不宜过多导致用户负担）

#### **维度3：提示词质量（25分）**
- 提示词清晰度
- 任务描述明确性
- 上下文信息完整性

#### **维度4：通用性与可复用性（20分）**
- 模板是否具有通用价值
- 是否容易被其他用户理解和使用
- 标题和描述的吸引力

---

### 2.3 LLM 评分 Prompt 设计

#### **方案1：单次评分（简单直接）**

```typescript
const TEMPLATE_QUALITY_SCORING_PROMPT = `
# 模板质量评估专家

你是一个专业的工作流模板质量评估专家。请根据以下维度对模板进行评分（0-100分）。

## 评分维度

### 1. 结构完整性（0-30分）
- 节点数量是否合理（3-10个节点为佳）
- 节点连接是否清晰无冗余
- 工作流是否可顺利执行

### 2. 输入设计（0-25分）
- 变量命名是否语义化、易理解
- 变量描述是否完整清晰
- 输入参数数量是否合理（2-5个为佳）

### 3. 提示词质量（0-25分）
- 提示词是否清晰明确
- 任务描述是否完整
- 是否有足够的上下文信息

### 4. 通用性与可复用性（0-20分）
- 模板是否具有通用价值（而非过于特定）
- 其他用户是否容易理解和使用
- 标题和描述是否吸引人

## 输入信息

### 模板基本信息
- 标题: {{title}}
- 描述: {{description}}

### 工作流节点
{{nodesInfo}}

### 变量定义
{{variablesInfo}}

### 模板内容
{{templateContent}}

## 输出格式

请返回 JSON 格式的评分结果：

\`\`\`json
{
  "score": <总分0-100>,
  "breakdown": {
    "structure": <0-30>,
    "inputDesign": <0-25>,
    "promptQuality": <0-25>,
    "reusability": <0-20>
  },
  "feedback": "<简短的改进建议，1-2句话>"
}
\`\`\`

请严格按照维度评分，确保总分等于各维度分数之和。
`;
```

#### **方案2：多阶段评分（精细但复杂）**

第一阶段：结构分析
```typescript
// 分析节点结构，返回结构评分
const structurePrompt = `分析工作流结构...`;
```

第二阶段：内容质量分析
```typescript
// 分析提示词和变量质量
const contentPrompt = `分析内容质量...`;
```

第三阶段：综合评分
```typescript
// 基于前两阶段结果，给出最终评分
const finalPrompt = `综合评分...`;
```

#### **推荐：方案1（单次评分）**

理由：
- 实现简单，维护成本低
- 一次 LLM 调用完成，延迟可控
- 对于优惠券场景，不需要过于精细的评分

---

### 2.4 评分服务实现

#### **新建评分服务文件**

位置：`apps/api/src/modules/voucher/template-scoring.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { User } from '@prisma/client';
import { ProviderService } from '../provider/provider.service';

// Zod Schema for structured output
const TemplateScoringResultSchema = z.object({
  score: z.number().min(0).max(100).describe('总分 0-100'),
  breakdown: z.object({
    structure: z.number().min(0).max(30).describe('结构完整性 0-30'),
    inputDesign: z.number().min(0).max(25).describe('输入设计 0-25'),
    promptQuality: z.number().min(0).max(25).describe('提示词质量 0-25'),
    reusability: z.number().min(0).max(20).describe('通用性 0-20'),
  }),
  feedback: z.string().describe('简短改进建议'),
});

type TemplateScoringResult = z.infer<typeof TemplateScoringResultSchema>;

// 评分输入数据结构
interface TemplateScoringInput {
  title: string;
  description?: string;
  nodes: Array<{
    id: string;
    type: string;
    title?: string;
    query?: string;
  }>;
  variables: Array<{
    name: string;
    variableType: string;
    description?: string;
  }>;
  templateContent?: string;
}

@Injectable()
export class TemplateScoringService {
  private readonly logger = new Logger(TemplateScoringService.name);

  // 默认分数（用于降级）
  private readonly DEFAULT_SCORE = 50;

  // 评分超时时间（毫秒）
  private readonly SCORING_TIMEOUT = 10000; // 10秒

  constructor(private readonly providerService: ProviderService) {}

  /**
   * 对模板进行质量评分
   * @param user 用户信息（用于获取 LLM provider）
   * @param input 模板数据
   * @returns 评分结果（0-100）
   */
  async scoreTemplate(
    user: User,
    input: TemplateScoringInput,
  ): Promise<{ score: number; breakdown?: TemplateScoringResult['breakdown']; feedback?: string }> {
    try {
      this.logger.log(`Starting template scoring for: ${input.title}`);

      // 构建评分 prompt
      const prompt = this.buildScoringPrompt(input);

      // 带超时的 LLM 调用
      const result = await this.callLLMWithTimeout(user, prompt);

      // 验证分数范围
      const validatedScore = Math.max(0, Math.min(100, result.score));

      this.logger.log(`Template scoring completed: ${validatedScore}/100`);

      return {
        score: validatedScore,
        breakdown: result.breakdown,
        feedback: result.feedback,
      };
    } catch (error) {
      this.logger.error(`Template scoring failed: ${error.message}`);

      // 降级：返回默认分数
      return {
        score: this.DEFAULT_SCORE,
        feedback: 'Scoring service temporarily unavailable, using default score.',
      };
    }
  }

  /**
   * 带超时的 LLM 调用
   */
  private async callLLMWithTimeout(
    user: User,
    prompt: string,
  ): Promise<TemplateScoringResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.SCORING_TIMEOUT);

    try {
      // 获取 LLM model
      const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
      if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
        throw new Error('No valid LLM provider found');
      }

      const model = await this.providerService.prepareChatModel(user, chatPi.itemId);

      // 使用 withStructuredOutput 获取结构化输出
      const response = await model
        .withStructuredOutput(TemplateScoringResultSchema)
        .invoke(prompt, { signal: controller.signal });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 构建评分 Prompt
   */
  private buildScoringPrompt(input: TemplateScoringInput): string {
    const nodesInfo = input.nodes
      .map((n, i) => `${i + 1}. [${n.type}] ${n.title || 'Unnamed'}\n   Query: ${n.query || 'N/A'}`)
      .join('\n');

    const variablesInfo = input.variables.length > 0
      ? input.variables
          .map((v) => `- ${v.name} (${v.variableType}): ${v.description || 'No description'}`)
          .join('\n')
      : 'No variables defined';

    return `# Template Quality Scoring Expert

You are a professional workflow template quality evaluator. Score the following template on a scale of 0-100.

## Scoring Dimensions

### 1. Structure Completeness (0-30 points)
- Reasonable number of nodes (3-10 is ideal)
- Clear node connections without redundancy
- Workflow can execute smoothly

### 2. Input Design (0-25 points)
- Semantic and understandable variable names
- Complete and clear variable descriptions
- Reasonable number of input parameters (2-5 is ideal)

### 3. Prompt Quality (0-25 points)
- Clear and explicit prompts
- Complete task descriptions
- Sufficient context information

### 4. Reusability (0-20 points)
- Template has general value (not too specific)
- Easy for other users to understand and use
- Attractive title and description

## Template Information

### Basic Info
- Title: ${input.title}
- Description: ${input.description || 'No description'}

### Workflow Nodes (${input.nodes.length} total)
${nodesInfo}

### Variables (${input.variables.length} total)
${variablesInfo}

${input.templateContent ? `### Generated Template Content\n${input.templateContent}` : ''}

## Output Format

Return JSON only:

\`\`\`json
{
  "score": <total 0-100>,
  "breakdown": {
    "structure": <0-30>,
    "inputDesign": <0-25>,
    "promptQuality": <0-25>,
    "reusability": <0-20>
  },
  "feedback": "<1-2 sentence improvement suggestion>"
}
\`\`\`

Ensure total score equals sum of breakdown scores.`;
  }

  /**
   * 将评分转换为折扣百分比
   * 规则：每 10 分 = 10% 折扣
   * 例：90分 = 90% off（即1折），10分 = 10% off（即9折）
   */
  scoreToDiscountPercent(score: number): number {
    // 向下取整到10的倍数，确保在 10-90 范围内
    const discountPercent = Math.floor(score / 10) * 10;
    return Math.max(10, Math.min(90, discountPercent));
  }
}
```

---

### 2.5 降级策略详解

#### **降级场景**

| 场景 | 降级策略 | 默认分数 |
|------|---------|---------|
| LLM 服务不可用 | 返回默认分数 | 50 |
| 调用超时（>10秒） | 中断并返回默认分数 | 50 |
| 返回格式异常 | 尝试解析，失败则默认分数 | 50 |
| 分数超出范围 | 截断到 0-100 | - |
| 用户无 LLM provider | 跳过评分，使用默认分数 | 50 |

#### **降级分数选择理由**

选择 **50 分**（即 50% off，5折）作为默认分数：
- 中间值，对用户公平
- 不会给予过高或过低的折扣
- 激励用户重新提交以获得更准确的评分

---

### 2.6 评分结果存储

#### **方案1：存储到 Voucher 表（推荐）**

当前 Voucher 表已有 `llmScore` 字段：

```prisma
model Voucher {
  llmScore        Int?      @map("llm_score")  // 存储评分结果
  discountPercent Int       @map("discount_percent")  // 折扣百分比
  // ...
}
```

#### **方案2：扩展存储详细评分**

如果需要存储详细的评分breakdown，可以新增字段：

```prisma
model Voucher {
  llmScore        Int?      @map("llm_score")
  scoringMetadata String?   @map("scoring_metadata")  // JSON: { breakdown, feedback }
  // ...
}
```

**推荐方案1**，暂时不需要存储详细 breakdown，保持简单。

---

## 三、每日触发限制实现

### 3.1 核心逻辑

```typescript
// apps/api/src/modules/voucher/voucher.service.ts

async checkDailyTriggerLimit(uid: string): Promise<{ canTrigger: boolean; count: number }> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const count = await this.prisma.voucherPopupLog.count({
    where: {
      uid,
      popupDate: today,
    },
  });

  return {
    canTrigger: count < 3,
    count,
  };
}

async recordPopupTrigger(uid: string, templateId: string, voucherId?: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await this.prisma.voucherPopupLog.create({
    data: {
      uid,
      templateId,
      popupDate: today,
      voucherId,
      createdAt: new Date(),
    },
  });
}
```

### 3.2 完整发布触发流程

```typescript
async handleTemplatePublish(
  user: User,
  templateId: string,
  canvasId: string,
): Promise<VoucherTriggerResult | null> {
  // 1. 检查每日限制
  const { canTrigger, count } = await this.checkDailyTriggerLimit(user.uid);

  if (!canTrigger) {
    // 埋点：触发限制达到
    this.trackEvent('daily_publish_trigger_limit_reached', {
      uid: user.uid,
      currentCount: count,
    });
    return null;
  }

  // 2. 获取模板数据进行评分
  const templateData = await this.getTemplateDataForScoring(canvasId);

  // 3. LLM 评分
  const scoringResult = await this.templateScoringService.scoreTemplate(user, templateData);

  // 4. 计算折扣百分比
  const discountPercent = this.templateScoringService.scoreToDiscountPercent(scoringResult.score);

  // 5. 生成优惠券
  const voucher = await this.createVoucher({
    uid: user.uid,
    discountPercent,
    llmScore: scoringResult.score,
    source: 'template_publish',
    sourceId: templateId,
    expiresAt: addDays(new Date(), 7),
  });

  // 6. 记录弹窗触发
  await this.recordPopupTrigger(user.uid, templateId, voucher.voucherId);

  // 7. 埋点：弹窗展示
  this.trackEvent('voucher_popup_display', {
    uid: user.uid,
    voucherId: voucher.voucherId,
    discountPercent,
    llmScore: scoringResult.score,
  });

  return {
    voucher,
    score: scoringResult.score,
    feedback: scoringResult.feedback,
  };
}
```

---

## 四、优惠券生成流程

### 4.1 数据结构

```typescript
interface CreateVoucherInput {
  uid: string;
  discountPercent: number;  // 10-90
  llmScore?: number;        // 0-100
  source: 'template_publish' | 'invitation_claim';
  sourceId?: string;        // templateId 或 invitationId
  expiresAt: Date;
}
```

### 4.2 生成逻辑

```typescript
async createVoucher(input: CreateVoucherInput): Promise<Voucher> {
  const voucherId = `voucher_${nanoid(16)}`;

  const voucher = await this.prisma.voucher.create({
    data: {
      voucherId,
      uid: input.uid,
      discountPercent: input.discountPercent,
      status: 'unused',
      source: input.source,
      sourceId: input.sourceId,
      llmScore: input.llmScore,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // 发送邮件通知（异步）
  this.sendVoucherNotificationEmail(voucher).catch(err => {
    this.logger.error(`Failed to send voucher email: ${err.message}`);
  });

  return voucher;
}
```

---

## 五、前端弹窗设计

### 5.1 弹窗组件接口

```typescript
interface VoucherRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: {
    voucherId: string;
    discountPercent: number;
    expiresAt: string;
  };
  onUseNow: () => void;
  onShare: () => void;
}
```

### 5.2 弹窗内容

```
┌─────────────────────────────────────────┐
│                                         │
│         🎉 Congratulations! 🎉          │
│                                         │
│   Your template has been successfully   │
│   published to the Marketplace          │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │     [50% OFF]                   │   │
│  │                                 │   │
│  │  Your Exclusive Discount        │   │
│  │  Valid for 7 days               │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  To celebrate your great work, we're    │
│  giving you a 50% off Voucher—our way   │
│  of saying thanks for contributing.     │
│                                         │
│  ┌───────────────┐ ┌───────────────┐   │
│  │  Use It Now   │ │    Share      │   │
│  └───────────────┘ └───────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 5.3 按钮交互

#### **Use It Now 按钮**
```typescript
const handleUseNow = () => {
  // 埋点
  track('voucher_use_now_click', {
    voucherId: voucher.voucherId,
    discountPercent: voucher.discountPercent,
  });

  // 跳转到 Stripe 月付页面
  window.location.href = `/api/stripe/checkout?plan=plus_monthly&voucherId=${voucher.voucherId}`;
};
```

#### **Share 按钮**
```typescript
const handleShare = () => {
  // 埋点
  track('voucher_share_click', {
    voucherId: voucher.voucherId,
    discountPercent: voucher.discountPercent,
  });

  // 跳转到海报展示页面（阶段2实现）
  router.push(`/share/voucher/${voucher.voucherId}`);
};
```

---

## 六、API 接口设计

### 6.1 发布模板触发优惠券

**接口扩展**：在现有的模板发布接口中增加返回值

```typescript
// POST /api/workflow-apps/:appId/publish
// 或扩展现有的 publishToCommunity 流程

interface PublishResponse {
  success: boolean;
  app: WorkflowApp;
  voucher?: {
    voucherId: string;
    discountPercent: number;
    llmScore: number;
    expiresAt: string;
    feedback?: string;
  };
  triggerLimitReached?: boolean;
}
```

### 6.2 查询用户有效优惠券

```typescript
// GET /api/vouchers?status=unused

interface GetVouchersResponse {
  vouchers: Array<{
    voucherId: string;
    discountPercent: number;
    status: string;
    source: string;
    expiresAt: string;
    createdAt: string;
  }>;
}
```

---

## 七、埋点实现

### 7.1 埋点事件清单

| 事件名称 | 触发时机 | 属性 |
|---------|---------|------|
| `voucher_popup_display` | 优惠券弹窗展示时 | `user_type`, `voucher_value`, `llm_score` |
| `voucher_use_now_click` | 点击 "Use It Now" | `user_type`, `voucher_value` |
| `voucher_share_click` | 点击 "Share" | `user_type`, `voucher_value` |
| `daily_publish_trigger_limit_reached` | 当天已达3次限制 | `user_type`, `current_count` |

### 7.2 埋点实现示例

```typescript
// 后端埋点（voucher_popup_display）
this.analyticsService.track({
  event: 'voucher_popup_display',
  userId: user.uid,
  properties: {
    user_type: user.subscriptionType || 'free',
    voucher_value: voucher.discountPercent,
    llm_score: voucher.llmScore,
    voucher_id: voucher.voucherId,
  },
});

// 前端埋点（voucher_use_now_click）
analytics.track('voucher_use_now_click', {
  user_type: userType,
  voucher_value: voucher.discountPercent,
  voucher_id: voucher.voucherId,
});
```

---

## 八、文件结构

### 新增文件

```
apps/api/src/modules/voucher/
├── voucher.module.ts           # Voucher 模块定义
├── voucher.service.ts          # 优惠券核心服务
├── voucher.controller.ts       # API 控制器
├── voucher.dto.ts              # DTO 定义
├── template-scoring.service.ts # LLM 模板评分服务
├── template-scoring.prompt.ts  # 评分 Prompt 模板
└── voucher.constants.ts        # 常量定义

apps/api/src/modules/workflow-app/
├── workflow-app.service.ts     # 修改：集成优惠券触发逻辑
└── workflow-app.processor.ts   # 修改：可选的异步评分集成
```

### 前端新增文件

```
packages/ai-workspace-common/src/components/voucher/
├── VoucherRewardModal.tsx      # 优惠券奖励弹窗
├── VoucherCard.tsx             # 优惠券卡片组件
└── index.ts                    # 导出

packages/ai-workspace-common/src/hooks/
└── use-voucher.ts              # 优惠券相关 hooks
```

---

## 九、风险与缓解措施

### 9.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LLM 评分延迟过高 | 发布体验差 | 设置 10s 超时，超时使用默认分数 |
| LLM 服务不可用 | 无法生成优惠券 | 降级策略：使用默认 50 分 |
| 评分不一致 | 用户投诉 | 后期可增加人工审核机制 |
| 刷分攻击 | 成本增加 | 每日 3 次限制 + IP/设备限制 |

### 9.2 业务风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 折扣过高导致收入损失 | 财务影响 | 监控折扣使用情况，必要时调整算法 |
| 低质量模板获得高分 | 用户体验差 | 持续优化评分 Prompt，增加人工审核 |

---

## 十、测试计划

### 10.1 单元测试

```typescript
describe('TemplateScoringService', () => {
  it('should score a valid template', async () => {
    const result = await service.scoreTemplate(user, validTemplate);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('should return default score on timeout', async () => {
    // Mock LLM timeout
    const result = await service.scoreTemplate(user, validTemplate);
    expect(result.score).toBe(50);
  });

  it('should correctly convert score to discount percent', () => {
    expect(service.scoreToDiscountPercent(95)).toBe(90);
    expect(service.scoreToDiscountPercent(50)).toBe(50);
    expect(service.scoreToDiscountPercent(5)).toBe(10);
  });
});

describe('VoucherService', () => {
  it('should respect daily trigger limit', async () => {
    // Trigger 3 times
    await service.handleTemplatePublish(user, 'template1', 'canvas1');
    await service.handleTemplatePublish(user, 'template2', 'canvas2');
    await service.handleTemplatePublish(user, 'template3', 'canvas3');

    // 4th should return null
    const result = await service.handleTemplatePublish(user, 'template4', 'canvas4');
    expect(result).toBeNull();
  });

  it('should reset limit on new day', async () => {
    // Mock date change
    jest.setSystemTime(new Date('2025-12-06'));
    const result = await service.handleTemplatePublish(user, 'template1', 'canvas1');
    expect(result).not.toBeNull();
  });
});
```

### 10.2 集成测试

- 完整发布流程测试（发布 → 评分 → 生成券 → 展示弹窗）
- 降级场景测试（LLM 不可用时的行为）
- 并发测试（多次同时发布）

---

## 十一、实施计划

### Phase 1.1: 后端基础（2天）
- [ ] 创建 Voucher Module 骨架
- [ ] 实现 TemplateScoringService
- [ ] 实现 VoucherService 基础 CRUD
- [ ] 每日限制逻辑

### Phase 1.2: 集成发布流程（1天）
- [ ] 修改 WorkflowApp 发布流程
- [ ] 集成评分和优惠券生成
- [ ] 添加埋点

### Phase 1.3: 前端弹窗（1天）
- [ ] VoucherRewardModal 组件
- [ ] 集成到发布流程
- [ ] 前端埋点

### Phase 1.4: 测试与优化（1天）
- [ ] 单元测试
- [ ] 集成测试
- [ ] Prompt 调优

---

## 十二、待讨论问题

### 🤔 需要确认的设计决策

1. **评分 Prompt 语言**
   - 使用英文 Prompt？（跨语言一致性好）
   - 还是根据模板语言自动切换？

2. **默认分数选择**
   - 50 分是否合适？
   - 是否需要根据历史数据动态调整？

3. **评分详情是否存储**
   - 只存总分？
   - 还是存储 breakdown 和 feedback？

4. **邮件通知内容**
   - 是否包含折扣详情？
   - 是否包含有效期提醒？

5. **Use It Now 跳转目标**
   - 直接跳 Stripe？
   - 还是先显示购买弹窗再跳转？

---

**文档版本**: v1.0
**创建日期**: 2025-12-05
**作者**: AI Assistant
**状态**: 待评审
