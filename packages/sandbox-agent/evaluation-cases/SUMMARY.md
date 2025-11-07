# Sandbox Agent 用例评测集 - 完成总结

## ✅ 已完成内容

### 1. 核心文档

#### **use-cases.md** - 完整的用例和评测查询集
- ✅ **40 个评测查询**，覆盖 10 大类别
- ✅ **4 个难度级别**（Easy, Medium, Hard, Expert）
- ✅ **详细的查询定义**，包含输入、输出、难度等
- ✅ **评测框架设计**，包含评测维度和指标
- ✅ **测试数据集说明**

**10 大类别**：
1. 数据分析类 (7 个查询)
2. 数据可视化类 (5 个查询)
3. 文件处理类 (5 个查询)
4. 数学和统计计算类 (5 个查询)
5. 机器学习类 (5 个查询)
6. 文本和 NLP 处理类 (3 个查询)
7. 报表生成类 (3 个查询)
8. 数据生成类 (2 个查询)
9. API 数据获取类 (2 个查询)
10. 复杂综合任务类 (3 个查询)

### 2. 评测工具

#### **evaluation-runner.ts** - 评测运行器
- ✅ 批量运行评测查询
- ✅ 自动保存输出文件
- ✅ 生成 JSON 格式的评测报告
- ✅ 支持单个查询运行
- ✅ 详细的执行日志
- ✅ 错误处理和异常捕获

**功能特性**：
- 自动创建输出目录
- 保存每个查询的响应文本和生成的文件
- 统计执行时间、文件数量、代码执行次数
- 按难度和类别分组统计
- 识别失败的查询并记录错误信息

#### **generate-test-data.ts** - 测试数据生成器
- ✅ 生成 7 种测试数据集
- ✅ 自动创建 test-data 目录
- ✅ 生成数据说明文档

**生成的数据集**：
1. `sales.csv` (1000 行) - 销售交易数据
2. `customers.csv` (500 行) - 客户信息
3. `inventory.csv` (200 行) - 库存数据
4. `timeseries.csv` (1095 行) - 时间序列数据
5. `reviews.csv` (1000 行) - 产品评论
6. `data.csv` (100 行) - 简单测试数据
7. `housing.csv` (500 行) - 房产数据（用于 ML）

#### **analyze-results.ts** - 结果分析工具
- ✅ 分析评测报告
- ✅ 生成可视化摘要
- ✅ 提供洞察和建议
- ✅ 导出 Markdown 报告

**分析维度**：
- 总体表现摘要
- 按难度分析
- 按类别分析
- 失败查询列表
- Top 5 最快查询
- 智能建议和洞察

### 3. 文档

#### **README.md** - 使用指南
- ✅ 完整的快速开始指南
- ✅ 目录结构说明
- ✅ 评测内容概览
- ✅ 评测指标说明
- ✅ 自定义评测指南
- ✅ 使用场景示例
- ✅ 开发工具说明
- ✅ 故障排除指南

#### **SUMMARY.md** - 本文档
- ✅ 完成内容总结
- ✅ 使用流程说明
- ✅ 项目统计信息

## 📊 项目统计

### 文件数量
- **文档文件**: 3 个（use-cases.md, README.md, SUMMARY.md）
- **TypeScript 文件**: 3 个（evaluation-runner.ts, generate-test-data.ts, analyze-results.ts）
- **总计**: 6 个核心文件

### 代码量
- **use-cases.md**: ~1500 行（包含 40 个详细查询定义）
- **evaluation-runner.ts**: ~250 行
- **generate-test-data.ts**: ~350 行
- **analyze-results.ts**: ~300 行
- **README.md**: ~400 行
- **总计**: ~2800 行

### 评测覆盖
- **查询总数**: 40 个
- **类别数**: 10 个
- **难度级别**: 4 个
- **测试数据集**: 7 个
- **总数据行数**: ~3,500 行测试数据

## 🚀 完整使用流程

### 第一步：生成测试数据

```bash
cd /Users/pftom/Projects/workflow-agents/code-interpreter/sandbox-agent-use-cases
npx tsx generate-test-data.ts
```

**输出**：
- 在 `test-data/` 目录下生成 7 个 CSV 文件
- 生成 `test-data/README.md` 说明文档

### 第二步：配置环境

```bash
# 确保 sandbox-agent 已配置
cd ../sandbox-agent
cp env.example .env
# 编辑 .env 添加 OPENAI_API_KEY
```

### 第三步：安装依赖

```bash
cd ../sandbox-agent
npm install
```

### 第四步：运行评测

```bash
cd ../sandbox-agent-use-cases
npx tsx evaluation-runner.ts
```

**输出**：
- 控制台显示每个查询的执行结果
- 在 `output/` 目录保存每个查询的输出
- 生成 `evaluation-report.json`

### 第五步：分析结果

```bash
npx tsx analyze-results.ts
```

**输出**：
- 控制台显示详细的分析结果
- 生成 `evaluation-report.md` Markdown 报告

### 第六步：查看报告

```bash
# 查看 JSON 报告
cat evaluation-report.json | jq '.'

# 查看 Markdown 报告
cat evaluation-report.md

# 或在编辑器中打开
code evaluation-report.md
```

## 📈 评测指标说明

### 核心指标

