#!/usr/bin/env node
/**
 * 使用Node.js直接测试JinaParser
 * 这个脚本不依赖TypeScript编译，可以直接运行
 */

const axios = require('axios');
const cheerio = require('cheerio');
const spawn = require('child_process').spawn;
const spawnSync = require('child_process').spawnSync;
const fs = require('fs').promises;
const path = require('path');

// 定义颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// 简化的JinaParser类
class JinaParser {
  constructor(options = {}) {
    this.name = 'jina';
    this.options = options;
    this.useNodeFallback = options.useNodeFallback || false;
    this.mockMode = options.mockMode || false;
    this.pythonCommand = 'python';
    this.pythonScriptPath = path.join(__dirname, '../scripts/extract_web_content.py');
  }

  async parse(url) {
    console.log(`${colors.blue}开始解析URL: ${url}${colors.reset}`);
    
    if (this.mockMode) {
      console.log(`${colors.yellow}使用模拟模式${colors.reset}`);
      return {
        content: 'Mocked jina content',
        metadata: { source: 'jina' },
      };
    }

    // 如果强制使用Node.js，直接使用Node.js解析
    if (this.useNodeFallback) {
      console.log(`${colors.yellow}强制使用Node.js解析${colors.reset}`);
      return this.parseWithNode(url);
    }

    try {
      // 尝试使用Python/Trafilatura
      console.log(`${colors.blue}尝试使用Python/Trafilatura解析...${colors.reset}`);
      const isPythonReady = await this.ensureTrafilaturaScript();
      
      if (!isPythonReady) {
        console.log(`${colors.yellow}Python环境不可用，使用Node.js备选方案${colors.reset}`);
        return this.parseWithNode(url);
      }
      
      return new Promise((resolve, reject) => {
        console.log(`${colors.blue}运行Python脚本: ${this.pythonScriptPath}${colors.reset}`);
        
        // 创建临时脚本用于测试
        const tempScriptContent = `
import sys
import json
import traceback

try:
    import trafilatura
except ImportError:
    print(json.dumps({
        "error": "Trafilatura is not installed. Please install with 'pip install trafilatura'."
    }))
    sys.exit(1)

def main():
    url = "${url}"
    
    try:
        # 下载和提取内容
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            print(json.dumps({
                "error": f"Failed to download content from URL: {url}"
            }))
            sys.exit(1)
            
        # 提取内容
        result = trafilatura.extract(downloaded, output_format='json', with_metadata=True, include_links=True)
        if not result:
            print(json.dumps({
                "error": f"Failed to extract content from URL: {url}"
            }))
            sys.exit(1)
            
        # 解析JSON结果
        result_obj = json.loads(result)
        
        # 返回提取的内容
        response = {
            "title": result_obj.get("title", ""),
            "content": result_obj.get("text", ""),
            "author": result_obj.get("author", ""),
            "date": result_obj.get("date", ""),
            "url": url
        }
        print(json.dumps(response))
        
    except Exception as e:
        print(json.dumps({
            "error": f"Exception: {str(e)}\\n{traceback.format_exc()}"
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
    sys.stdout.flush()
`;

        const process = spawn(this.pythonCommand, ['-c', tempScriptContent]);
        
        let outputData = '';
        let errorData = '';
        
        process.stdout.on('data', (data) => {
          outputData += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          errorData += data.toString();
        });
        
        process.on('close', async (code) => {
          if (code !== 0) {
            console.log(`${colors.red}Python进程退出，代码 ${code}:${colors.reset}`);
            console.log(errorData);
            console.log(`${colors.yellow}尝试使用Node.js备选方案${colors.reset}`);
            // 如果Python脚本执行失败，尝试使用Node.js备选方案
            return resolve(await this.parseWithNode(url));
          }
          
          try {
            const result = JSON.parse(outputData);
            
            if (result.error) {
              console.log(`${colors.red}Python脚本返回错误:${colors.reset} ${result.error}`);
              console.log(`${colors.yellow}尝试使用Node.js备选方案${colors.reset}`);
              // 如果Python脚本返回错误，尝试使用Node.js备选方案
              return resolve(await this.parseWithNode(url));
            }
            
            console.log(`${colors.green}Python/Trafilatura解析成功${colors.reset}`);
            return resolve({
              title: result.title,
              content: result.content,
              metadata: { 
                source: 'jina', 
                author: result.author,
                date: result.date,
                url: result.url
              },
            });
          } catch (error) {
            console.log(`${colors.red}解析Python脚本输出失败:${colors.reset} ${error.message}`);
            console.log(`${colors.yellow}尝试使用Node.js备选方案${colors.reset}`);
            // 如果解析Python脚本输出失败，尝试使用Node.js备选方案
            return resolve(await this.parseWithNode(url));
          }
        });
      });
    } catch (error) {
      console.log(`${colors.red}调用Python脚本失败:${colors.reset} ${error.message}`);
      console.log(`${colors.yellow}尝试使用Node.js备选方案${colors.reset}`);
      // 如果调用Python脚本失败，尝试使用Node.js备选方案
      return this.parseWithNode(url);
    }
  }

