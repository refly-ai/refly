#!/usr/bin/env node
/**
 * Trafilatura CLI工具
 * 用于测试Trafilatura的安装和使用
 * 
 * 使用方法:
 * npm run build
 * node dist/apps/api/src/knowledge/parsers/trafilatura-cli.js check
 * node dist/apps/api/src/knowledge/parsers/trafilatura-cli.js parse https://example.com
 */

import { TrafilaturaChecker } from './trafilatura.checker';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const checker = new TrafilaturaChecker();

  if (!command) {
    console.log('请指定命令: check 或 parse <url>');
    process.exit(1);
  }

  // 设置日志输出
  console.log('===== Trafilatura CLI =====');
  
  try {
    if (command === 'check') {
      console.log('检查Trafilatura安装...');
      const installed = await checker.check();
      console.log(`Trafilatura状态: ${installed ? '已安装' : '未安装'}`);
      process.exit(installed ? 0 : 1);
      
    } else if (command === 'parse') {
      const url = args[1];
      if (!url) {
        console.log('请提供要解析的URL');
        process.exit(1);
      }
      
      console.log(`正在解析URL: ${url}`);
      const installed = await checker.check();
      if (!installed) {
        console.error('Trafilatura未安装，无法解析');
        process.exit(1);
      }
      
      const result = await checker.testParse(url);
      console.log('解析结果:');
      console.log(JSON.stringify(result, null, 2));
      
    } else {
      console.log(`未知命令: ${command}`);
      console.log('可用命令: check, parse <url>');
      process.exit(1);
    }
  } catch (error) {
    console.error('执行过程中发生错误:');
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error); 