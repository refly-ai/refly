import { z } from 'zod/v3';
import {
  AgentBaseTool,
  AgentBaseToolset,
  type AgentToolConstructor,
  type ToolCallResult,
} from '../base';
import {
  ToolsetDefinition,
  User,
  EntityType,
  FileVisibility,
  UploadResponse,
} from '@refly/openapi-schema';
import { Sandbox, CodeInterpreter, type WriteInfo } from '@scalebox/sdk';
import { ToolParams } from '@langchain/core/tools';
import { RunnableConfig } from '@langchain/core/runnables';
export interface ReflyService {
  downloadFile: (storageKey: string) => Promise<Buffer>;
  uploadBase64: (
    user: User,
    param: {
      base64: string;
      filename?: string;
      entityId?: string;
      entityType?: EntityType;
      visibility?: FileVisibility;
      storageKey?: string;
    },
  ) => Promise<UploadResponse['data']>;
  genImageID: () => Promise<string>;
}

/**
 * Toolset definition for Scalebox SDK.
 * Exposes sandbox management, file system, command execution, PTY, and code execution tools.
 */
export const ScaleboxToolsetDefinition: ToolsetDefinition = {
  key: 'scalebox',
  domain: 'https://www.cloudsway.ai/',
  labelDict: {
    en: 'Scalebox',
    'zh-CN': 'Scalebox',
  },
  descriptionDict: {
    en: 'Perfect for data analysis, visualization, and automation tasks. Execute code in multiple languages, manage files and directories, run system commands, and create data visualizations with pre-installed tools like Jupyter, NumPy, Pandas, Matplotlib, and Seaborn.',
    'zh-CN':
      '适用于数据分析、可视化和自动化任务。支持多语言代码执行、文件目录管理、系统命令运行，以及使用预装的Jupyter、NumPy、Pandas、Matplotlib、Seaborn等工具创建数据可视化。',
  },
  tools: [
    { name: 'create', descriptionDict: { en: 'Create a sandbox', 'zh-CN': '创建沙箱' } },
    {
      name: 'connect',
      descriptionDict: { en: 'Connect to an existing sandbox', 'zh-CN': '连接已有沙箱' },
    },
    {
      name: 'isRunning',
      descriptionDict: { en: 'Check if sandbox is running', 'zh-CN': '检查沙箱运行状态' },
    },
    { name: 'getInfo', descriptionDict: { en: 'Get sandbox info', 'zh-CN': '获取沙箱信息' } },
    { name: 'setTimeout', descriptionDict: { en: 'Set sandbox timeout', 'zh-CN': '设置沙箱超时' } },
    { name: 'kill', descriptionDict: { en: 'Kill sandbox', 'zh-CN': '关闭沙箱' } },

    { name: 'filesRead', descriptionDict: { en: 'Read file from sandbox', 'zh-CN': '读取文件' } },
    { name: 'filesWrite', descriptionDict: { en: 'Write file to sandbox', 'zh-CN': '写入文件' } },
    { name: 'filesList', descriptionDict: { en: 'List directory', 'zh-CN': '列出目录' } },
    { name: 'filesMakeDir', descriptionDict: { en: 'Create directory', 'zh-CN': '创建目录' } },
    {
      name: 'filesMove',
      descriptionDict: { en: 'Move file or directory', 'zh-CN': '移动文件或目录' },
    },
    {
      name: 'filesRemove',
      descriptionDict: { en: 'Remove file or directory', 'zh-CN': '删除文件或目录' },
    },

    { name: 'commandsRun', descriptionDict: { en: 'Run a shell command', 'zh-CN': '执行命令' } },
    {
      name: 'ptyExec',
      descriptionDict: {
        en: 'Start PTY, send input, wait for output (single-shot)',
        'zh-CN': '启动伪终端并执行单次交互',
      },
    },

    {
      name: 'runCode',
      descriptionDict: {
        en: 'Run code in a given language (single-shot)',
        'zh-CN': '以指定语言运行代码（单次）',
      },
    },
    {
      name: 'interpreterRunCode',
      descriptionDict: {
        en: 'Run code via CodeInterpreter (single-shot)',
        'zh-CN': '通过 CodeInterpreter 运行代码（单次）',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'credentials',
      credentialItems: [
        {
          key: 'apiKey',
          inputMode: 'text',
          inputProps: { passwordType: true },
          labelDict: { en: 'API Key', 'zh-CN': 'API 密钥' },
          descriptionDict: {
            en: 'The API key for Scalebox (SCALEBOX_API_KEY)',
            'zh-CN': 'Scalebox 的 API 密钥（SCALEBOX_API_KEY）',
          },
          required: true,
        },
      ],
    },
  ],
  configItems: [],
};

interface ScaleboxToolParams extends ToolParams {
  user: User;
  apiKey: string;
  reflyService: ReflyService;
}

function ensureApiKey(apiKey: string): void {
  // Set env var expected by SDK; avoids passing credentials in every call
  if (!process.env.SCALEBOX_API_KEY || process.env.SCALEBOX_API_KEY !== apiKey) {
    process.env.SCALEBOX_API_KEY = apiKey ?? '';
  }
}

/**
 * create
 */
export class ScaleboxCreate extends AgentBaseTool<ScaleboxToolParams> {
  name = 'create';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({
    type: z.string().describe('Sandbox type, e.g. code-interpreter').default('code-interpreter'),
    timeoutMs: z
      .number()
      .describe('Timeout in milliseconds default is 30 minutes')
      .default(1800000),
    metadata: z.record(z.any()).describe('Metadata to associate with sandbox').optional(),
    envs: z.record(z.string()).describe('Environment variables').optional(),
  });

  description =
    'Create a new sandbox environment. This should be your FIRST step when starting any code execution task. Choose appropriate sandbox type (e.g., code-interpreter) and timeout settings.';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sandbox = await Sandbox.create(input?.type ?? 'code-interpreter', {
        timeoutMs: input?.timeoutMs ?? 300000,
        metadata: input?.metadata ?? {},
        apiKey: this.params?.apiKey ?? '',
      });

      const info = await sandbox?.getInfo?.();
      return {
        status: 'success',
        data: {
          sandboxId: info.sandboxId ?? undefined,
          info: info ?? {},
        },
        summary: 'Sandbox created successfully',
        creditCost: 1,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to create sandbox',
        summary: error instanceof Error ? error.message : 'Unknown error during sandbox creation',
      };
    }
  }
}

