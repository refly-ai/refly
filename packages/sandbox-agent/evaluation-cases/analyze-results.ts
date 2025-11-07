import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Analyze evaluation results and generate insights
 */

interface EvaluationReport {
  summary: {
    totalQueries: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    averageTime: number;
    totalOutputFiles: number;
  };
  byDifficulty: Record<string, any>;
  byCategory: Record<string, any>;
  detailedResults: any[];
  failedQueries: any[];
}

/**
 * Load evaluation report
 */
function loadReport(): EvaluationReport | null {
  const reportPath = path.join(__dirname, 'evaluation-report.json');

  if (!fs.existsSync(reportPath)) {
    console.error('❌ Evaluation report not found. Run evaluation-runner.ts first.');
    return null;
  }

  const reportData = fs.readFileSync(reportPath, 'utf-8');
  return JSON.parse(reportData);
}

/**
 * Display summary
 */
function displaySummary(report: EvaluationReport) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 SANDBOX AGENT EVALUATION SUMMARY');
  console.log('='.repeat(70));

  const { summary } = report;

  console.log('\n📈 Overall Performance:');
  console.log(`   Total Queries:        ${summary.totalQueries}`);
  console.log(`   ✅ Successful:        ${summary.successCount} (${summary.successRate}%)`);
  console.log(`   ❌ Failed:            ${summary.failureCount} (${100 - summary.successRate}%)`);
  console.log(`   ⏱️  Average Time:      ${summary.averageTime}ms`);
  console.log(`   📁 Files Generated:   ${summary.totalOutputFiles}`);

  // Success rate indicator
  const successBar = generateProgressBar(summary.successRate);
  console.log(`\n   Success Rate: ${successBar} ${summary.successRate}%`);
}

/**
 * Display results by difficulty
 */
function displayByDifficulty(report: EvaluationReport) {
  console.log(`\n${'-'.repeat(70)}`);
  console.log('📊 Performance by Difficulty');
  console.log('-'.repeat(70));

  const difficulties = ['easy', 'medium', 'hard', 'expert'];

  for (const diff of difficulties) {
    const data = report.byDifficulty[diff];
    if (data && data.total > 0) {
      const icon = getDifficultyIcon(diff);
      const bar = generateProgressBar(data.successRate);
      console.log(`\n${icon} ${diff.toUpperCase()}`);
      console.log(`   Total: ${data.total} | Success: ${data.success}/${data.total}`);
      console.log(`   ${bar} ${data.successRate}%`);
    }
  }
}

/**
 * Display results by category
 */
function displayByCategory(report: EvaluationReport) {
  console.log(`\n${'-'.repeat(70)}`);
  console.log('📊 Performance by Category');
  console.log('-'.repeat(70));

  const categories = Object.keys(report.byCategory).sort();

  for (const category of categories) {
    const data = report.byCategory[category];
    const bar = generateProgressBar(data.successRate);
    const categoryName = category.replace(/-/g, ' ').toUpperCase();
    console.log(`\n📁 ${categoryName}`);
    console.log(`   Total: ${data.total} | Success: ${data.success}/${data.total}`);
    console.log(`   ${bar} ${data.successRate}%`);
  }
}

/**
 * Display failed queries
 */
function displayFailedQueries(report: EvaluationReport) {
  if (report.failedQueries.length === 0) {
    console.log(`\n${'-'.repeat(70)}`);
    console.log('✅ No failed queries - All tests passed!');
    return;
  }

  console.log(`\n${'-'.repeat(70)}`);
  console.log('❌ Failed Queries');
  console.log('-'.repeat(70));

  for (const failure of report.failedQueries) {
    console.log(`\n#${failure.id}: ${failure.description}`);
    if (failure.error) {
      console.log(`   Error: ${failure.error}`);
    }
  }
}

/**
 * Display top performers
 */
function displayTopPerformers(report: EvaluationReport) {
  console.log(`\n${'-'.repeat(70)}`);
  console.log('🏆 Top 5 Fastest Queries');
  console.log('-'.repeat(70));

  const successful = report.detailedResults
    .filter((r) => r.success)
    .sort((a, b) => a.executionTime - b.executionTime)
    .slice(0, 5);

  successful.forEach((result, index) => {
    console.log(`\n${index + 1}. Query #${result.queryId}: ${result.description}`);
    console.log(`   ⏱️  ${result.executionTime}ms | 📁 ${result.outputFiles.length} files`);
  });
}

/**
 * Display insights and recommendations
 */
