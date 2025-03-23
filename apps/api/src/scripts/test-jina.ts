/**
 * 测试JinaParser
 * 用法:
 * 1. 首先构建项目: pnpm build:api
 * 2. 运行: node dist/apps/api/src/scripts/test-jina.js
 */

import { JinaParser } from '../knowledge/parsers/jina.parser';
import { Logger } from '@nestjs/common';

// 创建一个简单的日志记录器
const logger = new Logger('TestJinaParser');

async function main() {
  logger.log('===== JinaParser测试 =====');
  
  // 测试URL
  const url = 'https://github.blog/2019-03-29-leader-spotlight-erin-spiceland/';
  
  // 创建解析器实例，一个默认，一个强制使用Node
  logger.log('创建解析器实例...');
  const jinaParser = new JinaParser();
  const jinaNodeParser = new JinaParser({ useNodeFallback: true });
  
  // 测试默认解析器
  logger.log(`\n测试默认解析器 (URL: ${url})`);
  logger.log('这将优先使用Python/Trafilatura，如果不可用则回退到Node.js');
  try {
    const startTime = Date.now();
    const result = await jinaParser.parse(url);
    const endTime = Date.now();
    
    logger.log(`解析完成，耗时: ${endTime - startTime}ms`);
    logger.log('解析结果:');
    logger.log(`标题: ${result.title || '无标题'}`);
    logger.log(`内容摘要: ${result.content?.substring(0, 200)}...`);
    logger.log(`作者: ${result.metadata?.author || '未知'}`);
    logger.log(`日期: ${result.metadata?.date || '未知'}`);
    logger.log(`内容长度: ${result.content?.length || 0} 字符`);
  } catch (error) {
    logger.error(`解析失败: ${error}`);
  }
  
  logger.log('\n-----------------------------------\n');
  
  // 测试Node.js解析器
  logger.log(`\n测试Node.js解析器 (URL: ${url})`);
  logger.log('这将直接使用Node.js而不尝试Python/Trafilatura');
  try {
    const startTime = Date.now();
    const result = await jinaNodeParser.parse(url);
    const endTime = Date.now();
    
    logger.log(`解析完成，耗时: ${endTime - startTime}ms`);
    logger.log('解析结果:');
    logger.log(`标题: ${result.title || '无标题'}`);
    logger.log(`内容摘要: ${result.content?.substring(0, 200)}...`);
    logger.log(`作者: ${result.metadata?.author || '未知'}`);
    logger.log(`日期: ${result.metadata?.date || '未知'}`);
    logger.log(`内容长度: ${result.content?.length || 0} 字符`);
  } catch (error) {
    logger.error(`解析失败: ${error}`);
  }
}

// 确保在非CI环境下直接运行
if (require.main === module) {
  main().catch(err => {
    logger.error(`测试过程中出错: ${err}`);
    process.exit(1);
  });
} 