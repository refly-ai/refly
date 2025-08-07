

🎯 最终技术方案：DivergentAgent

核心设计理念

借鉴 Task Tree Agent 的层次化任务管理**：
- LLM驱动的自主代理系统
- 动态任务树结构管理
- 持续的目标导向执行
  
参考 Multi-Prompt GPTs 的序列化思考模式**：
- 思考-行动的循环模式
- 智能的上下文传递
- 自适应的任务分解
  
关键架构决策

✅ 完全基于现有skillResponse架构 - 不创建新节点类型  
✅ 复用现有技能系统 - commonQnA, webSearch, librarySearch等  
✅ 保持Canvas连线机制 - 使用contextItemIds建立依赖关系  
✅ 避免过度设计 - 专注核心总分总循环功能

🏗️ 核心架构设计

1. skillResponse节点类型设计

// 所有节点都是skillResponse类型，通过metadata区分角色
interface DivergentSkillResponse {
  type: 'skillResponse'  // 固定类型，符合现有架构
  data: {
    title: string
    entityId: string
    metadata: {
      // 新增字段标识DivergentAgent节点
      divergentRole: 'summary' | 'execution' | 'final_output'
      divergentLevel: number              // 发散层级 (0-5)
      divergentSessionId: string         // 关联的会话ID
      parentNodeIds?: string[]           // 父节点ID列表
      childNodeIds?: string[]            // 子节点ID列表
      completionScore?: number           // 完成度评分（总结节点）
      
      // 现有字段保持不变
      status: 'executing' | 'completed' | 'failed'
      contextItems: ContextItem[]
      modelInfo: { modelId: string }
    }
  }
}

2. 总分总实现机制
暂时无法在飞书文档外展示此内容

graph TD
    A["用户输入<br/>skillResponse<br/>(commonQnA)"] --> B["执行节点1<br/>skillResponse<br/>(webSearch)"]
    A --> C["执行节点2<br/>skillResponse<br/>(librarySearch)"]
    A --> D["执行节点3<br/>skillResponse<br/>(commonQnA)"]
    B --> E["汇聚总结<br/>skillResponse<br/>(commonQnA)"]
    C --> E
    D --> E
    E --> F["执行节点4<br/>skillResponse<br/>(generateDoc)"]
    E --> G["执行节点5<br/>skillResponse<br/>(codeArtifacts)"]
    F --> H["最终输出<br/>skillResponse<br/>(commonQnA)"]
    G --> H

3. 技能调用策略

// 总结节点：使用commonQnA进行分析和规划
const summaryQuery = `
基于以下上下文信息，分析当前任务完成情况：
用户意图：${userIntent}
已完成的任务结果：${previousResults}
当前完成度评估：${completionScore}

请分析：
1. 当前任务完成度（0-1评分）
2. 还需要哪些具体子任务（最多8个）
3. 每个子任务应该使用什么技能
4. 是否已经足够生成最终输出
`

// 执行节点：使用具体技能执行任务
const executionQueries = [
  { skill: 'webSearch', query: '搜索关于XXX的最新信息' },
  { skill: 'librarySearch', query: '在知识库中查找XXX相关文档' },
  { skill: 'commonQnA', query: '分析XXX的优缺点' }
]

🔧 技术实现方案

1. 目录结构（精简版）

apps/api/src/modules/divergent/
├── divergent.controller.ts         # API控制器
├── divergent.service.ts            # 核心业务逻辑
├── divergent.module.ts             # 模块定义
├── divergent.processor.ts          # 队列处理器
├── engines/
│   ├── divergent-engine.ts         # 总分总循环引擎
│   ├── skill-orchestrator.ts       # 技能编排器
│   └── completion-evaluator.ts     # 完成度评估器
├── models/
│   ├── divergent-session.ts        # 会话数据模型
│   └── task-metadata.ts           # 任务元数据模型
└── prompts/
    ├── summary-prompts.ts          # 总结分析提示
    ├── diverge-prompts.ts          # 任务分解提示
    └── evaluation-prompts.ts       # 完成度评估提示

2. 核心执行引擎

export class DivergentEngine {
  constructor(
    private readonly skillService: SkillService,
    private readonly canvasService: CanvasService,
    private readonly model: BaseChatModel
  ) {}