function displayInsights(report: EvaluationReport) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('💡 INSIGHTS & RECOMMENDATIONS');
  console.log('='.repeat(70));

  const { summary, byDifficulty } = report;

  // Overall assessment
  if (summary.successRate >= 90) {
    console.log('\n✨ Excellent! The agent performs very well across all tasks.');
  } else if (summary.successRate >= 75) {
    console.log('\n👍 Good performance with room for improvement.');
  } else if (summary.successRate >= 60) {
    console.log('\n⚠️  Moderate performance. Some tasks need attention.');
  } else {
    console.log('\n🔴 Low success rate. Significant improvements needed.');
  }

  // Difficulty analysis
  console.log('\n📊 Difficulty Analysis:');

  if (byDifficulty.easy && byDifficulty.easy.successRate < 90) {
    console.log('   ⚠️  Even easy tasks have failures - check basic functionality');
  }

  if (byDifficulty.expert && byDifficulty.expert.successRate > 50) {
    console.log('   ✨ Good handling of complex tasks!');
  }

  // Performance analysis
  console.log('\n⏱️  Performance Analysis:');
  if (summary.averageTime < 10000) {
    console.log('   ✅ Fast execution times');
  } else if (summary.averageTime < 20000) {
    console.log('   👍 Reasonable execution times');
  } else {
    console.log('   ⚠️  Slow execution - consider optimization');
  }

  // Recommendations
  console.log('\n🎯 Recommendations:');

  if (report.failedQueries.length > 0) {
    console.log('   1. Review failed queries and improve error handling');
  }

  if (summary.averageTime > 15000) {
    console.log('   2. Optimize code execution for better performance');
  }

  const lowCategories = Object.entries(report.byCategory)
    .filter(([_, data]: [string, any]) => data.successRate < 70)
    .map(([cat, _]) => cat);

  if (lowCategories.length > 0) {
    console.log(`   3. Focus on improving: ${lowCategories.join(', ')}`);
  }

  if (summary.successRate >= 85) {
    console.log('   4. Consider adding more complex test cases');
  }
}

/**
 * Generate ASCII progress bar
 */
function generateProgressBar(percentage: number, width = 30): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  let bar = '[';
  bar += '█'.repeat(filled);
  bar += '░'.repeat(empty);
  bar += ']';

  return bar;
}

/**
 * Get difficulty icon
 */
function getDifficultyIcon(difficulty: string): string {
  const icons: Record<string, string> = {
    easy: '🟢',
    medium: '🟡',
    hard: '🟠',
    expert: '🔴',
  };
  return icons[difficulty] || '⚪';
}

/**
 * Export results to markdown
 */
function exportToMarkdown(report: EvaluationReport) {
  const lines = [
    '# Sandbox Agent Evaluation Report',
    '',
    `**Generated**: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- **Total Queries**: ${report.summary.totalQueries}`,
    `- **Success Rate**: ${report.summary.successRate}%`,
    `- **Average Time**: ${report.summary.averageTime}ms`,
    `- **Files Generated**: ${report.summary.totalOutputFiles}`,
    '',
    '## Performance by Difficulty',
    '',
    '| Difficulty | Total | Success | Success Rate |',
    '|------------|-------|---------|--------------|',
  ];

  for (const [diff, data] of Object.entries(report.byDifficulty)) {
    lines.push(`| ${diff} | ${data.total} | ${data.success} | ${data.successRate}% |`);
  }

  lines.push('');
  lines.push('## Performance by Category');
  lines.push('');
  lines.push('| Category | Total | Success | Success Rate |');
  lines.push('|----------|-------|---------|--------------|');

  for (const [cat, data] of Object.entries(report.byCategory)) {
    lines.push(`| ${cat} | ${data.total} | ${data.success} | ${data.successRate}% |`);
  }

  if (report.failedQueries.length > 0) {
    lines.push('');
    lines.push('## Failed Queries');
    lines.push('');

    for (const failure of report.failedQueries) {
      lines.push(`- **#${failure.id}**: ${failure.description}`);
      if (failure.error) {
        lines.push(`  - Error: \`${failure.error}\``);
      }
    }
  }

  const mdPath = path.join(__dirname, 'evaluation-report.md');
  fs.writeFileSync(mdPath, lines.join('\n'));
  console.log(`\n📝 Markdown report saved to: ${mdPath}`);
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Analyzing Sandbox Agent Evaluation Results...\n');

  const report = loadReport();
  if (!report) {
    process.exit(1);
  }

  displaySummary(report);
  displayByDifficulty(report);
  displayByCategory(report);
  displayTopPerformers(report);
  displayFailedQueries(report);
  displayInsights(report);

  // Export to markdown
  exportToMarkdown(report);

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Analysis complete!');
  console.log(`${'='.repeat(70)}\n`);
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main as analyzeResults };
