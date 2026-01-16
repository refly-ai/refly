#!/usr/bin/env node

/**
 * 页面依赖分析工具
 *
 * 功能：
 * 1. 分析每个页面的依赖关系（导入了哪些组件、库）
 * 2. 计算页面间的相似度（共享依赖的比例）
 * 3. 使用聚类算法自动分组
 * 4. 计算每种分组策略的收益（减少下载量、缓存命中率）
 * 5. 生成最优的 chunk 分组建议
 *
 * 使用方法：
 *   node analyze-chunks.js
 *
 * 输出：
 *   - chunk-analysis-report.json：详细数据
 *   - chunk-optimization-report.md：人类可读的报告
 */

const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// ==================== 配置 ====================

const CONFIG = {
  // 页面目录
  pagesDir: path.join(__dirname, '../packages/web-core/src/pages'),

  // 要分析的导入类型
  importPatterns: {
    antd: /^(antd|@ant-design|rc-)/,
    editor: /^(monaco-editor|@monaco-editor|codemirror)/,
    charts: /^(echarts|@antv|d3-|recharts)/,
    icons: /^(@ant-design\/icons|lucide-react|react-icons|refly-icons)/,
    workspace: /^(@refly|@refly-packages)\/(ai-workspace-common|ui-kit|stores|layout)/,
    utils: /^(lodash|dayjs|axios|qs|uuid|ms)/,
    react: /^(react|react-dom|scheduler)/,
    router: /^(react-router|@remix-run)/,
  },

  // 页面预估体积（KB）
  estimatedSizes: {
    antd: 500,
    editor: 200,
    charts: 300,
    icons: 50,
    workspace: 150,
    utils: 30,
    react: 135,
    router: 25,
    pageCode: 50, // 单个页面代码平均体积
  },

  // 用户行为模式（页面之间的跳转频率）
  // 数值越高表示用户越频繁在这两个页面之间切换
  userBehavior: {
    'workspace-workflow': 0.8, // 非常频繁
    'workflow-app-marketplace': 0.6, // 比较频繁
    'share-canvas-workspace': 0.3, // 偶尔
    'login-workspace': 0.5, // 登录后进入
    // ... 可以根据实际用户数据调整
  },
};

// ==================== 工具函数 ====================

/**
 * 递归查找所有文件
 */
function findAllFiles(dir, extensions = ['.tsx', '.ts', '.jsx', '.js']) {
  const files = [];

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * 解析文件中的 import 语句
 */
function parseImports(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const imports = [];

    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        imports.push(source);
      },
    });

    return imports;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return [];
  }
}

/**
 * 分析页面的依赖
 */
function analyzePage(pageDir) {
  const files = findAllFiles(pageDir);
  const allImports = new Set();

  for (const file of files) {
    const imports = parseImports(file);
    for (const imp of imports) {
      allImports.add(imp);
    }
  }

  // 分类依赖
  const dependencies = {
    antd: [],
    editor: [],
    charts: [],
    icons: [],
    workspace: [],
    utils: [],
    react: [],
    router: [],
    others: [],
  };

  for (const imp of allImports) {
    let matched = false;

    for (const [category, pattern] of Object.entries(CONFIG.importPatterns)) {
      if (pattern.test(imp)) {
        dependencies[category].push(imp);
        matched = true;
        break;
      }
    }

    if (!matched) {
      dependencies.others.push(imp);
    }
  }

  // 计算预估体积
  let estimatedSize = CONFIG.estimatedSizes.pageCode;

  for (const [category, imports] of Object.entries(dependencies)) {
    if (imports.length > 0 && CONFIG.estimatedSizes[category]) {
      estimatedSize += CONFIG.estimatedSizes[category];
    }
  }

  return {
    dependencies,
    estimatedSize,
    totalImports: allImports.size,
  };
}

/**
 * 分析所有页面
 */
function analyzeAllPages() {
  const pagesDir = CONFIG.pagesDir;

  if (!fs.existsSync(pagesDir)) {
    console.error(`Pages directory not found: ${pagesDir}`);
    process.exit(1);
  }

  const pageEntries = fs.readdirSync(pagesDir, { withFileTypes: true });
  const pages = {};

  for (const entry of pageEntries) {
    if (entry.isDirectory()) {
      const pageName = entry.name;
      const pageDir = path.join(pagesDir, pageName);

      console.log(`Analyzing page: ${pageName}...`);
      pages[pageName] = analyzePage(pageDir);
    }
  }

  return pages;
}

/**
 * 计算两个页面之间的相似度（0-1）
 */
