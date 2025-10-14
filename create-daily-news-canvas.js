// 创建Daily AI News工作流画布的脚本
const fs = require('node:fs');
const path = require('node:path');

// 读取画布状态文件
const canvasState = fs.readFileSync(path.join(__dirname, 'canvas-state.json'), 'utf8');
const canvasData = JSON.parse(canvasState);

// 创建一个带有特定ID的画布
const dailyNewsCanvas = {
  canvasId: 'daily-ai-news-digest-workflow',
  title: 'Daily AI News Digest Workflow',
  state: canvasData,
  metadata: {
    isTemplate: true,
    templateType: 'daily-ai-news-digest',
    description:
      'Enhanced 8-step Daily AI News Digest workflow with Perplexity and Gmail integration',
  },
};

// 将画布数据写入临时文件
fs.writeFileSync(
  path.join(__dirname, 'daily-news-canvas-import.json'),
  JSON.stringify(dailyNewsCanvas, null, 2),
);

console.log('Daily AI News canvas created with ID: daily-ai-news-digest-workflow');
console.log('Canvas includes 8 workflow steps:');
canvasData.nodes.forEach((node, index) => {
  if (node.type === 'skillResponse' || node.type === 'start') {
    console.log(`${index + 1}. ${node.data.title}`);
  }
});
