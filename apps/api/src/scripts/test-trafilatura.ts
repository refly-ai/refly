#!/usr/bin/env node
/**
 * 测试JinaParser的简单脚本
 * 使用方法:
 * npm run build
 * node dist/apps/api/src/scripts/test-trafilatura.js
 */

import { JinaParser } from '../knowledge/parsers/jina.parser';

async function main() {
  console.log('===== 测试JinaParser =====');
  
  // 创建解析器实例，一个默认，一个强制使用Node
  console.log('创建解析器实例...');
  const jinaParser = new JinaParser();
  const jinaNodeParser = new JinaParser({ useNodeFallback: true });
  
  // 测试URL
  const url = 'https://github.blog/2019-03-29-leader-spotlight-erin-spiceland/';
  
  // 测试默认解析器
  console.log(`\n使用默认解析器解析: ${url}`);
  console.log('这将首先尝试使用Python/Trafilatura，如果不可用则回退到Node.js');
  try {
    const result = await jinaParser.parse(url);
    console.log('解析结果:');
    console.log('标题:', result.title);
    console.log('内容摘要:', result.content?.substring(0, 200) + '...');
    console.log('作者:', result.metadata?.author);
    console.log('日期:', result.metadata?.date);
    console.log('内容长度:', result.content?.length || 0, '字符');
  } catch (error) {
    console.error('解析失败:', error);
  }
  
  // 测试Node.js解析器
  console.log(`\n使用Node.js解析器解析: ${url}`);
  console.log('这将直接使用Node.js而不尝试Python/Trafilatura');
  try {
    const result = await jinaNodeParser.parse(url);
    console.log('解析结果:');
    console.log('标题:', result.title);
    console.log('内容摘要:', result.content?.substring(0, 200) + '...');
    console.log('作者:', result.metadata?.author);
    console.log('日期:', result.metadata?.date);
    console.log('内容长度:', result.content?.length || 0, '字符');
  } catch (error) {
    console.error('解析失败:', error);
  }
}

main().catch(console.error); 