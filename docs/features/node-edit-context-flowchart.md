# Node Edit Context 实现流程图

## 1. 整体架构流程

```mermaid
flowchart TB
    subgraph User["用户交互"]
        A[("用户在 Canvas 上<br/>点击节点")]
        B["选择编辑模式<br/>(修改/扩展)"]
        C["在 ChatBox<br/>输入指令"]
        D["点击应用<br/>按钮"]
    end

    subgraph Frontend["前端处理"]
        subgraph Detection["选中检测"]
            E["useNodeEditContext<br/>Hook 触发"]
            F{"节点类型<br/>检查"}
            G{"taskId<br/>存在?"}
            H["构建<br/>NodeEditContext"]
        end

        subgraph Store["状态管理"]
            I["CopilotStore<br/>nodeEditContext"]
            J["NodeEditBanner<br/>UI 渲染"]
        end

        subgraph Invoke["请求发送"]
            K["ChatBox<br/>获取 context"]
            L["useInvokeAction<br/>构建请求"]
        end

        subgraph Apply["结果应用"]
            M{"isPatch<br/>Operation?"}
            N["applyIncremental<br/>ChangesToCanvas"]
            O["generateCanvasData<br/>FromWorkflowPlan"]
            P["更新 Canvas<br/>nodes/edges"]
        end
    end

    subgraph Backend["后端处理"]
        Q["SkillInvokerService<br/>接收请求"]
        R["config.configurable<br/>.nodeEditContext"]
        S["Agent 初始化"]
    end

    subgraph Agent["Agent 处理"]
        T["buildWorkflowCopilotPrompt<br/>注入 context"]
        U["System Prompt<br/>包含编辑指令"]
        V["Agent 理解<br/>用户意图"]
        W{"editMode?"}
        X["patch_workflow<br/>updateTask"]
        Y["patch_workflow<br/>createTask"]
    end

    subgraph API["API 响应"]
        Z["WorkflowPlanService<br/>保存操作"]
        AA["返回<br/>patchOperations"]
    end

    %% 连接线
    A --> E
    E --> F
    F -->|skillResponse| G
    F -->|其他类型| F1["不处理"]
    G -->|是| H
    G -->|否| G1["不处理"]
    H --> I
    I --> J
    J --> B
    B --> I

    C --> K
    K --> L
    I -.->|携带 context| L
    L --> Q
    Q --> R
    R --> S
    S --> T
    T --> U
    U --> V
    V --> W
    W -->|modify| X
    W -->|extend| Y
    X --> Z
    Y --> Z
    Z --> AA
    AA --> M
    M -->|是| N
    M -->|否| O
    N --> P
    O --> P
    D --> P

    %% 样式
    classDef userAction fill:#e1f5fe,stroke:#01579b
    classDef frontend fill:#f3e5f5,stroke:#4a148c
    classDef backend fill:#fff3e0,stroke:#e65100
    classDef agent fill:#e8f5e9,stroke:#1b5e20
    classDef decision fill:#fff9c4,stroke:#f57f17

    class A,B,C,D userAction
    class E,F,G,H,I,J,K,L,M,N,O,P frontend
    class Q,R,S,Z,AA backend
    class T,U,V,W,X,Y agent
    class F,G,M,W decision
```

---

## 2. 详细时序图