/**
 * connect
 */
export class ScaleboxConnect extends AgentBaseTool<ScaleboxToolParams> {
  name = 'connect';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({
    sandboxId: z.string().describe('Existing sandbox id to connect'),
  });

  description = 'Connect to an existing sandbox';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });
      const info = await sbx?.getInfo?.();
      return {
        status: 'success',
        data: {
          sandboxId: input?.sandboxId,
          info: info ?? {},
        },
        summary: 'Connected to sandbox successfully',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to connect sandbox',
        summary: error instanceof Error ? error.message : 'Unknown error during sandbox connect',
      };
    }
  }
}

/**
 * isRunning
 */
export class ScaleboxIsRunning extends AgentBaseTool<ScaleboxToolParams> {
  name = 'isRunning';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string().describe('Sandbox id') });

  description = 'Check if sandbox is running';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });
      const running = await sbx?.isRunning?.();
      return {
        status: 'success',
        data: { isRunning: !!running },
        summary: 'Sandbox status fetched',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to check sandbox status',
        summary: error instanceof Error ? error.message : 'Unknown error during isRunning',
      };
    }
  }
}

/**
 * getInfo
 */
export class ScaleboxGetInfo extends AgentBaseTool<ScaleboxToolParams> {
  name = 'getInfo';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string().describe('Sandbox id') });

  description = 'Get sandbox information';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });
      const info = await sbx?.getInfo?.();
      return { status: 'success', data: info ?? {}, summary: 'Sandbox info fetched' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to get sandbox info',
        summary: error instanceof Error ? error.message : 'Unknown error during getInfo',
      };
    }
  }
}

