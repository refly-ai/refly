# Node Edit Context 功能实现文档

> 节点编辑上下文功能 - 允许用户选中 Canvas 节点后，通过 Copilot 进行精确的修改或扩展操作

## 1. 功能概述

### 1.1 需求背景

在 Copilot 生成 Workflow 后，用户需要对单个节点进行微调或在其基础上扩展。传统方式需要重新描述整个流程，效率低下。

### 1.2 解决方案

引入 **Node Edit Context** 机制：
- 用户选中节点时，自动捕获节点上下文
- 将上下文注入 Agent Prompt，使 Agent 能够精确定位并修改目标节点
- 使用 `patch_workflow` 工具进行增量更新，而非全量替换

### 1.3 核心能力

| 模式 | 操作 | 说明 |
|------|------|------|
| **修改 (Modify)** | `updateTask` | 修改选中节点的属性（prompt、toolsets 等）|
| **扩展 (Extend)** | `createTask` | 在选中节点后创建新节点，自动建立依赖关系 |

---

## 2. 架构设计

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌─────────────────┐    ┌────────────────┐  │
│  │   Canvas     │───▶│useNodeEditContext│───▶│ CopilotStore   │  │
│  │ (节点选中)    │    │   (Hook)        │    │ nodeEditContext│  │
│  └──────────────┘    └─────────────────┘    └───────┬────────┘  │
│                                                      │           │
│  ┌──────────────┐    ┌─────────────────┐            │           │
│  │NodeEditBanner│◀───│ useCopilotStore │◀───────────┘           │
│  │  (UI 展示)   │    │   (订阅状态)     │                        │
│  └──────────────┘    └─────────────────┘                        │
│                                                                  │
│  ┌──────────────┐    ┌─────────────────┐                        │
│  │   ChatBox    │───▶│ useInvokeAction │──┐                     │
│  │  (发送消息)   │    │  (携带 context) │  │                     │
│  └──────────────┘    └─────────────────┘  │                     │
│                                            │                     │
├────────────────────────────────────────────┼─────────────────────┤
│                        API                 │                     │
├────────────────────────────────────────────┼─────────────────────┤
│                                            ▼                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              SkillInvokerService                          │   │
│  │  config.configurable.nodeEditContext = data.nodeEditContext│   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Agent (Copilot)                        │   │
│  │  buildWorkflowCopilotPrompt({ nodeEditContext })          │   │
│  │  → 注入 Targeted Node Editing 指令到 System Prompt        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  patch_workflow Tool                      │   │
│  │  { op: "updateTask", taskId: "xxx", data: {...} }        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                        Frontend (结果处理)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   CopilotMessage                          │   │
│  │  isPatchOperation ? applyIncrementalChangesToCanvas()     │   │
│  │                   : generateCanvasDataFromWorkflowPlan()  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户选中节点
    │
    ▼
useNodeEditContext 检测选中
    │
    ├─── 非 skillResponse 节点 ───▶ 不处理
    │
    ├─── 无 taskId ───▶ 不处理 (非 workflow 生成的节点)
    │
    ▼
构建 NodeEditContext
    │
    ├── nodeId: ReactFlow 节点 ID
    ├── entityId: 实体 ID (用于 mention 引用)
    ├── taskId: Workflow Plan 中的任务 ID
    ├── currentState: { query, toolsets, title }
    ├── graphContext: { upstreamTaskIds, downstreamTaskIds }
    └── editMode: 'modify' | 'extend'
    │
    ▼
存入 CopilotStore.nodeEditContext[canvasId]
    │
    ▼
NodeEditBanner 展示 ◀─── 用户切换 editMode
    │
    ▼
用户发送消息 (ChatBox)
    │
    ▼
useInvokeAction 携带 nodeEditContext 调用 API
    │
    ▼
Agent 根据 context 生成 patch_workflow 调用
    │
    ▼