```mermaid
sequenceDiagram
    autonumber
    participant User as 用户
    participant Canvas as Canvas 画布
    participant Hook as useNodeEditContext
    participant Store as CopilotStore
    participant Banner as NodeEditBanner
    participant ChatBox as ChatBox
    participant API as SkillInvokerService
    participant Agent as Copilot Agent
    participant Tool as patch_workflow
    participant Service as WorkflowPlanService
    participant Message as CopilotMessage

    Note over User,Message: 阶段一：节点选中与上下文构建

    User->>Canvas: 点击 skillResponse 节点
    Canvas->>Hook: 触发 selectedNodes 变化
    Hook->>Hook: 检查节点类型
    Hook->>Hook: 检查 taskId 存在
    Hook->>Hook: 构建 NodeEditContext
    Note right of Hook: {<br/>  nodeId, entityId,<br/>  taskId, nodeType,<br/>  currentState,<br/>  graphContext,<br/>  editMode: 'modify'<br/>}
    Hook->>Store: setNodeEditContext(canvasId, context)
    Store->>Banner: 触发重新渲染
    Banner->>User: 显示编辑状态 Banner

    Note over User,Message: 阶段二：用户选择编辑模式

    User->>Banner: 点击 "扩展" 按钮
    Banner->>Store: setNodeEditMode(canvasId, 'extend')
    Store->>Banner: 更新 UI 高亮

    Note over User,Message: 阶段三：发送编辑请求

    User->>ChatBox: 输入 "在后面加一个翻译步骤"
    User->>ChatBox: 点击发送
    ChatBox->>Store: 获取 nodeEditContext
    ChatBox->>API: invokeSkill({ ..., nodeEditContext })

    Note over User,Message: 阶段四：后端处理与 Agent 执行

    API->>API: config.configurable.nodeEditContext = data.nodeEditContext
    API->>Agent: 初始化 Agent
    Agent->>Agent: buildWorkflowCopilotPrompt({ nodeEditContext })
    Note right of Agent: System Prompt 注入:<br/>- Targeted Node Editing Mode<br/>- editMode: extend<br/>- taskId 信息<br/>- 操作示例

    Agent->>Agent: 理解用户意图
    Agent->>Tool: 调用 patch_workflow
    Note right of Tool: {<br/>  operations: [{<br/>    op: "createTask",<br/>    task: {<br/>      id: "task-new",<br/>      dependentTasks: ["task-xxx"],<br/>      ...<br/>    }<br/>  }]<br/>}
    Tool->>Service: patchWorkflowPlan(operations)
    Service->>Service: 应用 patch 操作
    Service->>Service: 保存 patchOperations
    Service-->>Agent: 返回 WorkflowPlanRecord
    Agent-->>API: 流式返回结果
    API-->>Message: SSE 事件流

    Note over User,Message: 阶段五：前端应用更新

    Message->>Message: 解析 steps, 检测 toolCalls
    Message->>Message: isPatchOperation = true
    User->>Message: 点击 "应用" 按钮
    Message->>Service: getWorkflowPlanDetail(planId)
    Service-->>Message: 返回 { patchOperations: [...] }
    Message->>Message: applyIncrementalChangesToCanvas()
    Note right of Message: - 根据 taskId 映射节点<br/>- 创建新节点<br/>- 建立依赖边<br/>- 保留未修改节点
    Message->>Canvas: setNodes(updatedNodes)
    Message->>Canvas: setEdges(updatedEdges)
    Canvas->>User: 显示更新后的画布
```

---

## 3. 状态流转图

```mermaid
stateDiagram-v2
    [*] --> Idle: 初始状态

    state "空闲状态" as Idle {
        [*] --> NoSelection
        NoSelection: nodeEditContext = null
        NoSelection: Banner 不显示
    }

    state "节点选中" as Selected {
        [*] --> CheckType
        CheckType: 检查节点类型

        state if_type <<choice>>
        CheckType --> if_type

        if_type --> NotSupported: 非 skillResponse
        if_type --> CheckTaskId: skillResponse

        NotSupported: 不支持编辑
        NotSupported --> NoSelection

        CheckTaskId: 检查 taskId

        state if_taskId <<choice>>
        CheckTaskId --> if_taskId

        if_taskId --> NoTaskId: taskId 不存在
        if_taskId --> BuildContext: taskId 存在

        NoTaskId: 非 workflow 生成节点
        NoTaskId --> NoSelection

        BuildContext: 构建 NodeEditContext
        BuildContext --> ContextReady
    }

    state "编辑就绪" as ContextReady {
        [*] --> ModifyMode
        ModifyMode: editMode = 'modify'
        ModifyMode: "修改" 按钮高亮

        ExtendMode: editMode = 'extend'
        ExtendMode: "扩展" 按钮高亮

        ModifyMode --> ExtendMode: 点击 "扩展"
        ExtendMode --> ModifyMode: 点击 "修改"
    }

    state "请求处理" as Processing {
        [*] --> SendRequest
        SendRequest: 发送 invokeSkill
        SendRequest: 携带 nodeEditContext

        AgentProcessing: Agent 处理中
        SendRequest --> AgentProcessing

        AgentProcessing --> PatchGenerated: 生成 patch 操作
    }

    state "应用更新" as Applying {
        [*] --> DetectOperation
        DetectOperation: 检测操作类型

        state if_patch <<choice>>
        DetectOperation --> if_patch

        if_patch --> IncrementalUpdate: isPatchOperation
        if_patch --> FullReplace: !isPatchOperation

        IncrementalUpdate: applyIncrementalChangesToCanvas
        IncrementalUpdate: 保留未修改节点

        FullReplace: generateCanvasDataFromWorkflowPlan
        FullReplace: 全量替换
    }

    Idle --> Selected: 用户选中节点
    Selected --> Idle: 取消选中
    ContextReady --> Processing: 发送消息
    Processing --> Applying: 收到响应
    Applying --> Idle: 应用完成
```

