import { Injectable, Logger } from '@nestjs/common';
import { BaseParser, ParserOptions, ParseResult } from './base';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip'; // Use default import for adm-zip

// Define specific options for MinerUParser
interface MinerUParserOptions extends ParserOptions {
  apiBase?: string;
  apiKey?: string;
  isOcr?: boolean;
  enableFormula?: boolean;
  enableTable?: boolean;
  layoutModel?: string;
  language?: string;
  maxPolls?: number;
  pollInterval?: number;
  callback?: string;
  seed?: string;
  extraFormats?: string[];
}

@Injectable()
export class MinerUParser extends BaseParser {
  name = 'mineru'; // Implement abstract property
  private readonly logger = new Logger(MinerUParser.name);
  private readonly apiBase: string;
  private readonly apiKey: string;
  private readonly isOcr: boolean;
  private readonly enableFormula: boolean;
  private readonly enableTable: boolean;
  private readonly layoutModel: string;
  private readonly language: string;
  private readonly maxPolls: number;
  private readonly pollInterval: number;
  private readonly callback?: string;
  private readonly seed?: string;
  private readonly extraFormats?: string[];

  // Use the specific options interface
  constructor(options: MinerUParserOptions = {}) {
    super(options); // Pass options to BaseParser constructor
    // Read config from options, providing defaults
    this.apiBase = options.apiBase ?? 'https://mineru.net/api/v4';
    this.apiKey = options.apiKey; // apiKey is now optional in the interface, required check below
    this.isOcr = options.isOcr ?? false;
    this.enableFormula = options.enableFormula ?? true;
    this.enableTable = options.enableTable ?? true;
    this.layoutModel = options.layoutModel ?? 'doclayout_yolo';
    this.language = options.language ?? 'auto';
    this.maxPolls = options.maxPolls ?? 30;
    this.pollInterval = options.pollInterval ?? 2000; // 2 seconds
    this.callback = options.callback;
    this.seed = options.seed;
    this.extraFormats = options.extraFormats;

    // Add check for required apiKey
    if (!this.apiKey) {
      throw new Error('MinerU API key is not configured');
    }
  }

  async parse(input: string | Buffer): Promise<ParseResult> {
    // Access mockMode via this.options inherited from BaseParser
    if (this.options.mockMode) {
      return {
        content: 'Mocked MinerU content',
        metadata: { source: this.name }, // Use name property
      };
    }

    try {
      let zipUrl: string;
      let targetFileName = 'document.pdf'; // Default filename for buffer input

      if (typeof input === 'string') { // Handle URL input
        const taskId = await this.submitUrlTask(input);
        const result = await this.pollTaskResult(taskId); // Poll single task
        if (!result.data?.full_zip_url) {
            throw new Error(`Polling result for task ${taskId} did not contain full_zip_url.`);
        }
        zipUrl = result.data.full_zip_url;
      } else { // Handle Buffer input (file upload)
        // 1. Get upload URL and batch ID
        const { uploadUrl, batchId, fileName } = await this.getUploadUrl(targetFileName);
        targetFileName = fileName; // Use the name returned/used in getUploadUrl

        // 2. Upload the file buffer
        await this.uploadFile(uploadUrl, input);

        // 3. Poll the batch result using batchId
        const batchResult = await this.pollBatchResult(batchId, targetFileName);
        if (!batchResult?.full_zip_url) {
            throw new Error(`Polling batch result for batch ${batchId} / file ${targetFileName} did not contain full_zip_url.`);
        }
        zipUrl = batchResult.full_zip_url;
      }

      // 4. Download, extract, and read markdown (common logic)
      const zipFilePath = await this.downloadZipFile(zipUrl);
      const extractedDir = await this.extractZipFile(zipFilePath);
      const markdownContent = await this.readMarkdownFile(extractedDir);

      // Clean up temporary files
      fs.unlinkSync(zipFilePath);
      fs.rmSync(extractedDir, { recursive: true, force: true });


      return {
        content: markdownContent,
        metadata: { source: this.name }, // Use name property
      };
    } catch (error) {
      this.logger.error(`MinerU parsing failed: ${error.message}`, error.stack);
      // Rethrow or handle specific MinerU errors based on error codes if needed
      throw new Error(`MinerU parsing failed: ${error.message}`);
    }
  }

