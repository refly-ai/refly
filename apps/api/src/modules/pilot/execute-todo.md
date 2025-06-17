# 工作流代理 (Workflow Agent) 实施任务优化报告

## 1. 项目概述

基于现有的 PilotEngine 框架，扩展开发一个高级 AI 工作流代理，该代理能够将用户需求分解为多节点画布工作流，通过多个周期（epochs）执行，并使用 todo.md 作为中间产物跟踪任务进度与元数据。

## 2. 核心组件开发计划

### 2.1 扩展 PilotEngine 和 PilotService

- 基于现有 PilotEngine 构建工作流处理能力
- 扩展 PilotService 以支持 todo.md 生成和解析
- 增强周期（epochs）管理与状态追踪
- 实现工作流完成状态判断机制

### 2.2 实现 TodoMdService

- 实现 todo.md 元数据解析与生成服务
- 开发周期（epoch）任务规划逻辑
- 构建任务状态更新系统
- 创建周期总结生成机制

### 2.3 扩展数据模型

- 扩展 PilotStep 和 PilotSession 模型
- 添加工作流节点间依赖关系
- 增加任务优先级和分类属性
- 实现任务元数据存储与管理

### 2.4 扩展现有 API

- 扩展 PilotController 添加工作流相关接口
- 实现 todo.md 状态查询与更新端点
- 增加周期总结查询功能

## 3. 具体开发任务

### 阶段一：数据模型扩展

1. **扩展 PilotSession 模型**
   - 添加工作流相关状态字段
   - 增加 todo.md 存储字段
   - 完善周期管理属性

2. **扩展 PilotStep 模型**
   - 添加任务依赖关系字段
   - 增加优先级和任务类别字段
   - 实现与 todo.md 任务的关联

3. **设计 TodoMd 数据结构**
   - 定义 todo.md 解析模型
   - 实现任务状态跟踪结构
   - 创建周期数据记录格式

### 阶段二：核心服务实现

4. **实现 TodoMdService**
   - 开发 todo.md 生成与解析功能
   - 实现基于 LLM 的任务分解逻辑
   - 创建任务状态更新机制

5. **扩展 PilotService**
   - 集成 TodoMdService
   - 增强多周期执行逻辑
   - 实现任务依赖分析功能

6. **优化 PilotEngine**
   - 增强步骤生成和规划逻辑
   - 实现基于 todo.md 的上下文管理
   - 优化模型提示工程

### 阶段三：集成与 API 扩展

7. **扩展 PilotProcessor**
   - 实现工作流任务队列逻辑
   - 优化任务执行与同步机制
   - 增加周期间状态维护

8. **扩展 PilotController**
   - 添加 todo.md 查询端点
   - 实现周期总结获取接口
   - 创建工作流状态查询功能

9. **实现 LLM 提示模板**
   - 开发 todo.md 生成提示模板
   - 实现任务规划提示模板
   - 创建周期总结提示模板

## 4. 实施细节

### 4.1 数据库模型扩展

```typescript
// 扩展 PilotSession 数据模型
model PilotSession {
  // 现有字段...
  todoMd             String?          // 存储最新的 todo.md 内容
  currentEpoch       Int              @default(1)  // 当前执行的周期
  maxEpoch           Int              @default(3)  // 最大周期数
  workflowStatus     String?          // 工作流特定状态
}

// 扩展 PilotStep 数据模型
model PilotStep {
  // 现有字段...
  parentIds          String?          // 父任务 ID 列表，JSON 字符串
  priority           Int?             // 任务优先级
  goalCategory       String?          // 任务类别
  todoTaskId         String?          // 关联的 todo.md 任务 ID
}
```

### 4.2 核心服务实现计划

1. **TodoMdService**

```typescript
@Injectable()
export class TodoMdService {
  constructor(private readonly model: BaseChatModel) {}

  // 生成初始 todo.md
  async generateInitialTodo(userRequest: string, maxEpochs: number): Promise<string> {}

  // 基于 todo.md 规划当前周期任务
  async planEpochSteps(todoMd: string, previousEpochResults: ActionResult[]): Promise<WorkflowNodeRawOutput[]> {}

  // 更新 todo.md 反映已完成任务
  async updateTodoMd(todoMd: string, epochResults: ActionResult[]): Promise<string> {}

  // 生成周期执行总结
  async generateEpochSummary(todoMd: string, epochResults: ActionResult[]): Promise<EpochSummary> {}

  // 解析 todo.md 内容
  parseTodoMd(todoMd: string): TodoMdData {}

  // 判断工作流是否完成
  isWorkflowComplete(todoMd: string): boolean {}
}
```

2. **PilotService 扩展**

