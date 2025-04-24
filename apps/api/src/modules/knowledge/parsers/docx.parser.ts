import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { BaseParser, ParserOptions, ParseResult } from './base';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

@Injectable()
export class DocxParser extends BaseParser {
  private readonly logger = new Logger(DocxParser.name);

  name = 'docx';

  constructor(options: ParserOptions = {}) {
    super({
      format: 'markdown',
      timeout: 30000,
      extractMedia: true,
      ...options,
    });
  }

  private async createTempDir(): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandoc-'));
    return tempDir;
  }

  private async cleanupTempDir(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  private isWarning(stderr: string): boolean {
    return stderr.toLowerCase().includes('warning');
  }

  async parse(input: string | Buffer): Promise<ParseResult> {
    if (this.options.mockMode) {
      return {
        content: '', // 可以为空或包含文本预览
        buffer: Buffer.from('Mocked pandoc docx content'), // 存储二进制数据
        metadata: { format: 'docx' },
      };
    }

    const tempDir = await this.createTempDir();
    const outputFile = path.join(tempDir, 'output.docx');

    try {
      // 设置 pandoc 参数，从 markdown 转换为 docx
      const pandocArgs = ['-f', 'markdown', '-o', outputFile, '--standalone'];

      const pandoc = spawn('pandoc', pandocArgs);

      return new Promise((resolve, reject) => {
        let stderr = '';

        pandoc.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pandoc.on('close', async (code) => {
          try {
            // 处理 stderr 中的警告
            if (stderr) {
              if (this.isWarning(stderr)) {
                this.logger.warn(`Pandoc warning: ${stderr}`);
              } else if (code !== 0) {
                // 只有在实际错误（非警告）且进程失败时才拒绝
                reject(new Error(`Pandoc failed with code ${code}: ${stderr}`));
                return;
              }
            }

            // 读取生成的 docx 文件
            const docxBuffer = await fs.readFile(outputFile);
            resolve({
              content: '', // 可以为空或包含文本预览
              buffer: docxBuffer, // 存储二进制数据
              metadata: { format: 'docx' },
            });
          } finally {
            await this.cleanupTempDir(tempDir);
          }
        });

        pandoc.on('error', async (error) => {
          await this.cleanupTempDir(tempDir);
          reject(error);
        });

        // 处理超时
        const timeout = setTimeout(async () => {
          pandoc.kill();
          await this.cleanupTempDir(tempDir);
          reject(new Error(`Pandoc process timed out after ${this.options.timeout}ms`));
        }, this.options.timeout);

        pandoc.on('close', () => {
          clearTimeout(timeout);
        });

        // 将输入写入 stdin 并关闭它
        pandoc.stdin.write(input);
        pandoc.stdin.end();
      });
    } catch (error) {
      await this.cleanupTempDir(tempDir);
      throw error;
    }
  }
}
