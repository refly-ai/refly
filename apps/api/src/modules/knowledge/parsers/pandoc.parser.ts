import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { BaseParser, ParserOptions, ParseResult } from './base';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

@Injectable()
export class PandocParser extends BaseParser {
  private readonly logger = new Logger(PandocParser.name);

  name = 'pandoc';

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

  private async readImagesFromDir(mediaDir: string): Promise<Record<string, Buffer>> {
    const images: Record<string, Buffer> = {};
    try {
      const files = await fs.readdir(mediaDir);
      for (const file of files) {
        const filePath = path.join(mediaDir, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          const buffer = await fs.readFile(filePath);
          images[path.join(mediaDir, file)] = buffer;
        }
      }
    } catch {
      // If media directory doesn't exist or can't be read, return empty images object
    }
    return images;
  }

  private isWarning(stderr: string): boolean {
    return stderr.toLowerCase().includes('warning');
  }

  async parse(input: string | Buffer): Promise<ParseResult> {
    if (this.options.mockMode) {
      return {
        content: 'Mocked pandoc content',
        metadata: { format: this.options.format },
      };
    }

    const tempDir = await this.createTempDir();
    const mediaDir = path.join(tempDir, 'media');

    try {
      const pandocArgs = ['-f', this.options.format, '-t', 'commonmark-raw_html', '--wrap=none'];

      // Only add extract-media option if enabled
      if (this.options.extractMedia) {
        pandocArgs.push('--extract-media', tempDir);
      }

      const pandoc = spawn('pandoc', pandocArgs);

      return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        pandoc.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pandoc.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pandoc.on('close', async (code) => {
          try {
            // Handle warnings in stderr
            if (stderr) {
              if (this.isWarning(stderr)) {
                this.logger.warn(`Pandoc warning: ${stderr}`);
              } else if (code !== 0) {
                // Only reject if it's an actual error (not a warning) and the process failed
                reject(new Error(`Pandoc failed with code ${code}: ${stderr}`));
                return;
              }
            }

            // Only process images if extractMedia is enabled
            const images = this.options.extractMedia ? await this.readImagesFromDir(mediaDir) : {};

            resolve({
              content: stdout,
              images,
              metadata: { format: this.options.format },
            });
          } finally {
            await this.cleanupTempDir(tempDir);
          }
        });

        pandoc.on('error', async (error) => {
          await this.cleanupTempDir(tempDir);
          reject(error);
        });

        // Handle timeout
        const timeout = setTimeout(async () => {
          pandoc.kill();
          await this.cleanupTempDir(tempDir);
          reject(new Error(`Pandoc process timed out after ${this.options.timeout}ms`));
        }, this.options.timeout);

        pandoc.on('close', () => {
          clearTimeout(timeout);
        });

        // Write input to stdin and close it
        pandoc.stdin.write(input);
        pandoc.stdin.end();
      });
    } catch (error) {
      await this.cleanupTempDir(tempDir);
      return this.handleError(error);
    }
  }
}