---

## 4. 数据结构流转

```mermaid
flowchart LR
    subgraph Input["输入数据"]
        A["selectedNode<br/>(ReactFlow Node)"]
        A1["node.id"]
        A2["node.data.entityId"]
        A3["node.data.metadata.taskId"]
        A4["node.data.metadata.query"]
        A5["node.data.metadata.selectedToolsets"]
        A6["node.data.title"]
    end

    subgraph Context["NodeEditContext"]
        B["nodeId"]
        C["entityId"]
        D["taskId"]
        E["nodeType"]
        F["currentState"]
        F1["query"]
        F2["toolsets[]"]
        F3["title"]
        G["graphContext"]
        G1["upstreamTaskIds[]"]
        G2["downstreamTaskIds[]"]
        H["editMode"]
    end

    subgraph Prompt["Agent Prompt 注入"]
        I["Targeted Node Editing Mode"]
        I1["Selected Node Context JSON"]
        I2["Editing Rules Table"]
        I3["Current Mode Instructions"]
        I4["Examples"]
    end

    subgraph Operation["Patch Operation"]
        J["op: updateTask"]
        J1["taskId"]
        J2["data.title"]
        J3["data.prompt"]
        J4["data.toolsets"]

        K["op: createTask"]
        K1["task.id"]
        K2["task.title"]
        K3["task.prompt"]
        K4["task.dependentTasks"]
        K5["task.toolsets"]
    end

    subgraph Result["Canvas 更新"]
        L["更新现有节点"]
        L1["node.data.title"]
        L2["node.data.metadata.query"]
        L3["node.data.metadata.selectedToolsets"]

        M["创建新节点"]
        M1["新 node 加入 nodes[]"]
        M2["新 edge 连接依赖"]
    end

    A1 --> B
    A2 --> C
    A3 --> D
    A4 --> F1
    A5 --> F2
    A6 --> F3

    B & C & D & E & F & G & H --> I

    D --> J1
    F1 --> J3
    F2 --> J4

    D --> K4

    J --> L
    J2 --> L1
    J3 --> L2
    J4 --> L3

    K --> M
    K4 --> M2
```

---

## 5. 文件依赖关系

```mermaid
flowchart TB
    subgraph Schema["@refly/openapi-schema"]
        S1["schema.yml"]
        S2["types.gen.ts"]
        S1 -->|codegen| S2
    end

    subgraph Stores["@refly/stores"]
        ST1["copilot.ts"]
        ST2["index.ts"]
        ST1 --> ST2
    end

    subgraph CanvasCommon["@refly/canvas-common"]
        CC1["types.ts<br/>(SkillNodeMeta.taskId)"]
        CC2["workflow-plan.ts<br/>(applyIncrementalChangesToCanvas)"]
    end

    subgraph Hooks["ai-workspace-common/hooks"]
        H1["use-node-edit-context.ts"]
        H2["use-invoke-action.ts"]
        H3["index.ts"]
        H1 --> H3
        H2 --> H3
    end

    subgraph Components["ai-workspace-common/components"]
        C1["canvas/index.tsx"]
        C2["copilot/index.tsx"]
        C3["copilot/node-edit-banner.tsx"]
        C4["copilot/chat-box.tsx"]
        C5["copilot/copilot-message.tsx"]
    end

    subgraph SkillTemplate["@refly/skill-template"]
        SK1["prompts/copilot-agent.ts"]
        SK2["prompts/templates/copilot-agent-system.md"]
        SK3["skills/agent.ts"]
        SK4["base.ts"]
        SK1 --> SK2
        SK3 --> SK1
        SK4 --> SK3
    end

    subgraph API["apps/api"]
        A1["skill-invoker.service.ts"]
        A2["workflow-plan.service.ts"]
    end

    %% 依赖关系
    S2 --> ST1
    S2 --> H1
    S2 --> H2
    S2 --> SK4
    S2 --> A1

    ST2 --> H1
    ST2 --> C3
    ST2 --> C4

    CC1 --> H1
    CC2 --> C5

    H1 --> C1
    H2 --> C4

    C3 --> C2
    C4 --> C2
    C5 --> C2

    A1 --> SK3

    classDef schema fill:#e3f2fd,stroke:#1565c0
    classDef store fill:#fce4ec,stroke:#c2185b
    classDef common fill:#f3e5f5,stroke:#7b1fa2
    classDef hook fill:#e8f5e9,stroke:#2e7d32
    classDef component fill:#fff3e0,stroke:#ef6c00
    classDef skill fill:#e0f7fa,stroke:#00838f
    classDef api fill:#fafafa,stroke:#424242

    class S1,S2 schema
    class ST1,ST2 store
    class CC1,CC2 common
    class H1,H2,H3 hook
    class C1,C2,C3,C4,C5 component
    class SK1,SK2,SK3,SK4 skill
    class A1,A2 api
```

