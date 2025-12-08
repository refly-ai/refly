# 新增 auto 模型

## 需求

模型信息：

1. 模型名称：Auto
2. 模型价格：
   1. 每百万输入：80 Credits
   2. 每百万输出：400 Credits
3. Tooltip: 'Smart Routing'

模型位置：

1. 模型位置：模型列表的第一个 TODO
2. 新增的 Agent 节点，默认选中 Auto Model
3. copilot 生成的 Agent 节点，默认选中 Auto Model

背后实际的模型：Claude Sonnet 4.5

模型列表中新增一个 auto 模型，背后可以自动做模型路由。不过目前背后只有 Sonnet 4.5。

- Agent node 的模型默认 auto
- Copilot生成的 Workflow，Agent node 的模型默认 auto

## 现状调研

### 模型列表

前端获取模型列表：

https://api.refly.ai/v1/provider/item/list?isGlobal=true&category=llm&enabled=true

后端从 provider_items 和 providers 表中查询。

等价 SQL：

```sql
SELECT 
    pi.item_id,
    pi.name AS model_name,
    pi.category,
    p.provider_key,
    pi.config,
    pi."order"
FROM provider_items pi
JOIN providers p ON pi.provider_id = p.provider_id
WHERE 
    -- 1. 对应 URL: isGlobal=true
    p.is_global = true 
    
    -- 2. 对应 URL: category=llm
    AND pi.category = 'llm'
    
    -- 3. 对应 URL: enabled=true (同时也检查 provider 是否启用)
    AND pi.enabled = true
    AND p.enabled = true
    
    -- 4. 对应代码中的 deletedAt: null
    AND pi.deleted_at IS NULL
    AND p.deleted_at IS NULL
    
    -- 5. 对应代码隐含逻辑：全局 Item 通常不属于特定用户
    AND pi.uid IS NULL
ORDER BY pi."order" ASC;
```

## 设计

### 模型列表

利用现有的 provider 机制，创建一个特殊的系统级 Provider，并挂载一个虚拟的 Auto 模型。

这样的好处：

- 复用现有的模型查询 SQL
- 配置模型的 tooltip, credit_billing 等信息
TODO 确认计费逻辑是否正确

```sql
-- 全量 SQL
INSERT INTO providers (pk, provider_id, provider_key, name, is_global, categories, enabled, created_at, updated_at)
VALUES (
  40,
  'pr-system',
  'system', 
  'System', 
  true, 
  'llm', 
  true, 
  NOW(), 
  NOW()
);

INSERT INTO provider_items (pk, provider_id, item_id, category, name, group_name, "order", enabled, config, tier, credit_billing, created_at, updated_at)
VALUES (
  118,
  'pr-system',
  'pi-asnj62w0h0acxi34lkfg4ijn',
  'llm',
  'Auto',
  'System',
  0,
  true,
  '{"modelId": "auto", "modelName": "Auto", "contextLimit": 200000, "maxOutput": 8192, "capabilities": {"vision": true}}',
  't1',
  '{"unit": "1m_tokens", "inputCost": 80, "outputCost": 400, "minCharge": 1, "isEarlyBirdFree": false}',
  NOW(),
  NOW()
);
```


TODO 待确认的问题：

- provider_items 的 config 字段可能带来的兼容性问题
    - 无法上传图片：前端通过检查 config.capabilities.vision 来决定是否显示上传图片按钮。如果 config 里没存，默认为 false，Auto 模型就无法发图了（虽然背后的 Sonnet 4.5 支持）。
    - Context 长度误报：前端会读取 config.contextLimit 做上下文长度检查。如果没存，默认为 0，可能会导致前端提示“Token 超限”或显示“Limit: 0”。
- provider_items 的 tier, group_name 字段

## 模型路由

### 目标

本次改造的核心目标有三个：

