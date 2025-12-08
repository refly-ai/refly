# 新增 auto 模型

## 需求

模型信息：

1. 模型名称：Auto Model（自动）
2. 模型价格：
   1. 每百万输入：80 Credits
   2. 每百万输出：400 Credits
3. Tooltips：Balanced quality and speed, recommended for most tasks.

模型位置：

1. 模型位置：模型列表的第一个
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

利用现有的 isGlobal=true 机制，创建一个特殊的系统级 Provider，并挂载一个虚拟的 Auto 模型。这样既能复用现有的列表查询 SQL，又能在后端通过拦截 modelId="auto" 来做路由逻辑。

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

-- UPDATE SQL
-- 设置 credit_billing
UPDATE provider_items 
SET 
  credit_billing = '{"unit": "1m_tokens", "inputCost": 80, "outputCost": 400, "minCharge": 1, "isEarlyBirdFree": false}',
  config = '{"modelId": "auto", "modelName": "Auto", "contextLimit": 200000, "maxOutput": 8192, "capabilities": {"vision": true}}',
  tier = 't1'
WHERE item_id = 'pi-asnj62w0h0acxi34lkfg4ijn';
```

TODO 待确认的问题：

- provider_items 的 config 字段可能带来的兼容性问题
    - 无法上传图片：前端通过检查 config.capabilities.vision 来决定是否显示上传图片按钮。如果 config 里没存，默认为 false，Auto 模型就无法发图了（虽然背后的 Sonnet 4.5 支持）。
    - Context 长度误报：前端会读取 config.contextLimit 做上下文长度检查。如果没存，默认为 0，可能会导致前端提示“Token 超限”或显示“Limit: 0”。
- provider_items 的 tier, group_name 字段