---

## 6. 错误处理流程

```mermaid
flowchart TD
    A[开始] --> B{节点选中}

    B -->|无选中| C[nodeEditContext = null]
    B -->|多选| C
    B -->|单选| D{节点类型检查}

    D -->|非 skillResponse| E[不支持编辑<br/>Banner 不显示]
    D -->|skillResponse| F{taskId 检查}

    F -->|无 taskId| G[非 workflow 节点<br/>不支持增量编辑]
    F -->|有 taskId| H[构建 context 成功]

    H --> I[用户发送消息]
    I --> J{API 调用}

    J -->|网络错误| K[显示错误提示<br/>可重试]
    J -->|成功| L{Agent 处理}

    L -->|理解失败| M[Agent 返回普通回复<br/>非 patch 操作]
    L -->|理解成功| N[生成 patch 操作]

    N --> O{patch 验证}

    O -->|taskId 不存在| P[操作失败<br/>节点可能已删除]
    O -->|验证通过| Q[应用增量更新]

    Q --> R{应用结果}

    R -->|成功| S[Canvas 更新<br/>流程结束]
    R -->|失败| T[回滚<br/>显示错误]

    C --> U[正常 Copilot 模式<br/>generate_workflow]
    E --> U
    G --> U
    M --> U

    style K fill:#ffcdd2
    style P fill:#ffcdd2
    style T fill:#ffcdd2
    style S fill:#c8e6c9
```

---

## 7. 关键决策点

```mermaid
flowchart TD
    subgraph Decision1["决策点 1: 是否启用节点编辑"]
        D1A{节点类型?}
        D1A -->|skillResponse| D1B{有 taskId?}
        D1A -->|其他| D1C[不启用]
        D1B -->|是| D1D[启用编辑模式]
        D1B -->|否| D1C
    end

    subgraph Decision2["决策点 2: 选择编辑模式"]
        D2A{用户意图?}
        D2A -->|修改现有内容| D2B["modify 模式<br/>updateTask"]
        D2A -->|添加新内容| D2C["extend 模式<br/>createTask"]
    end

    subgraph Decision3["决策点 3: 应用方式"]
        D3A{操作类型?}
        D3A -->|patch_workflow| D3B["增量更新<br/>applyIncrementalChangesToCanvas"]
        D3A -->|generate_workflow| D3C["全量替换<br/>generateCanvasDataFromWorkflowPlan"]
    end

    subgraph Decision4["决策点 4: 映射策略"]
        D4A{如何定位节点?}
        D4A -->|nodeId| D4B["每次重新生成会变<br/>不可行"]
        D4A -->|taskId| D4C["与 workflow plan 一致<br/>稳定可靠 ✓"]
    end

    D1D --> D2A
    D2B --> D3A
    D2C --> D3A
    D3B --> D4A
```

---

*流程图使用 Mermaid 语法编写，可在支持 Mermaid 的 Markdown 查看器中渲染*