/**
 * setTimeout
 */
export class ScaleboxSetTimeout extends AgentBaseTool<ScaleboxToolParams> {
  name = 'setTimeout';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string(), timeoutMs: z.number() });

  description = 'Set sandbox timeout (ms)';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });

      // According to Scalebox API, setTimeout does not return a value. Therefore, simply return success after calling.
      await sbx?.setTimeout?.(input?.timeoutMs ?? 0);
      return { status: 'success', data: { ok: true }, summary: 'Timeout updated' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to set timeout',
        summary: error instanceof Error ? error.message : 'Unknown error during setTimeout',
      };
    }
  }
}

/**
 * kill
 */
export class ScaleboxKill extends AgentBaseTool<ScaleboxToolParams> {
  name = 'kill';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string() });

  description = 'Kill a sandbox';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });
      await sbx?.kill?.();
      return { status: 'success', data: { killed: true }, summary: 'Sandbox killed' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to kill sandbox',
        summary: error instanceof Error ? error.message : 'Unknown error during kill',
      };
    }
  }
}

/**
 * files.read
 */
export class ScaleboxFilesRead extends AgentBaseTool<ScaleboxToolParams> {
  name = 'filesRead';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({
    sandboxId: z.string().describe('Sandbox ID'),
    path: z.string().describe('Path to the file to read'),
    format: z
      .enum(['text', 'base64'])
      .describe('File content format: text (plain text) or base64 (binary files auto-upload)')
      .default('text')
      .optional(),
    user: z.string().describe('Execute as specified user').default('root').optional(),
    requestTimeoutMs: z.number().describe('Request timeout (milliseconds)').optional(),
  });

  description = `Read file content from sandbox:

- text: Return pure text string content (default)
- base64: Return base64 encoded data and auto-upload binary files

Support options:
- user: Specify execution user identity (default is 'root')
- requestTimeoutMs: Set request timeout (milliseconds)

Usage examples:
- Read text file: {sandboxId: "xxx", path: "/etc/hostname"}
- Read binary file: {sandboxId: "xxx", path: "/image.png", format: "base64"}`;
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });

      const readOpts: any = {};

      // Set user identity
      if (input?.user && input.user !== 'root') {
        readOpts.user = input.user;
      }

      // Set request timeout
      if (input?.requestTimeoutMs) {
        readOpts.requestTimeoutMs = input.requestTimeoutMs;
      }

      // Set format (default is text)
      if (input?.format === 'base64') {
        readOpts.format = 'bytes';
      }

      const content = await sbx?.files?.read?.(input?.path ?? '', readOpts);

      let resultData: any;

      // Handle base64 format with auto-upload
      if (input?.format === 'base64') {
        // Auto-upload binary files
        const entityId = await this.params?.reflyService?.genImageID?.();
        const filename = `${input.path.split('/').pop() ?? 'file'}`;
        const hasDataUrlPrefix = typeof content === 'string' && content.startsWith('data:');
        const base64 = hasDataUrlPrefix
          ? content
          : `data:application/octet-stream;base64,${content}`;

        try {
          const uploaded = await this.params?.reflyService?.uploadBase64?.(this.params?.user, {
            base64,
            filename,
            entityId,
          });

          if (uploaded) {
            resultData = {
              format: 'base64',
              upload: {
                storageKey: uploaded.storageKey,
                url: uploaded.url,
              },
              filename,
            };
          } else {
            resultData = {
              format: 'base64',
              error: 'Upload failed - no upload result returned',
            };
          }
        } catch (uploadError) {
          resultData = {
            format: 'base64',
            error: uploadError instanceof Error ? uploadError.message : 'Upload failed',
          };
        }
      } else {
        // Text format - return content directly
        resultData = { content };
      }

      return {
        status: 'success',
        data: resultData,
        summary: `File read successfully (format: ${input?.format ?? 'text'})`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to read file',
        summary: error instanceof Error ? error.message : 'Unknown error during files.read',
      };
    }
  }
}

