# Sandbox Agent Use Cases & Evaluation

这个目录包含了 Sandbox Agent 的使用案例和完整的评测框架。

## 📁 目录结构

```
sandbox-agent-use-cases/
├── README.md                    # 本文件
├── use-cases.md                 # 完整的用例和查询评测集（40个查询）
├── evaluation-runner.ts         # 评测运行器
├── generate-test-data.ts        # 测试数据生成器
├── test-data/                   # 测试数据目录
│   ├── sales.csv
│   ├── customers.csv
│   ├── inventory.csv
│   ├── timeseries.csv
│   ├── reviews.csv
│   ├── data.csv
│   ├── housing.csv
│   └── README.md
└── output/                      # 评测输出目录
    └── query-{id}/             # 每个查询的输出
        ├── response.txt
        └── *.png / *.csv
```

## 🚀 快速开始

### 1. 生成测试数据

首先生成用于评测的测试数据：

```bash
cd sandbox-agent-use-cases
npx tsx generate-test-data.ts
```

这将在 `test-data/` 目录下生成 7 个测试数据集。

### 2. 配置环境

确保你已经配置了 Sandbox Agent 的环境变量：

```bash
# 在 ../sandbox-agent/ 目录下的 .env 文件中
OPENAI_API_KEY=sk-your-api-key
```

### 3. 运行评测

运行评测集：

```bash
npx tsx evaluation-runner.ts
```

评测将：
- 依次运行所有查询
- 保存每个查询的输出到 `output/query-{id}/`
- 生成评测报告到 `evaluation-report.json`

### 4. 查看结果

查看评测报告：

```bash
cat evaluation-report.json
```

或使用 jq 格式化查看：

```bash
cat evaluation-report.json | jq '.'
```

## 📊 评测内容

### 10 大类别，40 个查询

1. **数据分析类** (7 个查询)
   - 基础统计分析
   - 分组聚合
   - 时间序列分析
   - 异常值检测
   - 相关性分析
   - 多文件对比
   - 数据合并

2. **数据可视化类** (5 个查询)
   - 基础图表（柱状图、折线图）
   - 多子图仪表板
   - 箱线图
   - 时间序列图
   - 地理分布图

3. **文件处理类** (5 个查询)
   - 格式转换（CSV ↔ JSON）
   - 数据清洗
   - 数据转换（宽表 ↔ 长表）
   - 数据拆分
   - 批量处理

4. **数学和统计计算类** (5 个查询)
   - 概率分布
   - 假设检验
   - 回归分析
   - 优化问题
   - 矩阵运算

5. **机器学习类** (5 个查询)
   - 分类任务
   - 聚类分析
   - 特征工程
   - 时间序列预测
   - 推荐系统

6. **文本和 NLP 处理类** (3 个查询)
   - 文本清洗
   - 词频分析和词云
   - 情感分析

7. **报表生成类** (3 个查询)
   - 月度报表
   - 数据质量报告
   - 业务分析报告

8. **数据生成类** (2 个查询)
   - 生成测试数据
   - 生成时间序列

9. **API 数据获取类** (2 个查询)
   - 获取股票数据
   - 获取天气数据

10. **复杂综合任务类** (3 个查询)
    - 端到端数据分析流程
    - 多源数据融合
    - 自动化决策支持

### 难度分布

- **Easy** (简单): 10 个查询 - 单步操作，明确输入输出
- **Medium** (中等): 15 个查询 - 2-3 步骤，有一定复杂性
- **Hard** (困难): 12 个查询 - 多步骤，需要领域知识
- **Expert** (专家): 3 个查询 - 端到端流程，需要决策

## 📋 评测指标

### 关键指标

1. **成功率** (Success Rate)
   - 总体成功率
   - 按难度的成功率
   - 按类别的成功率

2. **执行时间** (Execution Time)
   - 平均执行时间
   - 按难度的执行时间
   - 超时情况

3. **输出质量** (Output Quality)
   - 文件生成数量
   - 代码执行次数
   - 输出完整性

4. **错误分析** (Error Analysis)
   - 失败的查询列表
   - 错误类型分布
   - 失败原因分析

### 评测报告示例

