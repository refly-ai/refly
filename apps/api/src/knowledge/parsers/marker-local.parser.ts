// apps/api/src/knowledge/parsers/marker-local.parser.ts
import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import { readdir } from 'fs/promises';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { BaseParser, ParserOptions, ParseResult } from './base';

// Re-define or import MarkerLocalCliConfig if needed, assuming structure from plan
interface MarkerLocalCliConfig {
  // --- 显式定义的字段 ---
  output_format: 'markdown' | 'json' | 'html';
  device?: 'cpu' | 'cuda'; // 用于控制 TORCH_DEVICE 环境变量 (仅支持 cpu 和 cuda)
  use_llm?: boolean;
  force_ocr?: boolean;
  languages?: string; // Comma-separated
  llm_service?: string; // e.g., "gemini", "ollama", "openai" - 需要映射
  executable_path?: string; // 特殊处理
  page_range?: string;
  disable_image_extraction?: boolean;
  debug?: boolean;

  // --- 通用命令行选项 ---
  cli_options?: Record<string, string | boolean | number>; // 用于传递其他 marker_single 参数
}

@Injectable()
export class MarkerLocalParser extends BaseParser {
  private readonly logger = new Logger(MarkerLocalParser.name);
  readonly name = 'marker-local-cli';

  constructor(
    // Inject config service or pass config directly if preferred
    private readonly markerConfig: MarkerLocalCliConfig,
    options: ParserOptions = {},
  ) {
    super(options);
    this.logger.log(
      `Initialized MarkerLocalParser with config: ${JSON.stringify(
        markerConfig,
      )}`,
    );
  }