1. 对于用户来说，看到的模型名称永远是 Auto，不感知背后的实际模型
2.  **统一拦截**：确保无论是 Copilot、Agent Node 还是普通对话，所有针对 "Auto" 模型的调用都能被系统捕获并处理，无遗漏。
3.  **动态路由**：实现智能的模型分发策略，虽然此次是直接路由到 Sonnet 4.5，但未来可能根据各种情况（agent 复杂性、任务类型）等进行路由，这些信息能否顺利获取到
4.  **监控区分**：在 Langfuse 监控中，必须能清晰区分出哪些请求是用户直接调用的，哪些是经由 Auto 路由过来的，以便分析 Auto 模型的效果和使用率。

### 方案对比

为了实现 Auto 模型的动态路由和监控区分，我们评估了两种不同的拦截方案。

#### 方案一：决策层拦截 (ProviderService)

在业务逻辑层（`ProviderService.prepareModelProviderMap`）进行拦截。这是 Copilot 和 Agent Node 获取模型配置的必经之路。

*   **实现方式**：
    1.  检测 `modelItemId` 是否指向 Auto 模型。
    2.  利用 `Service` 层的数据库权限，查询最佳可用模型（如 Claude 3.5 Sonnet）。
    3.  返回真实模型的配置，并在 Config 中注入 `{ _routedFrom: 'auto' }` 标记。
*   **优点**：
    *   **路由能力强**：拥有完整的数据库访问权限和用户上下文，可实现复杂的路由策略（如基于用户等级、负载均衡）。
    *   **架构清晰**：业务逻辑收敛在 Service 层，不污染底层工具函数。
*   **缺点**：
    *   **监控需手动透传**：需要在 Config 中显式注入元数据，并在底层手动提取，否则监控系统会丢失 "Auto" 上下文。

#### 方案二：执行层拦截 (getChatModel)

在底层工厂函数（`packages/providers/src/llm/index.ts`）进行拦截。这是所有 LLM 实例化的最终入口。

*   **实现方式**：
    1.  让 Auto 配置一路透传至 `getChatModel`。
    2.  在函数内部判断 `config.modelId === 'auto'`。
    3.  硬编码映射关系（如 Auto -> Claude），实例化真实模型对象。
*   **优点**：
    *   **监控天然支持**：配置对象本身保持为 Auto，Langfuse 可自动捕获，无需额外处理。
*   **缺点**：
    *   **路由能力极弱**：`getChatModel` 是纯函数，无法查库，无法感知系统状态，难以实现动态路由。
    *   **代码耦合**：将业务路由逻辑写入底层工具库，违反分层原则。

### 最终推荐方案

**采用方案一（决策层拦截）的改进版**。

通过“**决策层路由 + 元数据透传**”的方式，结合两者的优点：

1.  **统一拦截点**：`ProviderService.prepareModelProviderMap`。
2.  **路由逻辑**：在此处查库，计算出最佳模型（Target Model）。
3.  **监控区分**：在返回的 Target Model 配置中，显式注入元数据 `__metadata: { routed_from: 'auto' }`。
4.  **底层适配**：修改 `getChatModel`，使其能识别并消费 `__metadata`，将其写入 LangChain 对象的 `metadata` 字段。

这种方案既保证了路由的灵活性（能查库），又保证了监控的准确性（有标记）。

### 详细设计 (方案一改进版)

#### 1. 拦截与路由 (`ProviderService.ts`)

```typescript
async prepareModelProviderMap(user: User, modelItemId: string) {
  // 1. 识别 Auto 模型
  if (this.isAutoModel(modelItemId)) {
     // 2. 路由决策：查找最佳真实模型
     const realItem = await this.findBestAvailableModel(user);
     
     // 3. 注入元数据
     const routedConfig = {
       ...safeParseJSON(realItem.config),
       __metadata: {
         routed_from: 'auto',
         original_model_id: 'auto'
       }
     };
     
     // 4. 返回带有标记的真实模型配置
     return { 
       chat: { ...realItem, config: JSON.stringify(routedConfig) }, 
       // ... 
     };
  }
  // ... 原有逻辑
}
```