CopilotMessage 应用增量更新到 Canvas
```

---

## 3. 核心实现

### 3.1 文件变更清单

| 包 | 文件 | 职责 |
|----|------|------|
| **openapi-schema** | `schema.yml` | 定义 `NodeEditContext`、`WorkflowPatchOperation` 类型 |
| **stores** | `copilot.ts` | 存储 `nodeEditContext` 状态 |
| **ai-workspace-common** | `use-node-edit-context.ts` | 监听节点选中，构建 context |
| **ai-workspace-common** | `node-edit-banner.tsx` | 展示编辑状态 UI |
| **ai-workspace-common** | `chat-box.tsx` | 发送时携带 context |
| **ai-workspace-common** | `copilot-message.tsx` | 区分 patch/generate，应用增量更新 |
| **ai-workspace-common** | `use-invoke-action.ts` | API 调用携带 context |
| **canvas-common** | `workflow-plan.ts` | `applyIncrementalChangesToCanvas` 增量更新函数 |
| **canvas-common** | `types.ts` | `SkillNodeMeta` 新增 `taskId` 字段 |
| **skill-template** | `copilot-agent.ts` | 构建包含 context 的 Prompt |
| **skill-template** | `agent.ts` | 传递 context 到 prompt builder |
| **api** | `skill-invoker.service.ts` | 透传 `nodeEditContext` 到 configurable |
| **api** | `workflow-plan.service.ts` | 返回 `patchOperations` 供前端增量应用 |
| **i18n** | `en-US/ui.ts`, `zh-Hans/ui.ts` | 国际化文案 |

### 3.2 类型定义

#### NodeEditContext (openapi-schema)

```yaml
NodeEditContext:
  type: object
  required:
    - nodeId
    - entityId
    - taskId
    - nodeType
    - editMode
  properties:
    nodeId:
      type: string
      description: The internal node ID from ReactFlow
    entityId:
      type: string
      description: The entity ID used for referencing in workflows
    taskId:
      type: string
      description: The task ID from workflow plan, used for patch operations
    nodeType:
      $ref: '#/components/schemas/CanvasNodeType'
    currentState:
      type: object
      properties:
        query:
          type: string
        toolsets:
          type: array
          items:
            type: string
        title:
          type: string
    graphContext:
      type: object
      properties:
        upstreamTaskIds:
          type: array
          items:
            type: string
        downstreamTaskIds:
          type: array
          items:
            type: string
    editMode:
      type: string
      enum:
        - modify
        - extend
```

#### WorkflowPatchOperation (openapi-schema)

```yaml
WorkflowPatchOperation:
  type: object
  required:
    - op
  properties:
    op:
      $ref: '#/components/schemas/WorkflowPatchOp'  # updateTitle|createTask|updateTask|deleteTask|...
    taskId:
      type: string
    task:
      $ref: '#/components/schemas/WorkflowTask'
    data:
      $ref: '#/components/schemas/WorkflowPatchData'
    # ... 其他字段