  private async submitUrlTask(url: string): Promise<string> {
    const response = await axios.post(
      `${this.apiBase}/extract/task`,
      {
        url,
        is_ocr: this.isOcr,
        enable_formula: this.enableFormula,
        enable_table: this.enableTable,
        layout_model: this.layoutModel,
        language: this.language,
        callback: this.callback,
        seed: this.seed,
        extra_formats: this.extraFormats,
      },
      {
        headers: {
          // TODO: Verify the correct auth header with MinerU docs (e.g., 'Authorization': `Bearer ${this.apiKey}`)
          'Authorization': `Bearer ${this.apiKey}`,
        },
      },
    );

    if (response.status !== 200) {
      throw new Error(`Failed to submit URL task: ${response.statusText}`);
    }

    // API doc shows task_id is in response.data.task_id
    if (response.data?.code !== 0 || !response.data?.data?.task_id) {
        throw new Error(`Failed to submit URL task: API returned code ${response.data?.code}, msg: ${response.data?.msg}. Response: ${JSON.stringify(response.data)}`);
    }
    return response.data.data.task_id;
  }

  // Renamed from submitFileTask, now only gets the upload URL and batch ID
  private async getUploadUrl(fileName: string): Promise<{ uploadUrl: string; batchId: string; fileName: string }> {
    const requestBody = {
      enable_formula: this.enableFormula,
      enable_table: this.enableTable,
      layout_model: this.layoutModel,
      language: this.language,
      files: [
        {
          name: fileName, // Use provided filename
          is_ocr: this.isOcr,
          // data_id: this.options.resourceId // Optionally pass resourceId as data_id
        },
      ],
      callback: this.callback,
      seed: this.seed,
      extra_formats: this.extraFormats,
    };

    this.logger.debug(`Requesting file upload URL with body: ${JSON.stringify(requestBody)}`);

    const response = await axios.post(
      `${this.apiBase}/file-urls/batch`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    this.logger.debug(`Upload URL response status: ${response.status}, data: ${JSON.stringify(response.data)}`);

    if (response.status !== 200 || response.data?.code !== 0 || !response.data?.data?.file_urls?.[0] || !response.data?.data?.batch_id) {
      throw new Error(`Failed to get upload URL: API returned code ${response.data?.code}, msg: ${response.data?.msg}. Status: ${response.status}. Response: ${JSON.stringify(response.data)}`);
    }

    return {
        uploadUrl: response.data.data.file_urls[0],
        batchId: response.data.data.batch_id,
        fileName: fileName // Return the filename used
    };
  }

  // New method to upload the file
  private async uploadFile(uploadUrl: string, fileBuffer: Buffer): Promise<void> {
      this.logger.debug(`Uploading file to: ${uploadUrl}`);
      // MinerU docs say no Content-Type needed for PUT upload
      const response = await axios.put(uploadUrl, fileBuffer, {
          headers: {
              // Omit Content-Type based on documentation
          }
      });
      this.logger.debug(`Upload response status: ${response.status}`);
      if (response.status !== 200) {
          throw new Error(`Failed to upload file: PUT request returned status ${response.status}`);
      }
  }

  // Polls single task result
  private async pollTaskResult(taskId: string): Promise<any> {
      this.logger.debug(`Polling task result for taskId: ${taskId}`);
      for (let i = 0; i < this.maxPolls; i++) {
          const response = await axios.get(`${this.apiBase}/extract/task/${taskId}`, {
              headers: {
                  'Authorization': `Bearer ${this.apiKey}`,
              },
          });

          this.logger.debug(`Poll task response status: ${response.status}, data: ${JSON.stringify(response.data)}`);

          if (response.status !== 200 || response.data?.code !== 0) {
              // Consider retrying on transient errors? For now, fail fast.
              throw new Error(`Failed to poll task result: API returned code ${response.data?.code}, msg: ${response.data?.msg}. Status: ${response.status}. Response: ${JSON.stringify(response.data)}`);
          }

          const taskData = response.data.data;
          if (taskData?.state === 'done') {
              this.logger.log(`Task ${taskId} completed.`);
              return response.data; // Return the full response data structure
          } else if (taskData?.state === 'failed') {
              this.logger.error(`Task ${taskId} failed: ${taskData.err_msg}`);
              throw new Error(`MinerU task failed: ${taskData.err_msg || 'Unknown error'}`);
          } else {
              this.logger.debug(`Task ${taskId} status: ${taskData?.state}. Polling again in ${this.pollInterval}ms.`);
          }

          await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
      }

      this.logger.error(`Polling timeout for task ${taskId} after ${this.maxPolls} attempts.`);
      throw new Error('MinerU task polling timeout');
  }

  // New method to poll batch results
  private async pollBatchResult(batchId: string, targetFileName: string): Promise<any | null> {
      this.logger.debug(`Polling batch result for batchId: ${batchId}, targetFile: ${targetFileName}`);
      for (let i = 0; i < this.maxPolls; i++) {
          const response = await axios.get(`${this.apiBase}/extract-results/batch/${batchId}`, {
              headers: {
                  'Authorization': `Bearer ${this.apiKey}`,
              },
          });

          this.logger.debug(`Poll batch response status: ${response.status}, data: ${JSON.stringify(response.data)}`);

          if (response.status !== 200 || response.data?.code !== 0) {
              throw new Error(`Failed to poll batch result: API returned code ${response.data?.code}, msg: ${response.data?.msg}. Status: ${response.status}. Response: ${JSON.stringify(response.data)}`);
          }

          const results = response.data.data?.extract_result;
          if (!Array.isArray(results)) {
              this.logger.warn(`Batch ${batchId} result format unexpected. 'extract_result' not found or not an array.`);
              // Continue polling, maybe results appear later
          } else {
              const targetResult = results.find(r => r.file_name === targetFileName);

              if (targetResult) {
                  if (targetResult.state === 'done') {
                      this.logger.log(`File ${targetFileName} in batch ${batchId} completed.`);
                      return targetResult; // Return the specific file result
                  } else if (targetResult.state === 'failed') {
                      this.logger.error(`File ${targetFileName} in batch ${batchId} failed: ${targetResult.err_msg}`);
                      throw new Error(`MinerU file processing failed for ${targetFileName}: ${targetResult.err_msg || 'Unknown error'}`);
                  } else {
                      this.logger.debug(`File ${targetFileName} status: ${targetResult.state}. Polling batch again in ${this.pollInterval}ms.`);
                  }
              } else {
                   this.logger.debug(`File ${targetFileName} not found in batch ${batchId} results yet. Polling again.`);
              }
          }


          await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
      }

      this.logger.error(`Polling timeout for batch ${batchId} / file ${targetFileName} after ${this.maxPolls} attempts.`);
      throw new Error(`MinerU batch polling timeout for file ${targetFileName}`);
  }

  private async downloadZipFile(url: string): Promise<string> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    });

    if (response.status !== 200) {
      throw new Error(`Failed to download ZIP file: ${response.statusText}`);
    }

    // Use os temp directory for better isolation and cleanup
    const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mineru-'));
    const zipFilePath = path.join(tempDir, 'mineru_result.zip');
    fs.writeFileSync(zipFilePath, response.data);
    this.logger.debug(`Downloaded ZIP to: ${zipFilePath}`);

    return zipFilePath;
  }

  private async extractZipFile(zipFilePath: string): Promise<string> {
    const zip = new AdmZip(zipFilePath); // Assumes AdmZip is available
    const extractedDir = path.join(path.dirname(zipFilePath), 'extracted'); // Extract next to zip
    fs.mkdirSync(extractedDir, { recursive: true });
    zip.extractAllTo(extractedDir, /*overwrite*/ true);
    this.logger.debug(`Extracted ZIP contents to: ${extractedDir}`);

    return extractedDir;
  }

  private async readMarkdownFile(dir: string): Promise<string> {
    const files = fs.readdirSync(dir);
    const markdownFile = files.find((file) => file.endsWith('.md'));

    if (!markdownFile) {
      throw new Error('Markdown file not found in MinerU result');
    }

    const markdownFilePath = path.join(dir, markdownFile);
    return fs.readFileSync(markdownFilePath, 'utf8');
  }
}