#### 2. 底层适配 (`llm/index.ts`)

```typescript
export const getChatModel = (provider, config, ...) => {
  const model = new ChatOpenAI({
    // ... 标准参数 ...
    
    // 5. 消费元数据，上报监控
    metadata: config.__metadata,
    tags: config.__metadata?.routed_from ? [config.__metadata.routed_from] : []
  });
  return model;
}
```

### 展示层修改（已实现）

#### 问题描述

运行完 Auto 模型路由后，前端展示的模型会变为实际的模型（如 Claude Sonnet 4.5）。预期应该是一直展示 Auto。

#### 解决方案

**核心思路**：`param.modelItemId` 在整个流程中**保持不变**（始终是 Auto），只有 `providerItem` 被路由为真实模型。

**关键洞察**：
- `prepareModelProviderMap` 内部完成路由，但**不修改** `param.modelItemId`
- `param.modelItemId` 始终保持为 Auto（用于展示）
- `providerItem` 是路由后的真实模型（用于执行、监控、计费）

#### 实现细节

**1. 路由逻辑** (`provider.service.ts` - `prepareModelProviderMap`)

```typescript
// Input: param.modelItemId = Auto itemId
const modelProviderMap = await this.providerService.prepareModelProviderMap(
  user,
  param.modelItemId,  // Auto itemId
);

// Output: 
// - modelProviderMap.chat = 路由后的真实模型
// - param.modelItemId 保持不变（仍然是 Auto）
```

**2. ActionResult 使用 param.modelItemId** (`skill.service.ts` - `skillInvokePreCheck`)

```typescript
// 创建 ActionResult 时
await this.prisma.actionResult.create({
  data: {
    modelName: modelConfigMap.chat.modelId,  // 真实模型 ID，用于监控计费
    providerItemId: param.modelItemId,        // Auto itemId，用于前端展示
    // ...
  },
});
```

**3. 失败场景一致** (`skill.service.ts` - `createFailedActionResult`)

```typescript
// 失败场景也使用 param.modelItemId，保持一致
await this.prisma.actionResult.create({
  data: {
    providerItemId: param.modelItemId,  // Auto itemId
    // ...
  },
});
```

#### 关键设计决策

| 字段 | 值 | 用途 |
|------|------|------|
| `param.modelItemId` | Auto itemId | **保持不变**，用于展示和重放 |
| `ActionResult.providerItemId` | Auto itemId | 前端展示，重放时使用 |
| `ActionResult.modelName` | `claude-3-5-sonnet-20241022` | 监控、计费、技术追踪 |
| `InvokeSkillJobData.providerItem` | 路由后的真实模型 | 执行时使用 |
| `LLMModelConfig.routeData` | `{ originalItemId, originalModelId }` | Langfuse 监控标记 |

#### 数据流

```
用户选择 Auto
  ↓
param.modelItemId = Auto itemId
  ↓
prepareModelProviderMap(param.modelItemId) 
  内部路由，返回真实模型
  param.modelItemId 保持不变 ← 关键！
  ↓
providerItem = Claude Sonnet 4.5 (执行用)
param.modelItemId = Auto itemId (展示用)
  ↓
创建 ActionResult:
  - providerItemId = param.modelItemId (Auto itemId)
  - modelName = providerItem.config.modelId (真实模型)
  ↓
前端读取 providerItemId → 显示 Auto ✓
Langfuse 读取 modelName + routeData → 追踪真实模型 + Auto 标签 ✓
```

#### 优势

1. **更简洁**：不需要额外字段保存原始 ID
2. **逻辑清晰**：`param.modelItemId` = 用户选择（展示用），`providerItem` = 系统路由（执行用）
3. **一致性好**：成功和失败场景都用 `param.modelItemId`，代码统一