/**
 * files.write
 */
export class ScaleboxFilesWrite extends AgentBaseTool<ScaleboxToolParams> {
  name = 'filesWrite';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({
    sandboxId: z.string(),
    path: z.string(),
    content: z.string().optional(),
    storageKey: z
      .string()
      .optional()
      .describe(
        'Internal storage key (static/UUID.extension format like "static/026d104f-241e-4e40-bcae-d74daf140c13.mp3"). ',
      ),
  });

  description =
    'Write files to the sandbox environment. Use this SECOND in your workflow after creating a sandbox. You can provide content directly, fetch from external URLs, or use internal storage keys. Always use absolute paths starting from root (/). Essential for uploading data files, code files, or any resources needed for code execution.';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });

      let content: string | ArrayBuffer | Blob | ReadableStream;

      // If URL is provided, fetch content from URL
      if (input?.storageKey) {
        const buffer = await this.params.reflyService?.downloadFile(input.storageKey);
        content = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as ArrayBuffer;
      } else if (input?.content) {
        content = input.content;
      } else {
        throw new Error('Either content or url must be provided');
      }

      const writeInfo: WriteInfo = await sbx?.files?.write?.(input?.path ?? '', content);

      return {
        status: 'success',
        data: {
          writeInfo: {
            name: writeInfo?.name ?? '',
            type: writeInfo?.type ?? '',
            path: writeInfo?.path ?? '',
          },
        },
        summary: 'File written successfully',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to write file',
        summary: error instanceof Error ? error.message : 'Unknown error during files.write',
      };
    }
  }
}

/**
 * files.list
 */
export class ScaleboxFilesList extends AgentBaseTool<ScaleboxToolParams> {
  name = 'filesList';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string(), path: z.string().default('/') });

  description = 'List directory in sandbox';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });
      const items = await sbx?.files?.list?.(input?.path ?? '/');
      return { status: 'success', data: { items }, summary: 'Directory listed' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to list directory',
        summary: error instanceof Error ? error.message : 'Unknown error during files.list',
      };
    }
  }
}

/**
 * files.makeDir
 */
export class ScaleboxFilesMakeDir extends AgentBaseTool<ScaleboxToolParams> {
  name = 'filesMakeDir';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string(), path: z.string() });

  description = 'Create directory in sandbox';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });
      await sbx?.files?.makeDir?.(input?.path ?? '');
      return { status: 'success', data: { created: true }, summary: 'Directory created' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to create directory',
        summary: error instanceof Error ? error.message : 'Unknown error during files.makeDir',
      };
    }
  }
}

/**
 * files.move
 */
export class ScaleboxFilesMove extends AgentBaseTool<ScaleboxToolParams> {
  name = 'filesMove';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string(), from: z.string(), to: z.string() });

  description = 'Move file/directory in sandbox';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });
      await sbx?.files?.move?.(input?.from ?? '', input?.to ?? '');
      return { status: 'success', data: { moved: true }, summary: 'Path moved' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to move path',
        summary: error instanceof Error ? error.message : 'Unknown error during files.move',
      };
    }
  }
}

/**
 * files.remove
 */
export class ScaleboxFilesRemove extends AgentBaseTool<ScaleboxToolParams> {
  name = 'filesRemove';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string(), path: z.string() });

  description = 'Remove file/directory in sandbox';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });
      await sbx?.files?.remove?.(input?.path ?? '');
      return { status: 'success', data: { removed: true }, summary: 'Path removed' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to remove path',
        summary: error instanceof Error ? error.message : 'Unknown error during files.remove',
      };
    }
  }
}