1. **成功率 (Success Rate)**
   - 定义：成功完成的查询 / 总查询数 × 100%
   - 目标：≥ 85%

2. **平均执行时间 (Average Execution Time)**
   - 定义：所有查询的平均执行时间
   - 目标：< 15 秒

3. **输出完整性 (Output Completeness)**
   - 定义：生成预期输出的查询比例
   - 目标：≥ 90%

4. **代码执行成功率 (Code Success Rate)**
   - 定义：代码无错误执行的比例
   - 目标：≥ 95%

### 分析维度

1. **按难度分析**
   - Easy: 预期成功率 95%+
   - Medium: 预期成功率 85%+
   - Hard: 预期成功率 70%+
   - Expert: 预期成功率 60%+

2. **按类别分析**
   - 识别表现较弱的类别
   - 针对性改进

3. **失败分析**
   - 错误类型统计
   - 常见失败原因
   - 改进建议

## 🎯 查询示例

### 简单查询示例 (Easy)

```typescript
{
  id: 1,
  description: '分析销售数据基础统计',
  input: '请分析这个 sales.csv 文件，给出每列的基本统计信息（均值、中位数、标准差、最大值、最小值）',
  file: 'sales.csv',
  expectedOutputs: ['统计表格', '数据描述'],
  difficulty: 'easy',
  category: 'data-analysis'
}
```

### 困难查询示例 (Hard)

```typescript
{
  id: 20,
  description: '线性回归建模',
  input: '对 housing.csv 建立线性回归模型，预测房价。特征包括：面积、房间数、地段等。输出模型性能指标和预测结果',
  file: 'housing.csv',
  expectedOutputs: ['模型参数', 'R²值', '预测结果', '残差图'],
  difficulty: 'hard',
  category: 'math-statistics'
}
```

### 专家级查询示例 (Expert)

```typescript
{
  id: 38,
  description: '完整的数据分析管道',
  input: `执行完整的数据分析流程：
1. 读取 raw_data.csv
2. 数据清洗（处理缺失值、异常值）
3. 探索性数据分析（EDA）
4. 特征工程
5. 建立预测模型
6. 评估模型性能
7. 生成可视化报告`,
  file: 'raw_data.csv',
  expectedOutputs: ['清洗后数据', 'EDA 报告', '模型结果', '可视化图表'],
  difficulty: 'expert',
  category: 'complex-tasks'
}
```

## 🔧 扩展和自定义

### 添加新类别

1. 在 `use-cases.md` 中定义新类别
2. 添加该类别的查询
3. 在 `evaluation-runner.ts` 中添加查询定义

### 添加新的测试数据

1. 在 `generate-test-data.ts` 中添加生成函数
2. 调用该函数生成数据
3. 更新 `test-data/README.md`

### 自定义评测指标

1. 修改 `evaluation-runner.ts` 中的 `EvaluationResult` 接口
2. 在 `runSingleEvaluation` 中收集新指标
3. 在 `generateReport` 中统计新指标
4. 在 `analyze-results.ts` 中展示新指标

## 📚 相关文档

- **Sandbox Agent 主文档**: `../sandbox-agent/README.md`
- **详细用例说明**: `./use-cases.md`
- **使用指南**: `./README.md`
- **测试数据说明**: `./test-data/README.md`

## 🎉 完成状态

### ✅ 完全实现
- [x] 40 个评测查询定义
- [x] 10 个类别分类
- [x] 4 个难度级别
- [x] 评测运行器
- [x] 测试数据生成器
- [x] 结果分析工具
- [x] 完整文档
- [x] 使用示例

### 🚀 可选增强（未来）
- [ ] 自动生成测试用例
- [ ] 集成 CI/CD
- [ ] 性能基准对比
- [ ] 可视化仪表板
- [ ] 更多语言支持

## 💡 使用建议

### 日常评测
```bash
# 快速验证（只运行简单查询）
npx tsx evaluation-runner.ts --difficulty easy

# 完整评测（所有查询）
npx tsx evaluation-runner.ts

# 分析结果
npx tsx analyze-results.ts
```

### 针对性测试
```bash
# 只测试数据分析能力
npx tsx evaluation-runner.ts --category data-analysis

# 只测试可视化能力
npx tsx evaluation-runner.ts --category visualization
```

### 持续改进
```bash
# 1. 运行评测
npx tsx evaluation-runner.ts

# 2. 分析结果
npx tsx analyze-results.ts

# 3. 识别弱项
cat evaluation-report.json | jq '.failedQueries'

# 4. 改进代码

# 5. 重新评测
npx tsx evaluation-runner.ts
```

## 🏆 质量标准

### 优秀 (Excellent)
- 成功率 ≥ 90%
- 平均时间 < 10 秒
- 所有 Easy 查询 100% 成功

### 良好 (Good)
- 成功率 ≥ 80%
- 平均时间 < 15 秒
- Easy 查询 ≥ 95% 成功

### 可接受 (Acceptable)
- 成功率 ≥ 70%
- 平均时间 < 20 秒
- Easy 查询 ≥ 90% 成功

### 需改进 (Needs Improvement)
- 成功率 < 70%
- 平均时间 ≥ 20 秒
- Easy 查询 < 90% 成功

---

**创建日期**: 2024-11-07  
**状态**: ✅ 完成  
**版本**: 1.0.0

**问题反馈**: 请查看相关文档或提交 issue