function calculateSimilarity(page1, page2) {
  const deps1 = page1.dependencies;
  const deps2 = page2.dependencies;

  let sharedCategories = 0;
  let totalCategories = 0;

  // 计算分类级别的相似度（权重更高）
  for (const category of Object.keys(CONFIG.importPatterns)) {
    const has1 = deps1[category].length > 0;
    const has2 = deps2[category].length > 0;

    if (has1 || has2) {
      totalCategories++;
      if (has1 && has2) {
        sharedCategories++;
      }
    }
  }

  const categorySimilarity = totalCategories > 0 ? sharedCategories / totalCategories : 0;

  // 计算具体导入的相似度
  const allDeps1 = Object.values(deps1).flat();
  const allDeps2 = Object.values(deps2).flat();
  const set1 = new Set(allDeps1);
  const set2 = new Set(allDeps2);
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  const importSimilarity = union.size > 0 ? intersection.size / union.size : 0;

  // 综合相似度（分类相似度权重更高）
  return categorySimilarity * 0.7 + importSimilarity * 0.3;
}

/**
 * 构建相似度矩阵
 */
function buildSimilarityMatrix(pages) {
  const pageNames = Object.keys(pages);
  const matrix = {};

  for (let i = 0; i < pageNames.length; i++) {
    const name1 = pageNames[i];
    matrix[name1] = {};

    for (let j = 0; j < pageNames.length; j++) {
      const name2 = pageNames[j];

      if (i === j) {
        matrix[name1][name2] = 1.0;
      } else if (j < i) {
        // 复用已计算的值（对称矩阵）
        matrix[name1][name2] = matrix[name2][name1];
      } else {
        matrix[name1][name2] = calculateSimilarity(pages[name1], pages[name2]);
      }
    }
  }

  return matrix;
}

/**
 * 使用层次聚类算法对页面分组
 *
 * 算法：Agglomerative Hierarchical Clustering
 * 1. 开始时每个页面是一个独立的簇
 * 2. 重复合并最相似的两个簇
 * 3. 直到达到目标簇数量或相似度阈值
 */
function hierarchicalClustering(pages, similarityMatrix, targetGroups = 5) {
  const pageNames = Object.keys(pages);

  // 初始化：每个页面是一个簇
  let clusters = pageNames.map((name) => ({
    pages: [name],
    centroid: name, // 代表页面
  }));

  // 聚类过程
  while (clusters.length > targetGroups) {
    let maxSimilarity = -1;
    let mergeIndices = [0, 1];

    // 找到最相似的两个簇
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        // 计算两个簇之间的相似度（使用质心）
        const sim = similarityMatrix[clusters[i].centroid][clusters[j].centroid];

        if (sim > maxSimilarity) {
          maxSimilarity = sim;
          mergeIndices = [i, j];
        }
      }
    }

    // 合并簇
    const [i, j] = mergeIndices;
    const newCluster = {
      pages: [...clusters[i].pages, ...clusters[j].pages],
      centroid: clusters[i].centroid, // 保留第一个簇的质心
    };

    // 更新簇列表
    clusters = [
      ...clusters.slice(0, i),
      ...clusters.slice(i + 1, j),
      ...clusters.slice(j + 1),
      newCluster,
    ];
  }

  return clusters;
}

/**
 * 计算分组策略的收益
 */
function calculateGroupingBenefit(pages, groups, _similarityMatrix) {
  const pageNames = Object.keys(pages);

  // 计算每个组的总体积
  const groupSizes = groups.map((group) => {
    let totalSize = 0;
    const _sharedDeps = new Set();

    // 计算共享依赖
    const allCategories = Object.keys(CONFIG.importPatterns);

    for (const category of allCategories) {
      const pagesUsingCategory = group.pages.filter(
        (pageName) => pages[pageName].dependencies[category].length > 0,
      );

      if (pagesUsingCategory.length > 0) {
        // 至少有一个页面使用这个分类的依赖
        totalSize += CONFIG.estimatedSizes[category] || 0;
      }
    }

    // 加上页面代码
    totalSize += group.pages.length * CONFIG.estimatedSizes.pageCode;

    return totalSize;
  });

  // 计算用户场景下的总下载量
  // 假设用户按照某种模式访问页面

  // 场景1：用户访问所有页面（最坏情况）
  const worstCaseDownload = groupSizes.reduce((sum, size) => sum + size, 0);

  // 场景2：用户只访问组内页面（最好情况）
  const bestCaseDownload = Math.min(...groupSizes);

  // 场景3：典型用户行为（加权平均）
  let typicalDownload = 0;
  // 简化计算：假设用户平均访问 3 个不同的组
  const avgGroupsVisited = Math.min(3, groups.length);
  typicalDownload = groupSizes
    .sort((a, b) => a - b)
    .slice(0, avgGroupsVisited)
    .reduce((sum, size) => sum + size, 0);

  // 计算缓存效率（组内页面切换时的缓存命中率）
  let totalSwitches = 0;
  let cachedSwitches = 0;

  for (let i = 0; i < pageNames.length; i++) {
    for (let j = i + 1; j < pageNames.length; j++) {
      const page1 = pageNames[i];
      const page2 = pageNames[j];

      totalSwitches++;

      // 检查是否在同一组
      const inSameGroup = groups.some(
        (group) => group.pages.includes(page1) && group.pages.includes(page2),
      );

      if (inSameGroup) {
        cachedSwitches++;
      }
    }
  }

  const cacheHitRate = totalSwitches > 0 ? cachedSwitches / totalSwitches : 0;

  return {
    groupCount: groups.length,
    groupSizes,
    worstCaseDownload,
    bestCaseDownload,
    typicalDownload,
    cacheHitRate,
    avgGroupSize: groupSizes.reduce((sum, size) => sum + size, 0) / groups.length,
  };
}

