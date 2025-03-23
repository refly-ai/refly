import * as childProcess from 'child_process';
import { Injectable, Logger } from '@nestjs/common';

/**
 * 用于检查和安装Trafilatura的辅助工具
 */
@Injectable()
export class TrafilaturaChecker {
  private readonly logger = new Logger(TrafilaturaChecker.name);
  private pythonCommand: string | null = null;

  /**
   * 检查Trafilatura是否已正确安装
   */
  async check(): Promise<boolean> {
    // 首先检测Python环境
    await this.detectPythonEnvironment();
    if (!this.pythonCommand) {
      this.logger.warn('未检测到Python环境，无法使用Trafilatura');
      return false;
    }

    // 然后检查Trafilatura
    const isInstalled = await this.checkTrafilaturaInstalled();
    if (!isInstalled) {
      this.logger.warn('Trafilatura未安装，尝试安装中...');
      const installed = await this.installTrafilatura();
      if (installed) {
        this.logger.log('Trafilatura安装成功！');
        return true;
      } else {
        this.logger.error('Trafilatura安装失败');
        return false;
      }
    }

    this.logger.log('Trafilatura检查完成，已正确安装');
    return true;
  }

  /**
   * 检测Python环境
   */
  private async detectPythonEnvironment(): Promise<void> {
    try {
      // 尝试python命令
      const pythonResult = childProcess.spawnSync('python', ['--version']);
      if (pythonResult.status === 0) {
        this.pythonCommand = 'python';
        this.logger.log(`检测到Python环境: ${pythonResult.stdout?.toString().trim() || 'python'}`);
        return;
      }
    } catch (error) {
      this.logger.debug('Python命令不可用');
    }

    try {
      // 尝试python3命令
      const python3Result = childProcess.spawnSync('python3', ['--version']);
      if (python3Result.status === 0) {
        this.pythonCommand = 'python3';
        this.logger.log(`检测到Python环境: ${python3Result.stdout?.toString().trim() || 'python3'}`);
        return;
      }
    } catch (error) {
      this.logger.debug('Python3命令不可用');
    }

    this.pythonCommand = null;
    this.logger.warn('未检测到可用的Python环境');
  }

  /**
   * 检查Trafilatura是否已安装
   */
  private async checkTrafilaturaInstalled(): Promise<boolean> {
    if (!this.pythonCommand) return false;

    try {
      const result = childProcess.spawnSync(this.pythonCommand, ['-m', 'trafilatura', '--version']);
      return result.status === 0;
    } catch (error) {
      this.logger.debug(`检查Trafilatura失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 安装Trafilatura
   */
  private async installTrafilatura(): Promise<boolean> {
    if (!this.pythonCommand) return false;

    return new Promise<boolean>((resolve) => {
      this.logger.log('开始安装Trafilatura...');
      
      const installProcess = childProcess.spawn(this.pythonCommand, [
        '-m', 'pip', 'install', 'trafilatura', '--user'
      ]);

      installProcess.stdout.on('data', (data) => {
        this.logger.debug(`安装输出: ${data}`);
      });

      installProcess.stderr.on('data', (data) => {
        this.logger.debug(`安装错误: ${data}`);
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          this.logger.log('Trafilatura安装成功');
          resolve(true);
        } else {
          this.logger.error(`Trafilatura安装失败，退出码: ${code}`);
          resolve(false);
        }
      });
    });
  }

  /**
   * 测试Trafilatura解析
   */
  async testParse(url: string): Promise<any> {
    if (!this.pythonCommand) {
      this.logger.error('Python环境不可用，无法测试');
      return null;
    }

    return new Promise<any>((resolve) => {
      const testProcess = childProcess.spawn(this.pythonCommand, [
        '-c',
        `
import sys
import json
try:
    import trafilatura
    url = "${url}"
    downloaded = trafilatura.fetch_url(url)
    if downloaded:
        result = trafilatura.extract(downloaded, output_format="json", with_metadata=True)
        print(result)
        sys.exit(0)
    else:
        print(json.dumps({"error": "Failed to download URL"}))
        sys.exit(1)
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
        `
      ]);

      let output = '';
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        this.logger.error(`测试错误: ${data}`);
      });

      testProcess.on('close', (code) => {
        if (code === 0 && output) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (e) {
            this.logger.error(`解析结果失败: ${e.message}`);
            resolve({ error: '无法解析输出', raw: output });
          }
        } else {
          resolve({ error: `测试失败，退出码: ${code}`, raw: output });
        }
      });
    });
  }
} 