/**
 * commands.run
 */
export class ScaleboxCommandsRun extends AgentBaseTool<ScaleboxToolParams> {
  name = 'commandsRun';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({
    sandboxId: z.string(),
    command: z.string().describe('Command to run'),
  });

  description =
    'Run a shell command synchronously. Commands execute in /workspace directory by default, so use absolute paths for file operations.';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });
      const result = await sbx?.commands?.run?.(input?.command ?? '');
      return {
        status: 'success',
        data: {
          stdout: result?.stdout ?? '',
          stderr: result?.stderr ?? '',
          exitCode: result?.exitCode ?? 0,
        },
        summary: 'Command executed',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to run command',
        summary: error instanceof Error ? error.message : 'Unknown error during commands.run',
      };
    }
  }
}

/**
 * pty.exec (single-shot)
 */
export class ScaleboxPtyExec extends AgentBaseTool<ScaleboxToolParams> {
  name = 'ptyExec';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({
    sandboxId: z.string(),
    input: z.string().describe('Input to send to PTY'),
    cwd: z.string().describe('Working directory').optional(),
    envs: z.record(z.string()).describe('Environment variables').optional(),
  });

  description = 'Start PTY, send input, wait for output, then close';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });
      const pty = await sbx?.pty?.start?.({
        cwd: input?.cwd ?? undefined,
        envs: input?.envs ?? undefined,
      });
      await pty?.send?.(input?.input ?? '');
      const out = await pty?.wait?.();
      return {
        status: 'success',
        data: { output: (out as unknown as string) ?? '' },
        summary: 'PTY executed',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to exec PTY',
        summary: error instanceof Error ? error.message : 'Unknown error during pty.exec',
      };
    }
  }
}

/**
 * runCode (single-shot) via Sandbox.runCode
 */
export class ScaleboxRunCode extends AgentBaseTool<ScaleboxToolParams> {
  name = 'runCode';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({
    sandboxId: z.string(),
    code: z.string(),
    language: z
      .enum(['python', 'javascript', 'typescript', 'r', 'java', 'bash', 'node', 'deno'])
      .describe('Execution language'),
  });

  description =
    'Execute code in the sandbox environment - THIS SHOULD BE YOUR PRIMARY CODE EXECUTION METHOD due to its superior image generation capabilities. Use this THIRD and FINAL step in your workflow after creating sandbox and uploading files. Supports Python, JavaScript, TypeScript, R, Java, Bash, Node.js, and Deno. Automatically handles image outputs (PNG charts, plots, visualizations) and uploads them to canvas. Code executes in /workspace directory by default - use absolute paths for file operations.';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _?: any,
    _config?: RunnableConfig,
  ): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const sbx = await Sandbox.connect(input?.sandboxId ?? '', {
        apiKey: this.params?.apiKey ?? '',
      });
      const res = await sbx?.runCode(input?.code ?? '', {
        language: input?.language ?? 'python',
      });
      const stdout = res?.logs?.stdout ?? '';
      const stderr = res?.logs?.stderr ?? '';
      const results = res?.results ?? [];
      const pngResults = Array.isArray(results) ? results.filter((r: any) => !!(r?.png ?? '')) : [];

      // Upload generated images and return file information
      // The upper layer (skill-invoker) will handle adding nodes to canvas
      // Track uploaded content hashes to prevent duplicates
      const uploadedContentHashes = new Set<string>();
      const uploads = await Promise.all(
        pngResults.map(async (r: any, idx: number) => {
          const raw = r?.png ?? '';

          // Create a simple hash to detect duplicate content
          const contentHash = `${raw.slice(0, 100)}:${raw.length}`;

          // Skip if this content has already been uploaded in this batch
          if (uploadedContentHashes.has(contentHash)) {
            console.log(`Skipping duplicate image: code-output-${idx + 1}.png (same content)`);
            return null;
          }

          const hasDataUrlPrefix = typeof raw === 'string' && raw.startsWith('data:');
          const base64 = hasDataUrlPrefix ? raw : `data:image/png;base64,${raw}`;

          try {
            const entityId = await this.params?.reflyService?.genImageID?.();
            const uploaded = await this.params?.reflyService?.uploadBase64?.(this.params?.user, {
              base64,
              filename: `code-output-${idx + 1}.png`,
              entityId,
            });

            if (uploaded) {
              // Mark this content as uploaded
              uploadedContentHashes.add(contentHash);
              return {
                ...uploaded,
                title: `Code Output ${idx + 1}`,
                type: 'image' as const,
                entityId,
              };
            }
            return null;
          } catch {
            return null;
          }
        }),
      );

      // Filter out failed uploads
      const validUploads = uploads.filter((u) => u !== null);

      return {
        status: 'success',
        data: {
          logs: { stdout, stderr },
          uploads: validUploads,
          hasGeneratedFiles: validUploads.length > 0,
        },
        summary:
          validUploads.length > 0
            ? `Code executed with ${validUploads.length} generated file(s)`
            : 'Code executed',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to run code',
        summary: error instanceof Error ? error.message : 'Unknown error during runCode',
      };
    }
  }
}