  async runDivergentLoop(
    user: User,
    userIntent: string,
    targetId: string
  ): Promise<DivergentSession> {
    
    // 1. 创建根总结节点（使用commonQnA）
    const rootSummaryResult = await this.createSummaryNode(
      user, targetId, userIntent, [], 0
    )
    
    const session = await this.createSession(userIntent, rootSummaryResult.resultId)
    let currentLevel = 0
    let currentSummaryResultId = rootSummaryResult.resultId
    
    // 2. 总分总循环（最多5层）
    while (currentLevel < 5) {
      
      // 2.1 基于当前总结节点，生成子任务
      const subTasks = await this.analyzeAndGenerateSubTasks(
        user, currentSummaryResultId, session
      )
      
      if (subTasks.length === 0) break // 无新任务，结束循环
      
      // 2.2 并行执行所有子任务（最多8个）
      const executionResults = await this.executeSubTasksInParallel(
        user, targetId, subTasks, [currentSummaryResultId]
      )
      
      // 过滤失败的任务
      const successResults = executionResults.filter(r => r.success)
      if (successResults.length === 0) break
      
      // 2.3 汇聚结果到新的总结节点
      const newSummaryResult = await this.createSummaryNode(
        user, targetId, 
        `汇聚分析以下任务结果：${successResults.map(r => r.title).join(', ')}`,
        successResults.map(r => r.resultId),
        currentLevel + 1
      )
      
      // 2.4 评估完成度
      const completionScore = await this.evaluateCompletion(
        user, newSummaryResult.resultId, session.userIntent
      )
      
      session.globalCompletionScore = completionScore
      currentLevel++
      currentSummaryResultId = newSummaryResult.resultId
      
      // 2.5 检查是否达到完成标准（90%）
      if (completionScore >= 0.9) {
        // 生成最终输出
        await this.generateFinalOutput(
          user, targetId, currentSummaryResultId, session
        )
        break
      }
    }
    
    return session
  }

  // 创建总结节点（使用commonQnA技能）
  private async createSummaryNode(
    user: User,
    targetId: string,
    query: string,
    contextResultIds: string[],
    level: number
  ): Promise<ActionResult> {
    
    return await this.skillService.sendInvokeSkillTask(user, {
      resultId: genActionResultID(),
      input: { query },
      target: { entityId: targetId, entityType: 'canvas' },
      skillName: 'commonQnA',
      context: await this.buildContextFromResults(contextResultIds),
      resultHistory: [],
      selectedMcpServers: [],
      metadata: {
        divergentRole: 'summary',
        divergentLevel: level,
        divergentSessionId: session.sessionId
      }
    })
  }

  // 并行执行子任务
  private async executeSubTasksInParallel(
    user: User,
    targetId: string,
    subTasks: SubTask[],
    parentResultIds: string[]
  ): Promise<ExecutionResult[]> {
    
    const promises = subTasks.map(async (task) => {
      try {
        const result = await this.skillService.sendInvokeSkillTask(user, {
          resultId: genActionResultID(),
          input: { query: task.query },
          target: { entityId: targetId, entityType: 'canvas' },
          skillName: task.skillName,
          context: await this.buildContextFromResults(parentResultIds),
          resultHistory: [],
          selectedMcpServers: [],
          metadata: {
            divergentRole: 'execution',
            divergentLevel: task.level,
            divergentSessionId: task.sessionId,
            parentNodeIds: parentResultIds
          }
        })
        return { success: true, resultId: result.resultId, title: task.name }
      } catch (error) {
        // 忽略失败的任务，继续执行其他任务
        return { success: false, error: error.message }
      }
    })
    
    return await Promise.all(promises)
  }
}

3. 智能任务分解

export class SkillOrchestrator {
  
  async analyzeAndGenerateSubTasks(
    currentSummaryContent: string,
    userIntent: string,
    completionScore: number
  ): Promise<SubTask[]> {
    
    const prompt = `
    你是一个智能任务分解专家。基于当前情况分析需要执行的子任务。
    
    用户原始意图：${userIntent}
    当前总结内容：${currentSummaryContent}
    当前完成度：${completionScore}
    
    请分析并生成最多8个具体的子任务，每个任务包含：
    1. 任务名称
    2. 任务描述/查询内容
    3. 应该使用的技能（webSearch/librarySearch/commonQnA/generateDoc/codeArtifacts/generateMedia）
    4. 优先级（1-5）
    
    可用技能说明：
    - webSearch: 网络信息搜索
    - librarySearch: 知识库搜索
    - commonQnA: 分析、推理、总结
    - generateDoc: 文档生成（需要充分信息后使用）
    - codeArtifacts: 代码和可视化生成（需要充分信息后使用）
    - generateMedia: 多媒体内容生成
    
    返回JSON格式：
    [
      {
        "name": "任务名称",
        "query": "具体查询内容",
        "skillName": "技能名称",
        "priority": 1
      }
    ]
    
    如果当前信息已经足够完成用户意图，返回空数组 []
    `
    
    const response = await this.model.invoke(prompt)
    return this.parseSubTasks(response)
  }
}

