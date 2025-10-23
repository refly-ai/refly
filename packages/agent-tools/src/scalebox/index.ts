import { z } from 'zod/v3';
import {
  AgentBaseTool,
  AgentBaseToolset,
  type AgentToolConstructor,
  type ToolCallResult,
} from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { Sandbox, CodeInterpreter } from '@scalebox/sdk';

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
    en: 'Run multi-language code in a controllable sandbox. Manage sandboxes, files, commands and code execution.',
    'zh-CN': '在可控沙箱中运行多语言代码，支持沙箱管理、文件操作、命令与代码执行。',
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
    {
      name: 'list',
      descriptionDict: { en: 'List sandboxes with pagination', 'zh-CN': '分页列出沙箱' },
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

interface ScaleboxToolParams {
  apiKey: string;
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
    timeoutMs: z.number().describe('Timeout in milliseconds').default(300000),
    metadata: z.record(z.any()).describe('Metadata to associate with sandbox').optional(),
    envs: z.record(z.string()).describe('Environment variables').optional(),
  });

  description = 'Create a sandbox using Scalebox SDK';
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

  schema = z.object({ sandboxId: z.string(), path: z.string() });

  description = 'Read a file from sandbox';
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
      const content = await sbx?.files?.read?.(input?.path ?? '');
      return {
        status: 'success',
        data: { content: content ?? '' },
        summary: 'File read successfully',
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

  schema = z.object({ sandboxId: z.string(), path: z.string(), content: z.string() });

  description = 'Write a file to sandbox';
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
      await sbx?.files?.write?.(input?.path ?? '', input?.content ?? '');
      return { status: 'success', data: { written: true }, summary: 'File written successfully' };
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
      const list = items ?? [];
      const safe = Array.isArray(list) ? list : [];
      return { status: 'success', data: { items: safe }, summary: 'Directory listed' };
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

  description = 'Run a shell command synchronously';
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

  description = 'Run code in a specified language using sandbox.runCode';
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
      const res = await sbx?.runCode(input?.code ?? '', {
        language: input?.language ?? 'python',
      });
      const stdout = res?.logs?.stdout ?? '';
      const stderr = res?.logs?.stderr ?? '';
      return {
        status: 'success',
        data: { logs: { stdout, stderr } },
        summary: 'Code executed',
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

  description = 'Run code using CodeInterpreter (single-shot; no persistent contexts)';
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

/**
 * list sandboxes (paginated)
 */
export class ScaleboxList extends AgentBaseTool<ScaleboxToolParams> {
  name = 'list';
  toolsetKey = ScaleboxToolsetDefinition.key;

  schema = z.object({
    pageLimit: z.number().describe('Max number of pages to fetch').default(1),
    itemLimit: z.number().describe('Max number of items to fetch').optional(),
  });

  description = 'List sandboxes with pagination';
  protected params: ScaleboxToolParams;

  constructor(params: ScaleboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    ensureApiKey(this.params?.apiKey ?? '');
    try {
      const paginator = Sandbox.list({ apiKey: this.params.apiKey });
      const items: any[] = [];
      let pages = 0;
      // Iterate with safeguards
      while ((paginator?.hasNext ?? false) && pages < (input?.pageLimit ?? 1)) {
        const chunk = (await paginator?.nextItems?.()) ?? [];
        if (Array.isArray(chunk) && chunk?.length > 0) {
          const remaining = (input?.itemLimit ?? Number.MAX_SAFE_INTEGER) - items.length;
          if (remaining <= 0) break;
          items.push(...chunk.slice(0, remaining));
        }
        pages += 1;
      }
      return { status: 'success', data: { items }, summary: 'Sandboxes listed' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to list sandboxes',
        summary: error instanceof Error ? error.message : 'Unknown error during list',
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
    ScaleboxList,
  ] satisfies readonly AgentToolConstructor<ScaleboxToolParams>[];
}
