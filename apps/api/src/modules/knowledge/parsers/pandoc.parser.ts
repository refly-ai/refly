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

  /**
   * Clean up excessively long separator lines (e.g., -----, =====, _____)
   * These can occur when Pandoc converts certain table or formatting elements
   */
  private cleanupLongSeparators(content: string): string {
    // Replace any sequence of 50+ repeated separator characters with a reasonable length
    // Matches: ---, ===, ___, ~~~, ***, etc.
    return content.replace(/(-{50,}|={50,}|_{50,}|~{50,}|\*{50,})/g, (match) => {
      // Keep only first 3 characters (standard markdown separator)
      return match[0].repeat(3);
    });
  }

  private convertGridTablesToPipeTables(content: string): string {
    // Convert grid tables to pipe tables for better frontend compatibility
    const lines = content.split('\n');
    const result: string[] = [];
    let inTable = false;
    let tableRows: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect table start/end
      if (line.match(/^\+[-=+]+\+/)) {
        if (inTable && tableRows.length > 0) {
          // End of table - convert accumulated rows
          result.push(...this.convertGridTableRows(tableRows));
          tableRows = [];
        }
        inTable = !inTable;
        continue;
      }

      if (inTable && line.startsWith('|')) {
        // This is a table row
        tableRows.push(line);
      } else {
        if (inTable && tableRows.length > 0) {
          // Table ended, convert rows
          result.push(...this.convertGridTableRows(tableRows));
          tableRows = [];
          inTable = false;
        }
        result.push(line);
      }
    }

    // Handle table at end of content
    if (inTable && tableRows.length > 0) {
      result.push(...this.convertGridTableRows(tableRows));
    }

    return result.join('\n');
  }

  private convertGridTableRows(rows: string[]): string[] {
    if (rows.length === 0) return [];

    const pipeRows: string[] = [];
    let isFirstRow = true;

    for (const row of rows) {
      if (row.trim() === '') continue;

      // Convert grid table row to pipe table row
      const cells = row.split('|').slice(1, -1); // Remove first and last empty elements
      const cleanCells = cells.map((cell) => cell.trim());
      const pipeRow = `| ${cleanCells.join(' | ')} |`;

      pipeRows.push(pipeRow);

      // Add separator after first row (header)
      if (isFirstRow) {
        const separator = `| ${cleanCells.map(() => '---').join(' | ')} |`;
        pipeRows.push(separator);
        isFirstRow = false;
      }
    }

    return pipeRows;
  }

  private async checkPandocAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const pandoc = spawn('pandoc', ['--version']);

      pandoc.on('close', (code) => {
        resolve(code === 0);
      });

      pandoc.on('error', () => {
        resolve(false);
      });
    });
  }

  async parse(input: string | Buffer): Promise<ParseResult> {
    if (this.options.mockMode) {
      return {
        content: 'Mocked pandoc content',
        metadata: { format: this.options.format },
      };
    }

    // Check if pandoc is available
    const pandocAvailable = await this.checkPandocAvailable();
    if (!pandocAvailable) {
      const errorMessage =
        'Pandoc is not installed or not available in PATH. Please install pandoc to process DOCX files.';
      this.logger.error(errorMessage);
      return {
        content: '',
        error: errorMessage,
        metadata: { format: this.options.format },
      };
    }

    const tempDir = await this.createTempDir();
    const mediaDir = path.join(tempDir, 'media');

    try {
      // Try different approaches for better table extraction
      let pandocArgs: string[];

      if (this.options.format === 'docx') {
        // For DOCX, try markdown output with pipe tables first
        pandocArgs = [
          '-f',
          this.options.format,
          '-t',
          'markdown+pipe_tables',
          '--wrap=none',
          '--columns=100000', // Very wide columns to prevent text wrapping
        ];
      } else {
        // For other formats, use markdown
        pandocArgs = [
          '-f',
          this.options.format,
          '-t',
          'markdown-raw_html+pipe_tables',
          '--wrap=none',
          '--columns=10000',
        ];
      }

      // For DOCX files, add specific table-handling options
      if (this.options.format === 'docx') {
        pandocArgs.push('--preserve-tabs');
        pandocArgs.push('--markdown-headings=atx');
      }

      // Only add extract-media option if enabled
      if (this.options.extractMedia) {
        pandocArgs.push('--extract-media', tempDir);
      }

      this.logger.debug(`Running pandoc with args: ${pandocArgs.join(' ')}`);
      const pandoc = spawn('pandoc', pandocArgs);

      return new Promise((resolve, _reject) => {
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
                this.logger.error(`Pandoc failed with code ${code}: ${stderr}`);
                resolve({
                  content: '',
                  error: `Pandoc conversion failed: ${stderr}`,
                  metadata: { format: this.options.format },
                });
                return;
              }
            }

            // Post-process the content for better table handling if needed
            let processedContent = stdout;

            // Check for DOCX table placeholders
            if (this.options.format === 'docx' && stdout.includes('[TABLE]')) {
              this.logger.warn(
                'DOCX contains [TABLE] placeholders - tables may not be properly extracted',
              );
            }

            // Convert grid tables to pipe tables for better compatibility
            if (this.options.format === 'docx') {
              const hasTableBorders = /\+[-=+]+\+/.test(stdout);
              if (hasTableBorders) {
                this.logger.debug('Converting grid tables to pipe tables for better compatibility');
                processedContent = this.convertGridTablesToPipeTables(stdout);
              }
            }

            // Clean up excessively long separator lines (50+ chars)
            processedContent = this.cleanupLongSeparators(processedContent);

            // Only process images if extractMedia is enabled
            const images = this.options.extractMedia ? await this.readImagesFromDir(mediaDir) : {};

            this.logger.debug(
              `Pandoc conversion successful, content length: ${processedContent.length}`,
            );
            resolve({
              content: processedContent,
              images,
              metadata: { format: this.options.format },
            });
          } finally {
            await this.cleanupTempDir(tempDir);
          }
        });

        pandoc.on('error', async (error) => {
          await this.cleanupTempDir(tempDir);
          this.logger.error(`Pandoc process error: ${error.message}`);
          resolve({
            content: '',
            error: `Pandoc process failed: ${error.message}`,
            metadata: { format: this.options.format },
          });
        });

        // Handle timeout
        const timeout = setTimeout(async () => {
          pandoc.kill();
          await this.cleanupTempDir(tempDir);
          this.logger.error(`Pandoc process timed out after ${this.options.timeout}ms`);
          resolve({
            content: '',
            error: `Pandoc process timed out after ${this.options.timeout}ms`,
            metadata: { format: this.options.format },
          });
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
      this.logger.error(`Pandoc parser error: ${error.message}`);
      return {
        content: '',
        error: `Pandoc parser failed: ${error.message}`,
        metadata: { format: this.options.format },
      };
    }
  }
}