```typescript
// 在现有 PilotService 中添加方法
export class PilotService {
  // 现有方法...

  // 创建工作流会话
  async createWorkflowSession(user: User, request: CreateWorkflowRequest) {}

  // 获取工作流 todo.md
  async getWorkflowTodo(user: User, sessionId: string) {}

  // 获取周期执行总结
  async getEpochSummary(user: User, sessionId: string, epochNumber: number) {}

  // 运行工作流（扩展现有 runPilot 方法）
  async runWorkflow(user: User, sessionId: string) {
    // 获取会话信息和 todo.md
    const session = await this.getSession(user, sessionId);
    const todoMd = session.todoMd;
    
    // 获取所有之前周期的结果
    const previousEpochResults = await this.getAllPreviousEpochResults(session);
    
    // 规划当前周期任务，仅使用之前周期的结果作为上下文
    const steps = await this.todoMdService.planEpochSteps(todoMd, previousEpochResults);
    
    // 执行当前周期任务
    const results = await this.executePilotSteps(user, session, steps);
    
    // 更新 todo.md
    const updatedTodoMd = await this.todoMdService.updateTodoMd(todoMd, results);
    
    // 生成周期总结
    const summary = await this.todoMdService.generateEpochSummary(updatedTodoMd, results);
    
    // 更新会话状态
    await this.updateSessionWithEpochResults(session, updatedTodoMd, summary);
    
    return { results, summary };
  }
  
  // 获取所有之前周期的结果
  private async getAllPreviousEpochResults(session: PilotSession): Promise<ActionResult[]> {
    // 查询该会话所有已完成周期的步骤结果
    const previousSteps = await this.pilotStepRepository.find({
      where: {
        sessionId: session.id,
        epochNumber: LessThan(session.currentEpoch) // 仅查找之前周期的结果
      },
      order: {
        epochNumber: "ASC" // 按周期顺序排序
      }
    });
    
    // 将步骤转换为结果格式
    return previousSteps.map(step => ({
      stepId: step.id,
      nodeId: step.nodeId,
      result: {
        content: step.result,
        success: step.status === 'completed'
      }
    }));
  }
  
  // 更新会话状态
  private async updateSessionWithEpochResults(
    session: PilotSession, 
    updatedTodoMd: string, 
    summary: EpochSummary
  ) {
    // 更新 todo.md
    session.todoMd = updatedTodoMd;
    
    // 检查是否需要开始新周期
    if (!this.todoMdService.isWorkflowComplete(updatedTodoMd) && 
        session.currentEpoch < session.maxEpoch) {
      session.currentEpoch += 1;
    } else {
      session.status = 'completed';
    }
    
    // 保存周期总结
    await this.saveEpochSummary(session, summary);
    
    // 保存会话更新
    await this.pilotSessionRepository.save(session);
  }
}
```

### 4.3 提示模板设计

1. **Todo.md 生成提示**
   - 分析用户需求并生成结构化任务列表
   - 设定任务优先级和依赖关系
   - 针对不同任务推荐最合适的工具

2. **周期规划提示**
   - 分析当前 todo.md 确定本周期需执行的任务
   - 考虑任务依赖和优先级进行排序
   - 仅使用之前周期完成的任务结果作为上下文
   - 生成具体步骤执行计划

3. **周期总结提示**
   - 分析已完成任务的结果
   - 生成关键发现摘要
   - 提供下一周期执行建议

## 5. 与现有系统的集成点

1. **与 PilotEngine 的集成**
   - 扩展 run 方法以支持基于 todo.md 的上下文
   - 增强步骤生成逻辑以考虑任务依赖

2. **与 PilotService 的集成**
   - 扩展 runPilot 和 syncPilotStep 以支持多周期基于 todo.md 的执行
   - 添加工作流特定状态管理

3. **与任务队列的集成**
   - 扩展现有队列处理器以支持工作流特定任务
   - 实现周期间状态维护机制

4. **与模型提示的集成**
   - 实现专用于工作流的模型提示模板
   - 优化现有提示以支持工作流上下文

## 6. 验收标准

1. **功能完整性**
   - 能够基于用户需求生成完整的任务分解（todo.md）
   - 支持多周期执行并正确追踪任务状态
   - 能够生成周期总结和最终报告

2. **稳定性与鲁棒性**
   - 具备错误处理与恢复机制
   - 模型输出解析失败时有可靠的备选方案
   - 支持中断后恢复执行

3. **集成度**
   - 与现有 Pilot 系统无缝集成
   - 复用现有组件和机制
   - 符合系统整体架构风格

## 7. 后续增强机会

1. **高级任务管理**
   - 实现复杂任务依赖图分析
   - 支持动态任务重新优先级排序

2. **自适应执行**
   - 基于执行结果动态调整任务计划
   - 自动识别并处理失败任务

3. **高级提示工程**
   - 优化提示模板以提升任务分解质量
   - 实现特定领域知识增强的提示