/**
 * 生成 Markdown 报告
 */
function generateMarkdownReport(pages, groups, benefits, similarityMatrix) {
  let report = '# 页面 Chunk 分组优化报告\n\n';
  report += `生成时间: ${new Date().toLocaleString()}\n\n`;

  // 1. 页面分析概览
  report += '## 📊 页面分析概览\n\n';
  report += `- 总页面数: ${Object.keys(pages).length}\n`;
  report += `- 推荐分组数: ${groups.length}\n`;
  report += `- 缓存命中率: ${(benefits.cacheHitRate * 100).toFixed(1)}%\n`;
  report += `- 平均组体积: ${benefits.avgGroupSize.toFixed(0)} KB\n\n`;

  // 2. 每个页面的详细信息
  report += '## 📄 页面依赖详情\n\n';
  report += '| 页面 | 预估体积 | 主要依赖 | 导入总数 |\n';
  report += '|------|---------|---------|----------|\n';

  for (const [pageName, pageData] of Object.entries(pages)) {
    const mainDeps = Object.entries(pageData.dependencies)
      .filter(([_, deps]) => deps.length > 0)
      .map(([category, _]) => category)
      .join(', ');

    report += `| ${pageName} | ${pageData.estimatedSize} KB | ${mainDeps || '-'} | ${pageData.totalImports} |\n`;
  }
  report += '\n';

  // 3. 推荐的分组
  report += '## 🎯 推荐的分组策略\n\n';

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupSize = benefits.groupSizes[i];

    report += `### Group ${i + 1}: \`group-${group.centroid}\`\n\n`;
    report += `**包含页面**: ${group.pages.join(', ')}\n\n`;
    report += `**预估体积**: ${groupSize.toFixed(0)} KB\n\n`;

    // 计算组内页面的共享依赖
    const sharedDeps = {};

    for (const category of Object.keys(CONFIG.importPatterns)) {
      const pagesUsingCategory = group.pages.filter(
        (pageName) => pages[pageName].dependencies[category].length > 0,
      );

      if (pagesUsingCategory.length > 0) {
        sharedDeps[category] = pagesUsingCategory.length;
      }
    }

    if (Object.keys(sharedDeps).length > 0) {
      report += '**共享依赖**:\n';
      for (const [category, count] of Object.entries(sharedDeps)) {
        const percentage = ((count / group.pages.length) * 100).toFixed(0);
        report += `- ${category}: ${count}/${group.pages.length} 页面使用 (${percentage}%)\n`;
      }
    }

    report += '\n';
  }

  // 4. 相似度矩阵（热力图数据）
  report += '## 🔥 页面相似度矩阵\n\n';
  report += '（数值越高表示两个页面共享的依赖越多）\n\n';

  const pageNames = Object.keys(pages);

  // 表头
  report += '| 页面 |';
  for (const name of pageNames) {
    report += ` ${name} |`;
  }
  report += '\n';

  // 分隔线
  report += '|------|';
  for (const _ of pageNames) {
    report += '------|';
  }
  report += '\n';

  // 数据行
  for (const name1 of pageNames) {
    report += `| **${name1}** |`;
    for (const name2 of pageNames) {
      const sim = similarityMatrix[name1][name2];
      const color = sim > 0.7 ? '🔴' : sim > 0.4 ? '🟡' : '🟢';
      report += ` ${color} ${sim.toFixed(2)} |`;
    }
    report += '\n';
  }
  report += '\n';

  // 5. 收益分析
  report += '## 💰 收益分析\n\n';
  report += '### 下载量对比\n\n';
  report += `- **最坏情况**（访问所有页面）: ${benefits.worstCaseDownload.toFixed(0)} KB\n`;
  report += `- **最好情况**（只访问单组）: ${benefits.bestCaseDownload.toFixed(0)} KB\n`;
  report += `- **典型情况**（访问 3 个组）: ${benefits.typicalDownload.toFixed(0)} KB\n\n`;

  report += '### 缓存效率\n\n';
  report += `- **组内页面切换缓存命中率**: ${(benefits.cacheHitRate * 100).toFixed(1)}%\n`;
  report += '- 用户在组内页面切换时，无需重新下载依赖\n\n';

  // 6. 实施建议
  report += '## 🚀 实施建议\n\n';
  report += '### 1. 修改 `packages/web-core/src/index.ts`\n\n';
  report += '```typescript\n';
  report += 'import { lazy } from "react";\n\n';

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupName = `group-${group.centroid}`;

    report += `// Group ${i + 1}: ${groupName}\n`;
    for (const pageName of group.pages) {
      const componentName = `${pageName
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('')}Page`;
      report += `export const ${componentName} = lazy(\n`;
      report += `  () => import(/* webpackChunkName: "${groupName}" */ './pages/${pageName}'),\n`;
      report += ');\n';
    }
    report += '\n';
  }

  report += '```\n\n';

  report += '### 2. 配置 rsbuild.config.ts\n\n';
  report += '使用文档中的分层 vendor 配置，让大型库也按组分离。\n\n';

  report += '### 3. 验证效果\n\n';
  report += '```bash\n';
  report += 'ANALYZE=true pnpm build\n';
  report += 'ls -lh dist/static/js/ | grep group\n';
  report += '```\n\n';

  // 7. 注意事项
  report += '## ⚠️ 注意事项\n\n';
  report += '1. 本报告基于静态分析和预估数据，实际效果可能有偏差\n';
  report += '2. 建议结合实际用户行为数据进行微调\n';
  report += '3. 某些页面如果完全独立使用，可以单独成组\n';
  report += '4. 定期重新运行分析，因为页面依赖可能会变化\n\n';

  return report;
}