  async parse(input: string | Buffer): Promise<ParseResult> {
    const tempDir = path.join(os.tmpdir(), `marker-local-${uuidv4()}`);
    const uniqueBaseName = uuidv4(); // Generate unique base name
    let inputFilePath: string;
    const outputDir = path.join(tempDir, 'output');
    let outputFilePath: string | null = null;

    try {
      await fs.mkdir(tempDir, { recursive: true });
      await fs.mkdir(outputDir, { recursive: true });
      this.logger.debug(`Created temporary directory: ${tempDir}`);

      let inputFilename: string;
      if (Buffer.isBuffer(input)) {
        // Assume PDF if buffer, needs a filename
        inputFilename = `${uniqueBaseName}.pdf`;
        inputFilePath = path.join(tempDir, inputFilename);
        await fs.writeFile(inputFilePath, input);
        this.logger.debug(`Wrote buffer to temporary input file: ${inputFilePath}`);
      } else {
        // Assume input is already a valid file path
        inputFilePath = input;
        inputFilename = path.basename(inputFilePath);
        // Optionally copy to temp dir if needed, but marker_single can read from original path
        this.logger.debug(`Using existing file as input: ${inputFilePath}`);
      }

      // Determine expected output filename based on unique base name and format
      const outputExtension = this.markerConfig.output_format || 'md'; // Default to md if somehow missing
      const outputFilename = `${uniqueBaseName}.${outputExtension}`;
      outputFilePath = path.join(outputDir, outputFilename);

      const args: string[] = [
        inputFilePath,
        '--output_dir', outputDir,
        '--output_format', this.markerConfig.output_format,
      ];

      if (this.markerConfig.use_llm) {
        args.push('--use_llm');
        if (this.markerConfig.llm_service) {
           // Map simple service names to full Python class paths required by marker_single
           const serviceMap: Record<string, string> = {
               gemini: 'marker.services.gemini.GoogleGeminiService',
               ollama: 'marker.services.ollama.OllamaService',
               openai: 'marker.services.openai.OpenAIService',
               // Add other potential services here if needed in the future
           };

           const fullServicePath = serviceMap[this.markerConfig.llm_service.toLowerCase()];

           if (fullServicePath) {
               args.push(`--llm_service=${fullServicePath}`);
               this.logger.debug(`Mapped llm_service '${this.markerConfig.llm_service}' to '${fullServicePath}'`);
           } else {
               this.logger.warn(`Unsupported llm_service specified: '${this.markerConfig.llm_service}'. Falling back to marker default.`);
               // Optionally, don't push --use_llm if the service is unsupported?
               // Or let marker handle the unknown service? Current approach lets marker handle it.
           }
        }
      }
      if (this.markerConfig.force_ocr) {
        args.push('--force_ocr');
      }
      if (this.markerConfig.languages) {
        args.push('--languages', this.markerConfig.languages);
      }
      if (this.markerConfig.page_range) {
        args.push('--page_range', this.markerConfig.page_range);
      }
      if (this.markerConfig.disable_image_extraction) {
        args.push('--disable_image_extraction');
      }
      if (this.markerConfig.debug) {
        args.push('--debug'); // or '-d' if preferred by marker_single
      }
      // Process generic cli_options from config
      if (this.markerConfig.cli_options) {
        for (const [key, value] of Object.entries(this.markerConfig.cli_options)) {
           // Convert snake_case key to command line argument (--snake_case)
           const argKey = `--${key}`;
          if (value === true) {
            // Check for conflicts with explicitly handled boolean flags
            const explicitBoolKeys = ['use_llm', 'force_ocr', 'disable_image_extraction', 'debug'];
            if (explicitBoolKeys.includes(key)) {
              this.logger.warn(`[MarkerLocal] cli_option '${key}' conflicts with explicitly handled parameter. Using explicit value.`);
              continue; // Skip adding from cli_options
            }
            args.push(argKey);
          } else if (typeof value === 'string' || typeof value === 'number') {
             // Check for conflicts with explicitly handled key-value flags
            const explicitKeyValueKeys = ['languages', 'llm_service', 'page_range', 'output_format', 'output_dir'];
             if (explicitKeyValueKeys.includes(key)) {
              this.logger.warn(`[MarkerLocal] cli_option '${key}' conflicts with explicitly handled parameter. Using explicit value.`);
              continue; // Skip adding from cli_options
            }
            args.push(argKey, String(value));
          } else if (value === false || value === null || value === undefined) {
            // Ignore false/null/undefined values
          } else {
            this.logger.warn(`[MarkerLocal] Unsupported value type for cli_option '${key}': ${typeof value}. Skipping.`);
          }
        }
      }

      // Explicitly use the path within the Conda environment from DockerfileV1
      const command = this.markerConfig.executable_path || '/opt/conda/envs/py310/bin/marker_single';
      const fullCommand = `${command} ${args.join(' ')}`;
      this.logger.debug(`[MarkerLocal] Executing command: ${fullCommand}`);
      this.logger.debug(
        `[MarkerLocal] Input file: ${inputFilePath}, Output file: ${outputFilePath}`,
      );

      // --- 设置环境变量 (特别是 TORCH_DEVICE) ---
      const spawnEnv = { ...process.env }; // Copy current environment
      const targetDevice = this.markerConfig.device || 'cpu'; // Default to 'cpu' if not specified

      // Only set TORCH_DEVICE if 'cuda' is explicitly requested
      if (targetDevice === 'cuda') {
        spawnEnv['TORCH_DEVICE'] = 'cuda';
        this.logger.debug('[MarkerLocal] Setting TORCH_DEVICE=cuda for marker_single process.');
      } else { // 'cpu' or unspecified
        // No need to set TORCH_DEVICE, PyTorch default or auto-detection will handle CPU
        this.logger.debug('[MarkerLocal] Using default TORCH_DEVICE (CPU).');
      }
      // --- 环境变量设置结束 ---

      const execution = new Promise<void>((resolve, reject) => {
        const process = spawn(command, args, { stdio: 'pipe', env: spawnEnv }); // Pass env to spawn

        let stdoutData = '';
        let stderrData = '';

        let timeoutId: NodeJS.Timeout | null = null;
        const cleanupListeners = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            process.stdout?.removeAllListeners();
            process.stderr?.removeAllListeners();
            process.removeAllListeners('error');
            process.removeAllListeners('close');
        };

        // Add timeout logic
        const timeoutMs = this.options.timeout || 300000; // Default 5 minutes
        timeoutId = setTimeout(() => {
            this.logger.error(`[MarkerLocal] Process timed out after ${timeoutMs}ms. Killing process.`);
            process.kill('SIGKILL'); // Force kill on timeout
            cleanupListeners();
            reject(new Error(`Marker process timed out after ${timeoutMs}ms.`));
        }, timeoutMs);


        process.stdout?.on('data', (data) => {
          const output = data.toString();
          stdoutData += output;
          this.logger.debug(`marker_single stdout: ${output.trim()}`); // Log chunk
        });

        process.stderr?.on('data', (data) => {
          const errorOutput = data.toString();
          stderrData += errorOutput;
          this.logger.warn(`marker_single stderr: ${errorOutput.trim()}`); // Log chunk
        });

        process.on('error', (err) => {
          this.logger.error(
            `Failed to start marker_single process: ${err.message}`,
            err.stack,
          );
          cleanupListeners();
          reject(new Error(`Failed to start marker_single: ${err.message}`));
        });

        process.on('close', (code) => {
          cleanupListeners(); // Clear timeout and listeners on close
          this.logger.debug(`marker_single process exited with code ${code}`);
          if (stdoutData)
            this.logger.debug(`marker_single stdout:\n${stdoutData}`);

          // 确保记录完整的 stderr，并根据退出码调整日志级别
          if (stderrData) {
            if (code !== 0) {
              this.logger.error(
                `[MarkerLocal] marker_single stderr (Exit Code ${code}):\n${stderrData}`,
              );
            } else {
              this.logger.warn(
                `[MarkerLocal] marker_single stderr (Exit Code ${code}):\n${stderrData}`,
              );
            }
          }

          if (code === 0) {
            resolve();
          } else {
            let errorMessage = `marker_single process exited with error code ${code}.`;
            if (stderrData) {
              errorMessage += ` Stderr: ${stderrData}`;
            }
            // Check for common errors in stderr
            if (
              stderrData.includes('command not found') ||
              stderrData.includes('No such file or directory')
            ) {
              errorMessage += ` Is 'marker_single' (or configured path) installed and in PATH?`;
            }
            if (stderrData.includes('ImportError')) {
              errorMessage += ` Check Python environment and marker dependencies.`;
            }
            if (stderrData.includes('FileNotFoundError')) {
              errorMessage += ` Input file path correct? (${inputFilePath}). Output file might not have been generated.`;
            }
            reject(new Error(errorMessage));
          }
        });
      });

      await execution;

      this.logger.debug(
        `[MarkerLocal] marker_single process completed successfully. Ready to scan output directory.`,
      );

      let mainOutputPath: string | null = null;
      let metaOutputPath: string | null = null;

      // Inner try removed, content is now part of the outer try block
        // 1. 定义正确的子目录路径 (marker_single 在 outputDir 下创建了以 uniqueBaseName 命名的子目录)
        const outputSubDir = path.join(outputDir, uniqueBaseName);
        this.logger.debug(`[MarkerLocal] Expecting output in subdirectory: ${outputSubDir}`);

        // 2. Scan outputSubDir for main output file and metadata file
        this.logger.debug(`[MarkerLocal] Listing contents of output subdirectory: ${outputSubDir}`);
        let outputFiles: string[] = [];
        try {
          // 确保目录存在后再读取
          await fs.access(outputSubDir); // Check if directory exists
          outputFiles = await fs.readdir(outputSubDir);
          this.logger.debug(`[MarkerLocal] Files found in ${outputSubDir}: ${JSON.stringify(outputFiles)}`);
        } catch (accessOrReadError) {
          this.logger.error(`[MarkerLocal] Failed to access or list contents of ${outputSubDir}: ${accessOrReadError.message}`);
          // 如果目录不存在或读取失败，后续查找也必然失败
          throw new Error(`Failed to access or list expected output directory ${outputSubDir}: ${accessOrReadError.message}`);
        }

        // 在子目录中查找主输出文件 (通常文件名是固定的，如 'output.md' 或基于输入文件名，但这里假设是基于 uniqueBaseName 但不带前缀)
        // marker_single 的实际输出文件名可能需要进一步确认，但先假设它就是 .md/.json/.html
        mainOutputPath =
          outputFiles.find(
            (filename) =>
              filename.endsWith('.md') ||
              filename.endsWith('.json') ||
              filename.endsWith('.html'),
          ) ?? null;

        // 在子目录中查找元数据文件
        metaOutputPath =
          outputFiles.find(
            (filename) =>
              filename === '_meta.json' // 通常元数据文件名是固定的
          ) ?? null;

        if (!mainOutputPath) {
          this.logger.error(`[MarkerLocal] Main output file (.md/.json/.html) not found in ${outputSubDir}. Files in directory: ${JSON.stringify(outputFiles)}`);
          throw new Error(
            `Main output file not found in ${outputSubDir} after marker_single process completion.`,
          );
        }

        // 路径拼接时使用正确的子目录
        mainOutputPath = path.join(outputSubDir, mainOutputPath);
        if (metaOutputPath) {
          metaOutputPath = path.join(outputSubDir, metaOutputPath);
        }

        this.logger.debug(`[MarkerLocal] Found main output file: ${mainOutputPath}`);
        if (metaOutputPath) {
          this.logger.debug(`[MarkerLocal] Found metadata file: ${metaOutputPath}`);
        } else {
          this.logger.warn(`[MarkerLocal] Metadata file (_meta.json) not found in ${outputSubDir}.`);
        }

        // 3. Read the main output file
        const content = await fs.readFile(mainOutputPath, 'utf-8');
        this.logger.debug('[MarkerLocal] Main output file read successfully.');

        let metadata: Record<string, any> | undefined = undefined;
        let extractedTitle: string | undefined = undefined;

        // 4. Read and parse metadata if found
        if (metaOutputPath) {
          try {
            const metaContent = await fs.readFile(metaOutputPath, 'utf-8');
            metadata = JSON.parse(metaContent);
            this.logger.debug('[MarkerLocal] Metadata file read and parsed successfully.');

            // Attempt to extract title from table of contents
            if (Array.isArray(metadata?.table_of_contents) && metadata.table_of_contents.length > 0) {
                // Assuming the title is in the first element's 'title' property. Adjust if needed.
                extractedTitle = metadata.table_of_contents[0]?.title;
                if (extractedTitle) {
                    this.logger.debug(`[MarkerLocal] Extracted title: ${extractedTitle}`);
                }
            }
          } catch (metaError) {
            this.logger.warn(`[MarkerLocal] Failed to read or parse metadata file ${metaOutputPath}: ${metaError.message}`);
            // Proceed without metadata if parsing fails
          }
        }

      return {
        content: content,
        title: extractedTitle,
        metadata: metadata,
      };
  } catch (error) { // Outer catch block now handles all errors in the main try
    this.logger.error(
      `Error during MarkerLocal parsing: ${(error as Error).message}`, // Use safe access
      (error as Error).stack,
    );
    return this.handleError(error);
  } finally { // Outer finally block remains
      // Cleanup temporary directory
      try {
        if (tempDir) {
          await fs.rm(tempDir, { recursive: true, force: true });
          this.logger.debug( // Ensuring consistent formatting here too
            `[MarkerLocal] Cleaned up temporary directory: ${tempDir}`,
          );
        }
      } catch (cleanupError) { // Explicitly defining error type for clarity
        this.logger.error(
          `Failed to cleanup temporary directory ${tempDir}: ${(cleanupError as Error).message}`, // Access message safely
          (cleanupError as Error).stack, // Access stack safely
        );
      }
    }
  } // end parse method
} // end class