4. 完成度评估器

export class CompletionEvaluator {
  
  async evaluateCompletion(
    summaryContent: string,
    userIntent: string,
    allPreviousResults: string[]
  ): Promise<number> {
    
    const prompt = `
    评估当前任务完成度，返回0-1之间的数值。
    
    用户原始意图：${userIntent}
    当前总结内容：${summaryContent}
    所有已完成任务：${allPreviousResults.join('\n---\n')}
    
    评估维度：
    1. 信息完整性（40%）：是否收集了足够的相关信息
    2. 用户意图匹配度（40%）：是否准确理解并回应了用户需求
    3. 输出质量（20%）：内容是否准确、清晰、有价值
    
    请返回一个0-1之间的数值，表示完成度。
    - 0.9以上：可以生成高质量的最终输出
    - 0.7-0.9：需要补充少量信息
    - 0.5-0.7：需要更多研究和分析
    - 0.5以下：刚开始，需要大量工作
    
    只返回数值，如：0.85
    `
    
    const response = await this.model.invoke(prompt)
    return parseFloat(response.trim()) || 0
  }
}

5. 数据模型（复用现有表）

// 复用现有的ActionResult表，通过metadata字段存储DivergentAgent信息
interface DivergentMetadata {
  divergentRole: 'summary' | 'execution' | 'final_output'
  divergentLevel: number
  divergentSessionId: string
  parentNodeIds?: string[]
  completionScore?: number
}

// 新增轻量级会话表
model DivergentSession {
  sessionId              String    @id
  uid                    String
  userIntent             String    @db.Text
  rootResultId           String    // 根总结节点的ActionResult ID
  currentLevel           Int       @default(0)
  globalCompletionScore  Float     @default(0)
  status                 String    @default("executing")
  finalOutputResultId    String?   // 最终输出节点的ActionResult ID
  targetId               String    // Canvas ID
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt
}

📋 实施计划

阶段一：核心引擎开发（1周）
1. 创建DivergentAgent模块结构
2. 实现DivergentEngine总分总循环逻辑
3. 开发SkillOrchestrator智能任务分解
4. 集成现有SkillService调用机制
  
阶段二：评估和优化（0.5周）
1. 实现CompletionEvaluator完成度评估
2. 优化提示工程，提升任务分解质量
3. 完善错误处理和容错机制
  
阶段三：集成和测试（0.5周）
1. 集成现有Canvas和队列系统
2. 实现API接口和基础查询功能
3. 端到端测试和性能优化
  
✅ 方案优势确认

特性
实现方式
符合要求
skillResponse架构
所有节点都是skillResponse类型
✅
现有技能复用
使用commonQnA/webSearch等现有技能
✅
Canvas连线机制
通过contextItemIds建立依赖关系
✅
总分总循环
智能的总结-分解-汇聚模式
✅
先进理念借鉴
Task Tree Agent + Multi-Prompt GPTs
✅
避免过度设计
最小化新增组件，复用现有系统
✅
配置要求满足
8并行、5层深度、90%阈值
✅

🔍 最终审查确认

与用户目标的完美匹配：
- ✅ 实现了完全基于skillResponse的总分总循环模式
- ✅ 在Canvas上正确展示树状结构和连线关系
- ✅ 借鉴了先进的Task Tree Agent和Multi-Prompt GPTs理念
- ✅ 避免了过度设计，完全复用现有技术栈
- ✅ 支持多种工具和第三方API（通过现有技能系统）
  
技术方案可行性：
- ✅ 无需修改现有Canvas或Skill架构
- ✅ 完全基于现有的ActionResult和SkillService
- ✅ 复用现有的队列处理和错误机制
- ✅ 数据库改动最小，主要通过metadata字段扩展
  
这个方案完全符合你的要求，既实现了先进的总分总循环功能，又完美契合了现有的技术架构。请review确认后，我将开始具体的代码实现工作。