// ==================== 主函数 ====================

function main() {
  console.log('🔍 开始分析页面依赖...\n');

  // 1. 分析所有页面
  const pages = analyzeAllPages();
  console.log(`\n✅ 分析完成，共 ${Object.keys(pages).length} 个页面\n`);

  // 2. 构建相似度矩阵
  console.log('📊 构建页面相似度矩阵...\n');
  const similarityMatrix = buildSimilarityMatrix(pages);

  // 3. 聚类分组
  console.log('🎯 使用聚类算法进行分组...\n');
  const targetGroups = 6; // 可调整
  const groups = hierarchicalClustering(pages, similarityMatrix, targetGroups);

  console.log(`✅ 分组完成，共 ${groups.length} 个组:\n`);
  groups.forEach((group, i) => {
    console.log(`  Group ${i + 1}: ${group.pages.join(', ')}`);
  });
  console.log();

  // 4. 计算收益
  console.log('💰 计算优化收益...\n');
  const benefits = calculateGroupingBenefit(pages, groups, similarityMatrix);

  console.log(`  缓存命中率: ${(benefits.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`  典型下载量: ${benefits.typicalDownload.toFixed(0)} KB\n`);

  // 5. 生成报告
  console.log('📝 生成报告...\n');

  const jsonReport = {
    pages,
    groups,
    benefits,
    similarityMatrix,
    generatedAt: new Date().toISOString(),
  };

  const markdownReport = generateMarkdownReport(pages, groups, benefits, similarityMatrix);

  // 保存报告
  const jsonPath = path.join(__dirname, '../chunk-analysis-report.json');
  const mdPath = path.join(__dirname, '../CHUNK_OPTIMIZATION_REPORT.md');

  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
  fs.writeFileSync(mdPath, markdownReport);

  console.log('✅ 报告已生成:');
  console.log(`   - JSON: ${jsonPath}`);
  console.log(`   - Markdown: ${mdPath}\n`);

  console.log('🎉 分析完成！请查看报告了解详细信息。\n');
}

// 执行
if (require.main === module) {
  main();
}

module.exports = {
  analyzeAllPages,
  buildSimilarityMatrix,
  hierarchicalClustering,
  calculateGroupingBenefit,
};
