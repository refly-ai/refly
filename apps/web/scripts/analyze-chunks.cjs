#!/usr/bin/env node

/**
 * Page dependency analysis tool
 *
 * Features:
 * 1. Analyze per-page dependencies (components and libraries).
 * 2. Compute page similarity (shared dependency ratio).
 * 3. Cluster pages automatically.
 * 4. Estimate grouping benefits (download reduction, cache hit rate).
 * 5. Output recommended chunk grouping hints.
 *
 * Usage:
 *   node analyze-chunks.js
 *
 * Output:
 *   - chunk-analysis-report.json: detailed data
 *   - chunk-optimization-report.md: human-readable report
 */

const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// ==================== Configuration ====================

const CONFIG = {
  // Pages directory
  pagesDir: path.join(__dirname, '../../../packages/web-core/src/pages'),

  // Import categories to analyze
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

  // Estimated page sizes (KB)
  estimatedSizes: {
    antd: 500,
    editor: 200,
    charts: 300,
    icons: 50,
    workspace: 150,
    utils: 30,
    react: 135,
    router: 25,
    pageCode: 50, // Average per-page code size
  },

  // User behavior model (page-to-page navigation frequency)
  // Higher values mean more frequent switches
  userBehavior: {
    'workspace-workflow': 0.8, // very frequent
    'workflow-app-marketplace': 0.6, // frequent
    'share-canvas-workspace': 0.3, // occasional
    'login-workspace': 0.5, // after login
    // ... tune based on real usage data
  },
};

// ==================== Utilities ====================

/**
 * Recursively collect all files.
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
 * Parse import statements in a file.
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
 * Analyze dependencies for a page.
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

  // Categorize dependencies
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

  // Compute estimated size
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
 * Analyze all pages.
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
 * Compute similarity between two pages (0-1).
 */
function calculateSimilarity(page1, page2) {
  const deps1 = page1.dependencies;
  const deps2 = page2.dependencies;

  let sharedCategories = 0;
  let totalCategories = 0;

  // Category-level similarity (higher weight)
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

  // Specific import similarity
  const allDeps1 = Object.values(deps1).flat();
  const allDeps2 = Object.values(deps2).flat();
  const set1 = new Set(allDeps1);
  const set2 = new Set(allDeps2);
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  const importSimilarity = union.size > 0 ? intersection.size / union.size : 0;

  // Combined similarity (category weight is higher)
  return categorySimilarity * 0.7 + importSimilarity * 0.3;
}

/**
 * Build similarity matrix.
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
        // Reuse computed values (symmetric matrix)
        matrix[name1][name2] = matrix[name2][name1];
      } else {
        matrix[name1][name2] = calculateSimilarity(pages[name1], pages[name2]);
      }
    }
  }

  return matrix;
}

/**
 * Group pages with hierarchical clustering.
 *
 * Algorithm: Agglomerative Hierarchical Clustering
 * 1. Start with each page as its own cluster.
 * 2. Repeatedly merge the closest clusters.
 * 3. Stop at target cluster count or similarity threshold.
 */
function hierarchicalClustering(pages, similarityMatrix, targetGroups = 5) {
  const pageNames = Object.keys(pages);

  // Initialize: each page is a cluster
  let clusters = pageNames.map((name) => ({
    pages: [name],
    centroid: name, // representative page
  }));

  // Clustering loop
  while (clusters.length > targetGroups) {
    let maxSimilarity = -1;
    let mergeIndices = [0, 1];

    // Find the closest clusters
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        // Compute cluster similarity via centroids
        const sim = similarityMatrix[clusters[i].centroid][clusters[j].centroid];

        if (sim > maxSimilarity) {
          maxSimilarity = sim;
          mergeIndices = [i, j];
        }
      }
    }

    // Merge clusters
    const [i, j] = mergeIndices;
    const newCluster = {
      pages: [...clusters[i].pages, ...clusters[j].pages],
      centroid: clusters[i].centroid, // keep the first centroid
    };

    // Update cluster list
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
 * Calculate grouping benefits.
 */