  // 使用cheerio和axios的Node.js解析方法
  async parseWithNode(url) {
    try {
      console.log(`${colors.blue}使用Node.js (cheerio + axios) 解析网页内容${colors.reset}`);
      
      // 使用axios获取网页内容
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });
      
      const html = response.data;
      const $ = cheerio.load(html);
      
      // 移除不需要的元素
      $('script, style, noscript, iframe, nav, footer, header, [role="banner"], [role="navigation"], .navigation, .menu, .sidebar, .footer, .header, .ads, .ad, .advertisements, .advertisement, [id*="banner"], [class*="banner"], [id*="ad"], [class*="ad"], aside, [role="complementary"]').remove();
      
      // 尝试找到标题
      const title = $('meta[property="og:title"]').attr('content') || 
                   $('meta[name="twitter:title"]').attr('content') || 
                   $('title').text() || '';
      
      // 尝试提取作者
      const author = $('meta[property="og:article:author"]').attr('content') || 
                    $('meta[name="author"]').attr('content') || 
                    $('meta[name="twitter:creator"]').attr('content') || '';
      
      // 尝试提取日期
      const date = $('meta[property="article:published_time"]').attr('content') || 
                  $('meta[property="og:article:published_time"]').attr('content') || '';
      
      // 尝试找到主要内容
      let content = '';
      
      // 尝试找到文章主体内容 - 常见文章容器选择器
      const selectors = [
        'article', '.article', '.post', '.entry', '.content', '[itemprop="articleBody"]',
        'main', '.main', '#content', '#main', '.body', '.entry-content',
        '[role="main"]', '[property="articleBody"]', '.post-content', '.story'
      ];
      
      // 尝试所有可能的内容容器
      for (const selector of selectors) {
        const element = $(selector);
        if (element.length > 0) {
          // 从找到的容器中提取段落文本
          const paragraphs = element.find('p, h1, h2, h3, h4, h5, h6').map((_, el) => $(el).text().trim()).get();
          if (paragraphs.length > 0) {
            content = paragraphs.join('\n\n');
            break;
          }
        }
      }
      
      // 如果没有找到任何内容，则退回到收集所有段落
      if (!content || content.length < 100) {
        const paragraphs = $('p').map((_, el) => $(el).text().trim()).get();
        content = paragraphs.join('\n\n');
      }
      
      // 如果仍然没有足够的内容，尝试获取所有可见文本
      if (!content || content.length < 100) {
        content = $('body').text().replace(/\s+/g, ' ').trim();
      }
      