```

---

## 4. 关键代码解析

### 4.1 节点选中检测 (use-node-edit-context.ts)

```typescript
export const useNodeEditContext = () => {
  const { canvasId } = useCanvasContext();
  const { getNodes, getEdges } = useReactFlow<CanvasNode<SkillNodeMeta>>();
  const { setNodeEditContext } = useCopilotStoreShallow((state) => ({
    setNodeEditContext: state.setNodeEditContext,
  }));

  // 监听 ReactFlow 内部选中状态
  const selectedNodes = useStore(
    useShallow((state) => state.nodes.filter((node) => node.selected)),
  );

  // 使用 ref 追踪上一次的 context key，避免无限循环
  const prevContextKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // 仅处理单选
    if (selectedNodes.length !== 1) {
      if (prevContextKeyRef.current !== null) {
        setNodeEditContext(canvasId, null);
        prevContextKeyRef.current = null;
      }
      return;
    }

    const selectedNode = selectedNodes[0] as CanvasNode<SkillNodeMeta>;

    // 仅处理 skillResponse 节点
    if (selectedNode.type !== 'skillResponse') {
      // ... 清理逻辑
      return;
    }

    const metadata = selectedNode.data?.metadata;
    const taskId = metadata?.taskId;

    // 构建稳定的 key 检测变化
    const toolsetIds = metadata?.selectedToolsets?.map((t) => t.id)?.sort()?.join(',') ?? '';
    const contextKey = `${selectedNode.id}|${taskId ?? ''}|${metadata?.query ?? ''}|${toolsetIds}|${selectedNode.data?.title ?? ''}`;

    if (prevContextKeyRef.current === contextKey) {
      return; // 无变化，跳过
    }
    prevContextKeyRef.current = contextKey;

    // 无 taskId 说明不是 workflow 生成的节点
    if (!taskId) {
      setNodeEditContext(canvasId, null);
      return;
    }

    // 构建图上下文（上下游依赖）
    const edges = getEdges();
    const allNodes = getNodes();

    const upstreamTaskIds = edges
      .filter((edge) => edge.target === selectedNode.id)
      .map((edge) => /* 提取 sourceNode 的 taskId */)
      .filter(Boolean);

    const downstreamTaskIds = edges
      .filter((edge) => edge.source === selectedNode.id)
      .map((edge) => /* 提取 targetNode 的 taskId */)
      .filter(Boolean);

    // 构建并存储 context
    const context: NodeEditContext = {
      nodeId: selectedNode.id,
      entityId: selectedNode.data?.entityId ?? '',
      taskId,
      nodeType: selectedNode.type,
      currentState: {
        query: metadata?.query,
        toolsets: metadata?.selectedToolsets?.map((t) => t.id),
        title: selectedNode.data?.title,
      },
      graphContext: { upstreamTaskIds, downstreamTaskIds },
      editMode: 'modify', // 默认修改模式
    };

    setNodeEditContext(canvasId, context);
  }, [selectedNodes, canvasId, getNodes, getEdges, setNodeEditContext]);
};
```

**设计要点**:
1. 使用 `useRef` 追踪上一次 key，避免将 `nodeEditContext` 放入依赖数组导致循环
2. 构建稳定的 `contextKey`，排序 toolsetIds 保证顺序无关
3. 仅处理有 `taskId` 的节点（workflow 生成的节点才支持增量编辑）

### 4.2 Agent Prompt 注入 (copilot-agent.ts)

```typescript
export const buildWorkflowCopilotPrompt = (params: {
  installedToolsets: GenericToolset[];
  nodeEditContext?: NodeEditContext;
}) => {
  let nodeEditContextSection = '';

  if (params.nodeEditContext) {
    nodeEditContextSection = `
## Targeted Node Editing Mode

**ACTIVE**: User has selected a specific node for editing.

### Selected Node Context
\`\`\`json
${JSON.stringify(params.nodeEditContext, null, 2)}
\`\`\`

### Editing Rules

| Edit Mode | Tool | Operation | Key Points |
|-----------|------|-----------|------------|
| **modify** | \`patch_workflow\` | \`updateTask\` | Update taskId: "${params.nodeEditContext.taskId}" |
| **extend** | \`patch_workflow\` | \`createTask\` | Create with dependentTasks: ["${params.nodeEditContext.taskId}"] |

### Current Mode: **${params.nodeEditContext.editMode}**

${params.nodeEditContext.editMode === 'modify' ? `
**Modify Mode Instructions**:
- Target task ID: \`${params.nodeEditContext.taskId}\`
- Use \`updateTask\` operation
- Preserve fields user didn't ask to change
` : `
**Extend Mode Instructions**:
- Create new task depending on: \`${params.nodeEditContext.taskId}\`
- Reference selected task output using mention syntax
`}
`;
  }

  return template.render({
    availableToolsJson,
    nodeEditContextSection,  // 注入到模板
  });
};
```

**设计要点**:
1. 根据 `editMode` 动态生成不同的指令
2. 提供具体的 JSON 示例帮助 Agent 理解
3. 明确告知 taskId，避免 Agent 猜测

### 4.3 增量更新应用 (workflow-plan.ts)

```typescript
export const applyIncrementalChangesToCanvas = (
  operations: WorkflowPatchOperation[],
  currentNodes: CanvasNode[],
  currentEdges: RawCanvasData['edges'],
  toolsets: GenericToolset[],
  options?: { defaultModel?: ModelInfo },
): IncrementalChangesResult => {

  // 建立 taskId → node 映射
  const taskIdToNode = new Map<string, CanvasNode>();
  const taskIdToNodeId = new Map<string, string>();

  for (const node of currentNodes) {
    const taskId = node.data?.metadata?.taskId;
    if (taskId) {
      taskIdToNode.set(taskId, node);
      taskIdToNodeId.set(taskId, node.id);
    }
  }

  let nodes = [...currentNodes];
  let edges = [...currentEdges];
  const affectedNodeIds: string[] = [];

  for (const operation of operations) {
    switch (operation.op) {
      case 'updateTask': {
        const node = taskIdToNode.get(operation.taskId);
        if (!node) break;

        // 深拷贝避免直接修改
        const updatedNode = structuredClone(node);

        // 应用更新
        if (operation.data?.title) {
          updatedNode.data.title = operation.data.title;
        }
        if (operation.data?.prompt) {
          updatedNode.data.metadata.query = operation.data.prompt;
        }
        // ... 其他字段更新

        // 替换节点
        nodes = nodes.map((n) => (n.id === node.id ? updatedNode : n));
        affectedNodeIds.push(node.id);
        break;
      }

      case 'createTask': {
        // 创建新节点，设置依赖边
        const newNode = /* 构建新节点 */;
        nodes.push(newNode);

        // 创建边连接到依赖节点
        for (const depTaskId of operation.task.dependentTasks) {
          const sourceNodeId = taskIdToNodeId.get(depTaskId);
          if (sourceNodeId) {
            edges.push({
              id: `edge-${genUniqueId()}`,
              source: sourceNodeId,
              target: newNode.id,
            });
          }
        }
        affectedNodeIds.push(newNode.id);
        break;
      }

      case 'deleteTask': {
        // 删除节点和相关边
        nodes = nodes.filter((n) => n.id !== taskIdToNodeId.get(operation.taskId));
        edges = edges.filter((e) =>
          e.source !== taskIdToNodeId.get(operation.taskId) &&
          e.target !== taskIdToNodeId.get(operation.taskId)
        );
        break;
      }
    }
  }

  return { nodes, edges, affectedNodeIds, variableOperations: [] };
};
```

**设计要点**:
1. 使用 `taskId` 作为映射键，实现 workflow plan 到 canvas node 的双向映射
2. 使用 `structuredClone` 进行深拷贝，避免直接修改原对象
3. 返回 `affectedNodeIds` 供日志/追踪使用

### 4.4 前端结果处理 (copilot-message.tsx)

```typescript
// 检测是否为 patch 操作
const isPatchOperation = useMemo(() => {
  const allToolCalls = steps?.flatMap((step) => step.toolCalls ?? []) ?? [];
  const workflowPlanToolCall = [...allToolCalls]
    .reverse()  // 从后往前找最近的调用
    .find((call) =>
      call.toolName === 'generate_workflow' ||
      call.toolName === 'patch_workflow'
    );
  return workflowPlanToolCall?.toolName === 'patch_workflow';
}, [steps]);

// 应用结果
const handleApply = async () => {
  if (isPatchOperation && finalPlan.patchOperations?.length) {
    // 增量更新
    const { nodes, edges, affectedNodeIds } = applyIncrementalChangesToCanvas(
      finalPlan.patchOperations,
      currentNodes,
      currentEdges,
      tools?.data ?? [],
      { defaultModel: defaultAgentModel },
    );
    setNodes(nodes);
    setEdges(edges);
  } else {
    // 全量替换
    const { nodes, edges, variables } = generateCanvasDataFromWorkflowPlan(
      finalPlan,
      tools?.data ?? [],
      { autoLayout: true, defaultModel: defaultAgentModel },
    );
    setNodes(nodes);
    setEdges(edges);
    setVariables(variables ?? []);
  }
};
```

**设计要点**:
1. 通过检测 `toolCalls` 判断是 patch 还是 generate
2. patch 操作使用 `applyIncrementalChangesToCanvas` 保留未修改节点
3. generate 操作使用 `generateCanvasDataFromWorkflowPlan` 全量替换

---

## 5. 关键设计决策

### 5.1 为什么使用 taskId 而非 nodeId？

| 方案 | 优点 | 缺点 |
|------|------|------|
| **nodeId** | 直接使用 ReactFlow ID | 每次重新生成会变化，无法持久化 |
| **taskId** ✓ | 与 workflow plan 一致，稳定 | 需要在生成时写入 metadata |

**结论**: 使用 `taskId` 作为映射键，在 `generateCanvasDataFromWorkflowPlan` 时将 taskId 写入 `node.data.metadata.taskId`。

### 5.2 为什么区分 modify/extend 模式？

| 模式 | 操作 | 场景 |
|------|------|------|
| **modify** | `updateTask` | "把这个节点改成用 Perplexity" |
| **extend** | `createTask` | "在这个节点后面加一个翻译步骤" |

通过明确的模式区分，降低 Agent 理解歧义，提高操作准确性。

### 5.3 为什么返回 patchOperations？

```typescript
// WorkflowPlanRecord 新增字段
patchOperations?: Array<WorkflowPatchOperation>;
```

API 返回原始的 patch 操作，而非应用后的结果，原因：
1. 前端可以直接使用 `applyIncrementalChangesToCanvas` 增量应用
2. 保留操作历史，便于 undo/redo
3. 避免服务端与前端 canvas 状态不一致

---

## 6. 测试验证

### 6.1 单元测试建议

```typescript
describe('applyIncrementalChangesToCanvas', () => {
  it('should update task title without affecting other nodes', () => {
    const operations = [{
      op: 'updateTask',
      taskId: 'task-1',
      data: { title: 'New Title' }
    }];
    const result = applyIncrementalChangesToCanvas(operations, nodes, edges, toolsets);

    expect(result.affectedNodeIds).toEqual(['node-1']);
    expect(result.nodes.find(n => n.id === 'node-1').data.title).toBe('New Title');
    expect(result.nodes.find(n => n.id === 'node-2').data.title).toBe('Original Title');
  });

  it('should create new task with correct dependencies', () => {
    const operations = [{
      op: 'createTask',
      task: {
        id: 'task-new',
        title: 'New Task',
        dependentTasks: ['task-1'],
        toolsets: []
      }
    }];
    const result = applyIncrementalChangesToCanvas(operations, nodes, edges, toolsets);

    expect(result.nodes.length).toBe(originalLength + 1);
    expect(result.edges.some(e => e.source === 'node-1' && e.target === result.affectedNodeIds[0])).toBe(true);
  });
});
```

### 6.2 E2E 测试场景

```gherkin
Feature: Node Edit Context

  Scenario: Modify selected node
    Given 用户已通过 Copilot 生成包含搜索节点的 workflow
    When 用户选中搜索节点
    Then Copilot 面板显示 "编辑节点" Banner
    And 默认选中 "修改" 模式
    When 用户输入 "把工具改成 Perplexity"
    And 点击发送
    Then Agent 调用 patch_workflow 的 updateTask 操作
    When 用户点击应用
    Then 搜索节点的 toolsets 更新为 perplexity
    And 其他节点保持不变

  Scenario: Extend from selected node
    Given 用户已选中一个 Agent 节点
    When 用户点击 "扩展" 按钮
    And 输入 "在后面加一个翻译步骤"
    And 点击发送
    Then Agent 调用 patch_workflow 的 createTask 操作
    And 新任务的 dependentTasks 包含选中节点的 taskId
    When 用户点击应用
    Then 画布新增一个翻译节点
    And 新节点连线到选中节点
```

---

## 7. 总结

### 7.1 技术亮点

1. **增量更新架构** - 通过 `taskId` 映射实现精确定位，避免全量替换
2. **双模式设计** - modify/extend 清晰区分操作意图
3. **Prompt 工程** - 动态注入 context，提供具体示例引导 Agent
4. **状态隔离** - 按 canvasId 隔离状态，支持多画布场景

### 7.2 扩展方向

- [ ] 支持多节点批量编辑
- [ ] 支持变量节点的编辑
- [ ] 操作历史记录与 undo/redo
- [ ] 编辑冲突检测与解决

---

*文档生成时间: 2025-01-23*