function calculateGroupingBenefit(pages, groups, _similarityMatrix) {
  const pageNames = Object.keys(pages);

  // Compute total size per group
  const groupSizes = groups.map((group) => {
    let totalSize = 0;
    const _sharedDeps = new Set();

    // Compute shared dependencies
    const allCategories = Object.keys(CONFIG.importPatterns);

    for (const category of allCategories) {
      const pagesUsingCategory = group.pages.filter(
        (pageName) => pages[pageName].dependencies[category].length > 0,
      );

      if (pagesUsingCategory.length > 0) {
        // At least one page uses this category
        totalSize += CONFIG.estimatedSizes[category] || 0;
      }
    }

    // Add page code size
    totalSize += group.pages.length * CONFIG.estimatedSizes.pageCode;

    return totalSize;
  });

  // Total download under user scenarios
  // Assumes users follow the behavior model

  // Scenario 1: visit all pages (worst case)
  const worstCaseDownload = groupSizes.reduce((sum, size) => sum + size, 0);

  // Scenario 2: stay within a group (best case)
  const bestCaseDownload = Math.min(...groupSizes);

  // Scenario 3: typical behavior (weighted average)
  let typicalDownload = 0;
  // Simplified: users visit 3 groups on average
  const avgGroupsVisited = Math.min(3, groups.length);
  typicalDownload = groupSizes
    .sort((a, b) => a - b)
    .slice(0, avgGroupsVisited)
    .reduce((sum, size) => sum + size, 0);

  // Cache efficiency (intra-group hit rate)
  let totalSwitches = 0;
  let cachedSwitches = 0;

  for (let i = 0; i < pageNames.length; i++) {
    for (let j = i + 1; j < pageNames.length; j++) {
      const page1 = pageNames[i];
      const page2 = pageNames[j];

      totalSwitches++;

      // Check if in the same group
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
 * Generate markdown report.
 */
function generateMarkdownReport(pages, groups, benefits, similarityMatrix) {
  let report = '# Page Chunk Grouping Optimization Report\n\n';
  report += `Generated at: ${new Date().toLocaleString()}\n\n`;

  // 1. Page analysis summary
  report += '## 📊 Page Summary\n\n';
  report += `- Total pages: ${Object.keys(pages).length}\n`;
  report += `- Recommended group count: ${groups.length}\n`;
  report += `- Cache hit rate: ${(benefits.cacheHitRate * 100).toFixed(1)}%\n`;
  report += `- Average group size: ${benefits.avgGroupSize.toFixed(0)} KB\n\n`;

  // 2. Per-page details
  report += '## 📄 Page Dependencies\n\n';
  report += '| Page | Estimated Size | Main Dependencies | Total Imports |\n';
  report += '|------|---------|---------|----------|\n';

  for (const [pageName, pageData] of Object.entries(pages)) {
    const mainDeps = Object.entries(pageData.dependencies)
      .filter(([_, deps]) => deps.length > 0)
      .map(([category, _]) => category)
      .join(', ');

    report += `| ${pageName} | ${pageData.estimatedSize} KB | ${mainDeps || '-'} | ${pageData.totalImports} |\n`;
  }
  report += '\n';

  // 3. Recommended groups
  report += '## 🎯 Recommended Grouping Strategy\n\n';

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupSize = benefits.groupSizes[i];

    report += `### Group ${i + 1}: \`group-${group.centroid}\`\n\n`;
    report += `**Pages**: ${group.pages.join(', ')}\n\n`;
    report += `**Estimated Size**: ${groupSize.toFixed(0)} KB\n\n`;

    // Shared deps within the group
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
      report += '**Shared Dependencies**:\n';
      for (const [category, count] of Object.entries(sharedDeps)) {
        const percentage = ((count / group.pages.length) * 100).toFixed(0);
        report += `- ${category}: ${count}/${group.pages.length} pages (${percentage}%)\n`;
      }
    }

    report += '\n';
  }

  // 4. Similarity matrix (heatmap data)
  report += '## 🔥 Page Similarity Matrix\n\n';
  report += '(Higher values indicate more shared dependencies between pages)\n\n';

  const pageNames = Object.keys(pages);

  // Header row
  report += '| Page |';
  for (const name of pageNames) {
    report += ` ${name} |`;
  }
  report += '\n';

  // Separator
  report += '|------|';
  for (const _ of pageNames) {
    report += '------|';
  }
  report += '\n';

  // Data rows
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

  // 5. Benefit analysis
  report += '## 💰 Benefit Analysis\n\n';
  report += '### Download Comparison\n\n';
  report += `- **Worst case** (all pages): ${benefits.worstCaseDownload.toFixed(0)} KB\n`;
  report += `- **Best case** (single group): ${benefits.bestCaseDownload.toFixed(0)} KB\n`;
  report += `- **Typical case** (3 groups): ${benefits.typicalDownload.toFixed(0)} KB\n\n`;

  report += '### Cache Efficiency\n\n';
  report += `- **Intra-group cache hit rate**: ${(benefits.cacheHitRate * 100).toFixed(1)}%\n`;
  report += '- No re-download needed when navigating within a group\n\n';

  // 6. Implementation suggestions
  report += '## 🚀 Implementation Suggestions\n\n';
  report += '### 1. Update `packages/web-core/src/index.ts`\n\n';
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

  report += '### 2. Configure rsbuild.config.ts\n\n';
  report += 'Use layered vendor config to split large libraries by group.\n\n';

  report += '### 3. Verify results\n\n';
  report += '```bash\n';
  report += 'ANALYZE=true pnpm build\n';
  report += 'ls -lh dist/static/js/ | grep group\n';
  report += '```\n\n';

  // 7. Notes
  report += '## ⚠️ Notes\n\n';
  report += '1. This report is based on static analysis and estimates; results may vary.\n';
  report += '2. Tune based on real user behavior data.\n';
  report += '3. Fully independent pages can be grouped separately.\n';
  report += '4. Re-run periodically as dependencies evolve.\n\n';

  return report;
}

// ==================== Main ====================

function main() {
  console.log('🔍 Starting page dependency analysis...\n');

  // 1. Analyze all pages
  const pages = analyzeAllPages();
  console.log(`\n✅ Analysis complete, ${Object.keys(pages).length} pages\n`);

  // 2. Build similarity matrix
  console.log('📊 Building similarity matrix...\n');
  const similarityMatrix = buildSimilarityMatrix(pages);

  // 3. Cluster grouping
  console.log('🎯 Clustering pages...\n');
  const targetGroups = 6; // adjustable
  const groups = hierarchicalClustering(pages, similarityMatrix, targetGroups);

  console.log(`✅ Grouping complete, ${groups.length} groups:\n`);
  groups.forEach((group, i) => {
    console.log(`  Group ${i + 1}: ${group.pages.join(', ')}`);
  });
  console.log();

  // 4. Compute benefits
  console.log('💰 Calculating benefits...\n');
  const benefits = calculateGroupingBenefit(pages, groups, similarityMatrix);

  console.log(`  Cache hit rate: ${(benefits.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`  Typical download: ${benefits.typicalDownload.toFixed(0)} KB\n`);

  // 5. Generate report
  console.log('📝 Generating report...\n');

  const jsonReport = {
    pages,
    groups,
    benefits,
    similarityMatrix,
    generatedAt: new Date().toISOString(),
  };

  const markdownReport = generateMarkdownReport(pages, groups, benefits, similarityMatrix);

  // Save report
  const jsonPath = path.join(__dirname, '../chunk-analysis-report.json');
  const mdPath = path.join(__dirname, '../CHUNK_OPTIMIZATION_REPORT.md');

  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
  fs.writeFileSync(mdPath, markdownReport);

  console.log('✅ Report generated:');
  console.log(`   - JSON: ${jsonPath}`);
  console.log(`   - Markdown: ${mdPath}\n`);

  console.log('🎉 Done! Check the report for details.\n');
}

// Execute
if (require.main === module) {
  main();
}

module.exports = {
  analyzeAllPages,
  buildSimilarityMatrix,
  hierarchicalClustering,
  calculateGroupingBenefit,
};