      console.log(`${colors.green}Node.js解析成功${colors.reset}`);
      return {
        title,
        content,
        metadata: {
          source: 'jina',
          author,
          date,
          url,
        },
      };
    } catch (error) {
      console.log(`${colors.red}Node.js解析失败:${colors.reset} ${error.message}`);
      return this.handleError(error);
    }
  }

  async detectPythonEnvironment() {
    try {
      // 尝试python命令
      const pythonResult = spawnSync('python', ['--version']);
      if (pythonResult.status === 0) {
        this.pythonCommand = 'python';
        console.log(`${colors.green}使用python命令${colors.reset}`);
        return;
      }
    } catch (error) {
      console.log(`${colors.yellow}python命令不可用，尝试python3命令${colors.reset}`);
    }

    try {
      // 尝试python3命令
      const python3Result = spawnSync('python3', ['--version']);
      if (python3Result.status === 0) {
        this.pythonCommand = 'python3';
        console.log(`${colors.green}使用python3命令${colors.reset}`);
        return;
      }
    } catch (error) {
      console.log(`${colors.yellow}python3命令不可用${colors.reset}`);
    }

    console.log(`${colors.red}未找到可用的Python环境${colors.reset}`);
    this.pythonCommand = null;
  }

  async checkTrafilaturaInstalled() {
    if (!this.pythonCommand) return false;

    try {
      const result = spawnSync(this.pythonCommand, [
        '-c', 
        'try: import trafilatura; print("ok") \nexcept ImportError: print("not-installed")'
      ]);

      if (result.status === 0) {
        const output = result.stdout.toString().trim();
        return output === 'ok';
      }
      return false;
    } catch (error) {
      console.log(`${colors.red}检查Trafilatura安装失败:${colors.reset} ${error.message}`);
      return false;
    }
  }

  async ensureTrafilaturaScript() {
    await this.detectPythonEnvironment();
    
    // 检查Python环境
    if (this.pythonCommand) {
      // 检查Trafilatura是否已安装
      const isTrafilaturaInstalled = await this.checkTrafilaturaInstalled();
      if (isTrafilaturaInstalled) {
        console.log(`${colors.green}Trafilatura已安装${colors.reset}`);
        return true;
      } else {
        console.log(`${colors.yellow}Trafilatura未安装${colors.reset}`);
        return false;
      }
    } else {
      console.log(`${colors.red}Python环境不可用${colors.reset}`);
      return false;
    }
  }

  handleError(error) {
    return {
      content: '',
      error: error.message,
    };
  }
}

// 主函数
async function main() {
  console.log(`${colors.cyan}===== 测试JinaParser =====\n${colors.reset}`);
  
  // 测试URL
  const url = 'https://github.blog/2019-03-29-leader-spotlight-erin-spiceland/';
  
  // 创建两个解析器实例
  console.log(`${colors.blue}创建解析器实例...${colors.reset}`);
  const jinaParser = new JinaParser();
  const jinaNodeParser = new JinaParser({ useNodeFallback: true });
  
  // 测试默认解析器
  console.log(`\n${colors.cyan}=== 测试默认解析器 ===${colors.reset}`);
  console.log('这将首先尝试使用Python/Trafilatura，如果不可用则回退到Node.js');
  try {
    const result = await jinaParser.parse(url);
    console.log('\n解析结果:');
    console.log(`标题: ${result.title}`);
    console.log(`内容摘要: ${result.content?.substring(0, 200)}...`);
    console.log(`作者: ${result.metadata?.author}`);
    console.log(`日期: ${result.metadata?.date}`);
    console.log(`内容长度: ${result.content?.length || 0} 字符`);
  } catch (error) {
    console.error(`${colors.red}解析失败:${colors.reset} ${error}`);
  }
  
  console.log('\n-----------------------------------\n');
  
  // 测试Node.js解析器
  console.log(`${colors.cyan}=== 测试Node.js解析器 ===${colors.reset}`);
  console.log('这将直接使用Node.js而不尝试Python/Trafilatura');
  try {
    const result = await jinaNodeParser.parse(url);
    console.log('\n解析结果:');
    console.log(`标题: ${result.title}`);
    console.log(`内容摘要: ${result.content?.substring(0, 200)}...`);
    console.log(`作者: ${result.metadata?.author}`);
    console.log(`日期: ${result.metadata?.date}`);
    console.log(`内容长度: ${result.content?.length || 0} 字符`);
  } catch (error) {
    console.error(`${colors.red}解析失败:${colors.reset} ${error}`);
  }
}

main().catch(console.error); 