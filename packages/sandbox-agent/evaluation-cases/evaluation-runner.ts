import { CodeInterpreterSession, File } from '..';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Query interface for evaluation
 */
interface EvaluationQuery {
  id: number;
  description: string;
  input: string;
  file?: string;
  files?: string[];
  expectedOutputs: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  category: string;
  note?: string;
}

/**
 * Evaluation result interface
 */
interface EvaluationResult {
  queryId: number;
  description: string;
  success: boolean;
  executionTime: number;
  outputFiles: string[];
  codeExecutions: number;
  error?: string;
  difficulty: string;
  category: string;
}

/**
 * All evaluation queries
 */
const evaluationQueries: EvaluationQuery[] = [
  // 数据分析类 - Easy
  {
    id: 1,
    description: '分析销售数据基础统计',
    input:
      '请分析这个 sales.csv 文件，给出每列的基本统计信息（均值、中位数、标准差、最大值、最小值）',
    file: 'sales.csv',
    expectedOutputs: ['统计表格', '数据描述'],
    difficulty: 'easy',
    category: 'data-analysis',
  },

  // 数据可视化类 - Easy
  {
    id: 8,
    description: '创建柱状图',
    input: '根据 sales.csv 创建一个柱状图，展示前 10 个产品的销售额',
    file: 'sales.csv',
    expectedOutputs: ['PNG 图表文件'],
    difficulty: 'easy',
    category: 'visualization',
  },

  // 文件处理类 - Easy
  {
    id: 13,
    description: 'CSV 转 JSON',
    input: '将 data.csv 转换为 JSON 格式，保存为 data.json',
    file: 'sales.csv',
    expectedOutputs: ['data.json 文件'],
    difficulty: 'easy',
    category: 'file-processing',
  },

  // 数学计算类 - Easy
  {
    id: 18,
    description: '概率分布计算',
    input: '生成 1000 个符合正态分布（均值=100，标准差=15）的随机数，计算其统计特征并绘制直方图',
    expectedOutputs: ['统计结果', '直方图'],
    difficulty: 'easy',
    category: 'math-statistics',
  },

  // 数据生成类 - Easy
  {
    id: 34,
    description: '生成模拟销售数据',
    input:
      '生成一个包含 1000 行的模拟销售数据集，包括：日期、产品ID、数量、价格、类别等字段，保存为 mock_sales.csv',
    expectedOutputs: ['mock_sales.csv'],
    difficulty: 'easy',
    category: 'data-generation',
  },
];

/**
 * Run a single evaluation query
 */
async function runSingleEvaluation(query: EvaluationQuery): Promise<EvaluationResult> {
  const session = new CodeInterpreterSession({ verbose: false });

  try {
    await session.start();
    console.log(`\n🧪 Testing Query ${query.id}: ${query.description}`);
    console.log(`   Difficulty: ${query.difficulty} | Category: ${query.category}`);

    // Load files if specified
    const files: File[] = [];
    const testDataPath = path.join(__dirname, 'test-data');

    if (query.file && fs.existsSync(path.join(testDataPath, query.file))) {
      files.push(File.fromPath(path.join(testDataPath, query.file)));
    } else if (query.files) {
      for (const filename of query.files) {
        const filepath = path.join(testDataPath, filename);
        if (fs.existsSync(filepath)) {
          files.push(File.fromPath(filepath));
        }
      }
    }

    // Execute query
    const startTime = Date.now();
    const response = await session.generateResponse(query.input, files);
    const executionTime = Date.now() - startTime;

    // Save output files
    const outputPath = path.join(__dirname, 'output', `query-${query.id}`);
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    for (const file of response.files) {
      file.save(path.join(outputPath, file.name));
    }

    // Save response text
    fs.writeFileSync(path.join(outputPath, 'response.txt'), response.content);

    const success = response.files.length > 0 || response.content.length > 100;

    console.log(`   ✅ Success: ${success}`);
    console.log(`   ⏱️  Execution Time: ${executionTime}ms`);
    console.log(`   📁 Output Files: ${response.files.length}`);
    console.log(`   🔢 Code Executions: ${response.codeLog.length}`);

    return {
      queryId: query.id,
      description: query.description,
      success,
      executionTime,
      outputFiles: response.files.map((f) => f.name),
      codeExecutions: response.codeLog.length,
      difficulty: query.difficulty,
      category: query.category,
    };
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);

    return {
      queryId: query.id,
      description: query.description,
      success: false,
      executionTime: 0,
      outputFiles: [],
      codeExecutions: 0,
      error: error.message,
      difficulty: query.difficulty,
      category: query.category,
    };
  } finally {
    await session.stop();
  }
}

/**
 * Run batch evaluation
 */
async function runBatchEvaluation(queries: EvaluationQuery[]) {
  console.log('🚀 Starting Sandbox Agent Evaluation');
  console.log(`📊 Total Queries: ${queries.length}\n`);

  const results: EvaluationResult[] = [];

  for (const query of queries) {
    const result = await runSingleEvaluation(query);
    results.push(result);

    // Small delay between queries
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Generate report
  const report = generateReport(results);

  // Save report
  const reportPath = path.join(__dirname, 'evaluation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 EVALUATION REPORT');
  console.log('='.repeat(60));
  console.log(`\n✅ Success Rate: ${report.summary.successRate}%`);
  console.log(`⏱️  Average Execution Time: ${report.summary.averageTime}ms`);
  console.log(`📁 Total Output Files: ${report.summary.totalOutputFiles}`);
  console.log(`\n📝 Report saved to: ${reportPath}`);

  return report;
}

/**
 * Generate evaluation report
 */
function generateReport(results: EvaluationResult[]) {
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;
  const totalTime = results.reduce((sum, r) => sum + r.executionTime, 0);
  const totalFiles = results.reduce((sum, r) => sum + r.outputFiles.length, 0);

  // By difficulty
  const byDifficulty: Record<string, any> = {};
  for (const diff of ['easy', 'medium', 'hard', 'expert']) {
    const filtered = results.filter((r) => r.difficulty === diff);
    byDifficulty[diff] = {
      total: filtered.length,
      success: filtered.filter((r) => r.success).length,
      successRate:
        filtered.length > 0
          ? Math.round((filtered.filter((r) => r.success).length / filtered.length) * 100)
          : 0,
    };
  }

  // By category
  const categories = [...new Set(results.map((r) => r.category))];
  const byCategory: Record<string, any> = {};
  for (const cat of categories) {
    const filtered = results.filter((r) => r.category === cat);
    byCategory[cat] = {
      total: filtered.length,
      success: filtered.filter((r) => r.success).length,
      successRate: Math.round((filtered.filter((r) => r.success).length / filtered.length) * 100),
    };
  }

  return {
    summary: {
      totalQueries: results.length,
      successCount,
      failureCount,
      successRate: Math.round((successCount / results.length) * 100),
      averageTime: Math.round(totalTime / results.length),
      totalOutputFiles: totalFiles,
    },
    byDifficulty,
    byCategory,
    detailedResults: results,
    failedQueries: results
      .filter((r) => !r.success)
      .map((r) => ({
        id: r.queryId,
        description: r.description,
        error: r.error,
      })),
  };
}

/**
 * Main execution
 */
async function main() {
  try {
    // Create necessary directories
    const dirs = ['test-data', 'output'];
    for (const dir of dirs) {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }

    // Run evaluation
    await runBatchEvaluation(evaluationQueries);
  } catch (error) {
    console.error('❌ Evaluation failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { runSingleEvaluation, runBatchEvaluation, evaluationQueries };
