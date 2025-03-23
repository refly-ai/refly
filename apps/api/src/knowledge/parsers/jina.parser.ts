import { Injectable, Logger } from '@nestjs/common';
import { BaseParser, ParserOptions, ParseResult } from './base';
import { promises as fs } from 'fs';
import { join } from 'path';
import { spawn, spawnSync } from 'child_process';
// 使用require避免类型检查问题
const axios = require('axios');
const cheerio = require('cheerio');

interface JinaOptions extends ParserOptions {
  apiKey?: string;
  apiUrl?: string;
  useNodeFallback?: boolean; // 是否使用Node.js的备选方案
}

@Injectable()
export class JinaParser extends BaseParser {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly pythonScriptPath: string;
  private readonly useNodeFallback: boolean;
  private readonly logger = new Logger(JinaParser.name);
  private pythonCommand: string = 'python'; // 默认python命令

  name = 'jina';

  constructor(options: JinaOptions = {}) {
    super(options);
    this.apiKey = options.apiKey;
    this.apiUrl = options.apiUrl ?? 'https://r.jina.ai/';
    this.pythonScriptPath = join(__dirname, '../../../scripts/extract_web_content.py');
    this.useNodeFallback = options.useNodeFallback ?? false;
    
    // 初始化时检测Python环境
    this.detectPythonEnvironment();
  }

  /**
   * 检测Python环境，确定正确的Python命令
   */
  private detectPythonEnvironment(): void {
    try {
      // 尝试python命令
      const pythonResult = spawnSync('python', ['--version']);
      if (pythonResult.status === 0) {
        this.pythonCommand = 'python';
        this.logger.log('使用python命令');
        return;
      }
    } catch (error) {
      this.logger.warn('python命令不可用，尝试python3命令');
    }

    try {
      // 尝试python3命令
      const python3Result = spawnSync('python3', ['--version']);
      if (python3Result.status === 0) {
        this.pythonCommand = 'python3';
        this.logger.log('使用python3命令');
        return;
      }
    } catch (error) {
      this.logger.warn('python3命令不可用');
    }

    this.logger.warn('未找到可用的Python环境，将使用Node.js备选方案');
  }

  /**
   * 检查Trafilatura是否已安装
   */
  private async checkTrafilaturaInstalled(): Promise<boolean> {
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
      this.logger.error(`检查Trafilatura安装失败: ${error.message}`);
      return false;
    }
  }

  async ensureTrafilaturaScript(): Promise<boolean> {
    const scriptDir = join(__dirname, '../../../scripts');
    const scriptPath = this.pythonScriptPath;
    
    // 检查Python环境
    if (this.pythonCommand === 'python' || this.pythonCommand === 'python3') {
      // 检查Trafilatura是否已安装
      const isTrafilaturaInstalled = await this.checkTrafilaturaInstalled();
      if (!isTrafilaturaInstalled) {
        this.logger.warn('Trafilatura未安装，尝试自动安装...');
        
        try {
          // 尝试安装Trafilatura
          const installResult = spawnSync(this.pythonCommand, ['-m', 'pip', 'install', 'trafilatura']);
          if (installResult.status !== 0) {
            this.logger.error(`安装Trafilatura失败: ${installResult.stderr.toString()}`);
            return false;
          }
          this.logger.log('Trafilatura安装成功');
        } catch (error) {
          this.logger.error(`安装Trafilatura出错: ${error.message}`);
          return false;
        }
      }
    } else {
      this.logger.warn('Python环境不可用，无法使用Trafilatura');
      return false;
    }
    
    try {
      await fs.access(scriptPath);
    } catch (error) {
      // 如果脚本不存在，创建目录和脚本
      try {
        await fs.mkdir(scriptDir, { recursive: true });
      } catch (mkdirError) {
        // 如果目录已存在，忽略错误
      }

      const scriptContent = `
import sys
import json
from urllib.parse import urlparse
import traceback

try:
    import trafilatura
except ImportError:
    print(json.dumps({
        "error": "Trafilatura is not installed. Please install with 'pip install trafilatura'."
    }))
    sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "URL parameter is required"
        }))
        sys.exit(1)
    
    url = sys.argv[1]
    
    try:
        # 验证URL格式
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            print(json.dumps({
                "error": f"Invalid URL format: {url}"
            }))
            sys.exit(1)
            
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

      await fs.writeFile(scriptPath, scriptContent);
    }
    
    return true;
  }

  // 使用cheerio和axios的Node.js解析方法
  async parseWithNode(url: string): Promise<ParseResult> {
    try {
      this.logger.log(`使用Node.js解析网页内容: ${url}`);
      
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
      this.logger.error(`Node.js解析网页内容失败: ${error.message}`);
      return this.handleError(error);
    }
  }

  async parse(input: string | Buffer): Promise<ParseResult> {
    if (this.options.mockMode) {
      return {
        content: 'Mocked jina content',
        metadata: { source: 'jina' },
      };
    }

    const url = input.toString();

    // 如果设置了强制使用Node.js的备选方案，直接使用Node.js解析
    if (this.useNodeFallback) {
      this.logger.log(`强制使用Node.js解析网页内容: ${url}`);
      return this.parseWithNode(url);
    }

    try {
      // 尝试设置和检查Python环境
      const isPythonReady = await this.ensureTrafilaturaScript();
      
      // 如果Python环境不可用，使用Node.js备选方案
      if (!isPythonReady) {
        this.logger.warn(`Python环境不可用，使用Node.js备选方案解析: ${url}`);
        return this.parseWithNode(url);
      }
      
      this.logger.log(`使用Python/Trafilatura解析网页内容: ${url}`);
      
      return new Promise((resolve, reject) => {
        const process = spawn(this.pythonCommand, [this.pythonScriptPath, url]);
        
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
            this.logger.warn(`Python进程退出，代码 ${code}: ${errorData}，尝试使用Node.js备选方案`);
            // 如果Python脚本执行失败，尝试使用Node.js备选方案
            return resolve(await this.parseWithNode(url));
          }
          
          try {
            const result = JSON.parse(outputData);
            
            if (result.error) {
              this.logger.warn(`Python脚本返回错误: ${result.error}，尝试使用Node.js备选方案`);
              // 如果Python脚本返回错误，尝试使用Node.js备选方案
              return resolve(await this.parseWithNode(url));
            }
            
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
            this.logger.warn(`解析Python脚本输出失败: ${error.message}，尝试使用Node.js备选方案`);
            // 如果解析Python脚本输出失败，尝试使用Node.js备选方案
            return resolve(await this.parseWithNode(url));
          }
        });
      });
    } catch (error) {
      this.logger.warn(`调用Python脚本失败: ${error.message}，尝试使用Node.js备选方案`);
      // 如果调用Python脚本失败，尝试使用Node.js备选方案
      return this.parseWithNode(url);
    }
  }
}