/**
 * interpreter.runCode (single-shot) via CodeInterpreter
 */
export class ScaleboxInterpreterRunCode extends AgentBaseTool<ScaleboxToolParams> {
  name = 'interpreterRunCode';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({
    code: z.string(),
    language: z
      .enum(['python', 'javascript', 'typescript', 'r', 'java', 'bash', 'node', 'deno'])
      .describe('Execution language'),
    cwd: z.string().optional(),
  });

  description = `Execute code using CodeInterpreter with pre-installed data science environment. 
    - Perfect for data analysis, visualization, and machine learning tasks. 
    - Pre-installed packages include: JupyterLab, NumPy, Pandas, Matplotlib, Seaborn, and Scikit-learn. 
    - Use this as ALTERNATIVE to runCode when you need simpler execution without sandbox management. 
    - Single-shot execution with no persistent contexts. 
    - Good for quick data science tasks but lacks the advanced image generation and file management capabilities of runCode.`;
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const interpreter = await CodeInterpreter.create({
        templateId: 'code-interpreter',
      });
      const res = await interpreter?.runCode?.(input?.code ?? '', {
        language: input?.language ?? 'python',
        cwd: input?.cwd ?? undefined,
      });
      const stdout = res?.logs?.stdout ?? '';
      const stderr = res?.logs?.stderr ?? '';
      try {
        await interpreter?.close?.();
      } catch {}
      return {
        status: 'success',
        data: { logs: { stdout, stderr }, formats: res ?? {} },
        summary: 'Code executed via interpreter',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to run code via interpreter',
        summary:
          error instanceof Error ? error.message : 'Unknown error during interpreter.runCode',
      };
    }
  }
}

export class ScaleboxToolset extends AgentBaseToolset<ScaleboxToolParams> {
  toolsetKey = ScaleboxToolsetDefinition.key;
  tools = [
    ScaleboxCreate,
    ScaleboxConnect,
    ScaleboxIsRunning,
    ScaleboxGetInfo,
    ScaleboxSetTimeout,
    ScaleboxKill,
    ScaleboxFilesRead,
    ScaleboxFilesWrite,
    ScaleboxFilesList,
    ScaleboxFilesMakeDir,
    ScaleboxFilesMove,
    ScaleboxFilesRemove,
    ScaleboxCommandsRun,
    ScaleboxPtyExec,
    ScaleboxRunCode,
    ScaleboxInterpreterRunCode,
  ] satisfies readonly AgentToolConstructor<ScaleboxToolParams>[];
}