```json
{
  "summary": {
    "totalQueries": 40,
    "successCount": 34,
    "failureCount": 6,
    "successRate": 85,
    "averageTime": 12300,
    "totalOutputFiles": 67
  },
  "byDifficulty": {
    "easy": { "total": 10, "success": 10, "successRate": 100 },
    "medium": { "total": 15, "success": 13, "successRate": 87 },
    "hard": { "total": 12, "success": 9, "successRate": 75 },
    "expert": { "total": 3, "success": 2, "successRate": 67 }
  },
  "byCategory": {
    "data-analysis": { "total": 7, "success": 6, "successRate": 86 },
    "visualization": { "total": 5, "success": 4, "successRate": 80 }
  }
}
```

## 🔧 自定义评测

### 添加新的查询

在 `evaluation-runner.ts` 中添加新查询：

```typescript
const newQuery: EvaluationQuery = {
  id: 41,
  description: '你的查询描述',
  input: '查询的具体内容',
  file: 'your-data.csv',  // 可选
  expectedOutputs: ['期望的输出'],
  difficulty: 'medium',
  category: 'your-category'
};

evaluationQueries.push(newQuery);
```

### 添加新的测试数据

在 `generate-test-data.ts` 中添加生成函数：

```typescript
function generateYourData() {
  const rows = ['column1,column2,column3'];
  
  // 生成数据逻辑
  for (let i = 0; i < 100; i++) {
    rows.push(`value1,value2,value3`);
  }
  
  fs.writeFileSync(
    path.join(testDataDir, 'your-data.csv'),
    rows.join('\n')
  );
}
```

## 📖 详细文档

- **[use-cases.md](./use-cases.md)** - 查看完整的 40 个查询评测集
- **[Sandbox Agent README](../sandbox-agent/README.md)** - Sandbox Agent 主文档
- **[测试数据说明](./test-data/README.md)** - 测试数据集详情

## 🎯 使用场景示例

### 场景 1: 评估特定能力

只运行数据分析类查询：

```typescript
// 修改 evaluation-runner.ts
const queries = evaluationQueries.filter(q => q.category === 'data-analysis');
await runBatchEvaluation(queries);
```

### 场景 2: 快速验证

只运行简单查询：

```typescript
const queries = evaluationQueries.filter(q => q.difficulty === 'easy');
await runBatchEvaluation(queries);
```

### 场景 3: 压力测试

运行困难和专家级查询：

```typescript
const queries = evaluationQueries.filter(q => 
  q.difficulty === 'hard' || q.difficulty === 'expert'
);
await runBatchEvaluation(queries);
```

## 🛠️ 开发工具

### 单独运行某个查询

```typescript
import { runSingleEvaluation, evaluationQueries } from './evaluation-runner';

const query = evaluationQueries.find(q => q.id === 1);
if (query) {
  await runSingleEvaluation(query);
}
```

### 分析评测结果

```bash
# 查看成功率
cat evaluation-report.json | jq '.summary.successRate'

# 查看失败的查询
cat evaluation-report.json | jq '.failedQueries'

# 按难度查看结果
cat evaluation-report.json | jq '.byDifficulty'

# 按类别查看结果
cat evaluation-report.json | jq '.byCategory'
```

## 📈 持续改进

### 建议的改进方向

1. **增加查询数量** - 覆盖更多边缘场景
2. **细化评测指标** - 添加输出质量评分
3. **自动化测试** - 集成到 CI/CD 流程
4. **性能基准** - 建立性能基线
5. **回归测试** - 检测性能退化

### 贡献新的用例

欢迎贡献新的评测用例！请：

1. 在 `use-cases.md` 中添加查询描述
2. 在 `evaluation-runner.ts` 中添加查询定义
3. 如需要新数据，更新 `generate-test-data.ts`
4. 提交 Pull Request

## 🤝 支持

遇到问题？

1. 检查 [use-cases.md](./use-cases.md) 中的详细说明
2. 查看 [Sandbox Agent 文档](../sandbox-agent/README.md)
3. 运行 `npx tsx generate-test-data.ts` 重新生成测试数据
4. 检查 `output/` 目录中的详细输出

## 📝 更新日志

- **2024-11-07**: 初始版本
  - 创建 40 个评测查询
  - 10 个类别
  - 4 个难度级别
  - 完整的评测框架

---

**Happy Testing!** 🚀

如有问题或建议，请查看主文档或提交 issue。

