import { v4 as uuidv4 } from 'uuid';
import { CodeBox, CodeBoxOutput } from './sandbox/codebox-adapter';
import { AgentExecutor, createReactAgent } from 'langchain/agents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BufferMemory } from 'langchain/memory';
import { ChatMessageHistory } from 'langchain/memory';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { z } from 'zod';
import { File, UserRequest, CodeInterpreterResponse, SessionStatus } from './schema';
import { settings } from './config';
import { getFileModifications, removeDownloadLink } from './chains';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { formatToOpenAIToolMessages } from 'langchain/agents/format_scratchpad/openai_tools';
import { OpenAIToolsAgentOutputParser } from 'langchain/agents/openai/output_parser';

/**
 * Handle deprecated kwargs for backward compatibility
 */
function handleDeprecatedKwargs(kwargs: Record<string, any>): void {
  if (kwargs.model) settings.MODEL = kwargs.model;
  if (kwargs.maxRetry !== undefined) settings.MAX_RETRY = kwargs.maxRetry;
  if (kwargs.temperature !== undefined) settings.TEMPERATURE = kwargs.temperature;
  if (kwargs.openaiApiKey) settings.OPENAI_API_KEY = kwargs.openaiApiKey;
  if (kwargs.systemMessage) settings.SYSTEM_MESSAGE = kwargs.systemMessage;
  if (kwargs.maxIterations !== undefined) settings.MAX_ITERATIONS = kwargs.maxIterations;
}

export interface CodeInterpreterSessionOptions {
  /**
   * Pre-configured LLM instance to use for code interpretation.
   * When provided, this takes precedence over model configuration parameters.
   * This is the recommended approach for integration with systems that need
   * to track token usage and billing (e.g., Refly's SkillEngine).
   */
  llm?: BaseChatModel;
  additionalTools?: any[];
  callbacks?: any[];
  verbose?: boolean;
  apiKey?: string;

  // Model configuration - fallback when llm is not provided
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  azureOpenAIApiKey?: string;
  azureApiBase?: string;
  azureApiVersion?: string;
  azureDeploymentName?: string;
  anthropicApiKey?: string;

  // LLM settings
  model?: string;
  temperature?: number;
  detailedError?: boolean;
  systemMessage?: string;
  requestTimeout?: number;
  maxIterations?: number;
  maxRetry?: number;

  // CodeBox settings
  customPackages?: string[];

  [key: string]: any;
}

/**
 * CodeInterpreterSession - A TypeScript implementation of code interpreter with LangChain
 */
export class CodeInterpreterSession {
  private codebox: CodeBox;
  private verbose: boolean;
  private tools: any[];
  private llm: BaseChatModel;
  private callbacks?: any[];
  private agentExecutor?: AgentExecutor;
  private inputFiles: File[] = [];
  private outputFiles: File[] = [];
  private codeLog: Array<[string, string]> = [];
  private config: {
    openaiApiKey?: string;
    openaiBaseUrl?: string;
    azureOpenAIApiKey?: string;
    azureApiBase?: string;
    azureApiVersion?: string;
    azureDeploymentName?: string;
    anthropicApiKey?: string;
    model: string;
    temperature: number;
    detailedError: boolean;
    systemMessage: string;
    requestTimeout: number;
    maxIterations: number;
    maxRetry: number;
    customPackages: string[];
  };

  constructor(options: CodeInterpreterSessionOptions = {}) {
    handleDeprecatedKwargs(options);

    // Merge options with default settings
    this.config = {
      openaiApiKey: options.openaiApiKey || settings.OPENAI_API_KEY,
      openaiBaseUrl: options.openaiBaseUrl || settings.OPENAI_BASE_URL,
      azureOpenAIApiKey: options.azureOpenAIApiKey || settings.AZURE_OPENAI_API_KEY,
      azureApiBase: options.azureApiBase || settings.AZURE_API_BASE,
      azureApiVersion: options.azureApiVersion || settings.AZURE_API_VERSION,
      azureDeploymentName: options.azureDeploymentName || settings.AZURE_DEPLOYMENT_NAME,
      anthropicApiKey: options.anthropicApiKey || settings.ANTHROPIC_API_KEY,
      model: options.model || settings.MODEL,
      temperature: options.temperature ?? settings.TEMPERATURE,
      detailedError: options.detailedError ?? settings.DETAILED_ERROR,
      systemMessage: options.systemMessage || settings.SYSTEM_MESSAGE,
      requestTimeout: options.requestTimeout ?? settings.REQUEST_TIMEOUT,
      maxIterations: options.maxIterations ?? settings.MAX_ITERATIONS,
      maxRetry: options.maxRetry ?? settings.MAX_RETRY,
      customPackages: options.customPackages || settings.CUSTOM_PACKAGES,
    };

    this.codebox = new CodeBox({
      requirements: this.config.customPackages,
      apiKey: options.apiKey || process.env.SCALEBOX_API_KEY,
    });
    this.verbose = options.verbose ?? settings.DEBUG;
    this.tools = this.createTools(options.additionalTools || []);
    // Use pre-configured LLM instance if provided, otherwise create one
    this.llm = options.llm || this.chooseLLM();
    this.callbacks = options.callbacks;
  }

  /**
   * Create a session from an existing session ID
   */
  static async fromId(
    sessionId: string,
    options: CodeInterpreterSessionOptions = {},
  ): Promise<CodeInterpreterSession> {
    const session = new CodeInterpreterSession(options);
    session.codebox = await CodeBox.fromId(sessionId, {
      apiKey: options.apiKey || process.env.SCALEBOX_API_KEY,
    });
    session.agentExecutor = await session.createAgentExecutor();
    return session;
  }

  /**
   * Get the current session ID
   */
  get sessionId(): string | undefined {
    return this.codebox.sessionId;
  }

  /**
   * Start the code interpreter session
   */
  async start(): Promise<SessionStatus> {
    const status = await this.codebox.start();
    this.agentExecutor = await this.createAgentExecutor();

    // Install custom packages
    if (this.config.customPackages.length > 0) {
      await this.codebox.run(`!pip install -q ${this.config.customPackages.join(' ')}`);
    }

    return SessionStatus.fromCodeBoxStatus(status);
  }

  /**
   * Create tools for the agent
   */
  private createTools(additionalTools: any[]): any[] {
    const pythonTool: any = new (DynamicStructuredTool as any)({
      name: 'python',
      description: `Input a string of code to a ipython interpreter. Write the entire code in a single string. This string can be really long, so you can use the \`;\" character to split lines. Start your code on the same line as the opening quote. Do not start your code with a line break. For example, do 'import numpy', not '\\nimport numpy'. Variables are preserved between runs. ${
        this.config.customPackages.length > 0
          ? `You can use all default python packages specifically also these: ${this.config.customPackages.join(', ')}`
          : ''
      }`,
      schema: z.object({
        code: z.string().describe('Python code to execute'),
      }),
      func: async ({ code }: { code: string }) => await this.runHandler(code),
    });

    return [...additionalTools, pythonTool];
  }

  /**
   * Choose the appropriate LLM based on configuration
   */
  private chooseLLM(): BaseChatModel {
    // Priority 1: Azure OpenAI
    if (
      this.config.azureOpenAIApiKey &&
      this.config.azureApiBase &&
      this.config.azureApiVersion &&
      this.config.azureDeploymentName
    ) {
      this.log('Using Azure Chat OpenAI');
      return new ChatOpenAI({
        temperature: this.config.temperature,
        azureOpenAIApiKey: this.config.azureOpenAIApiKey,
        azureOpenAIApiInstanceName: this.config.azureApiBase,
        azureOpenAIApiVersion: this.config.azureApiVersion,
        azureOpenAIApiDeploymentName: this.config.azureDeploymentName,
        maxRetries: this.config.maxRetry,
        timeout: this.config.requestTimeout * 1000, // Convert seconds to milliseconds
      }) as any;
    }

    // Priority 2: OpenAI-compatible API (LiteLLM, OpenAI, etc.)
    if (this.config.openaiApiKey) {
      const provider = this.config.openaiBaseUrl ? 'LiteLLM' : 'OpenAI';
      this.log(`Using ${provider}`);

      const config: any = {
        modelName: this.config.model,
        openAIApiKey: this.config.openaiApiKey,
        temperature: this.config.temperature,
        maxRetries: this.config.maxRetry,
        timeout: this.config.requestTimeout * 1000, // Convert seconds to milliseconds
      };

      // Add custom base URL if provided (for LiteLLM or other OpenAI-compatible services)
      if (this.config.openaiBaseUrl) {
        config.configuration = {
          baseURL: this.config.openaiBaseUrl,
        };
      }

      return new ChatOpenAI(config) as any;
    }

    // Priority 3: Anthropic
    if (this.config.anthropicApiKey) {
      if (!this.config.model.includes('claude')) {
        console.warn('Please set the claude model in the settings.');
      }
      this.log('Using Chat Anthropic');
      return new ChatAnthropic({
        modelName: this.config.model,
        temperature: this.config.temperature,
        anthropicApiKey: this.config.anthropicApiKey,
      }) as any;
    }

    throw new Error(
      'Please set the API key for the LLM you want to use (OPENAI_API_KEY, AZURE_OPENAI_API_KEY, or ANTHROPIC_API_KEY).',
    );
  }

  /**
   * Create the agent executor
   */
  private async createAgentExecutor(): Promise<AgentExecutor> {
    const memory = new BufferMemory({
      memoryKey: 'chat_history',
      returnMessages: true,
      chatHistory: this.createHistoryBackend(),
      inputKey: 'input',
      outputKey: 'output',
    });

    // For ChatOpenAI (including OpenRouter), use tool calling with modern API
    // This uses the 'tools' parameter instead of deprecated 'functions'
    if (this.llm instanceof ChatOpenAI) {
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', this.config.systemMessage],
        new MessagesPlaceholder('chat_history'),
        ['human', '{input}'],
        new MessagesPlaceholder('agent_scratchpad'),
      ]);

      // Bind tools to the model (uses new 'tools' parameter)
      const llmWithTools = this.llm.bindTools(this.tools);

      // Create agent using RunnableSequence
      const agent = RunnableSequence.from([
        {
          input: (i: { input: string; steps: any[] }) => i.input,
          agent_scratchpad: (i: { input: string; steps: any[] }) =>
            formatToOpenAIToolMessages(i.steps),
          chat_history: async () => {
            const messages = await memory.chatHistory.getMessages();
            return messages;
          },
        },
        prompt,
        llmWithTools,
        new OpenAIToolsAgentOutputParser(),
      ]);

      return AgentExecutor.fromAgentAndTools({
        agent,
        tools: this.tools,
        maxIterations: this.config.maxIterations,
        verbose: this.verbose,
        memory,
        callbacks: this.callbacks,
      });
    }

    // For other LLMs (like Anthropic), use ReAct agent
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `${this.config.systemMessage}\n\nYou have access to the following tools:\n\n{tools}\n\nUse the following format:\n\nQuestion: the input question you must answer\nThought: you should always think about what to do\nAction: the action to take, should be one of [{tool_names}]\nAction Input: the input to the action\nObservation: the result of the action\n... (this Thought/Action/Action Input/Observation can repeat N times)\nThought: I now know the final answer\nFinal Answer: the final answer to the original input question`,
      ],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const agent = await createReactAgent({
      llm: this.llm,
      tools: this.tools,
      prompt,
    });

    return AgentExecutor.fromAgentAndTools({
      agent,
      tools: this.tools,
      maxIterations: this.config.maxIterations,
      verbose: this.verbose,
      memory,
      callbacks: this.callbacks,
    });
  }

  /**
   * Create chat history backend
   */
  private createHistoryBackend(): ChatMessageHistory {
    // For simplicity, using in-memory chat history
    // Can be extended to support Redis, PostgreSQL, etc.
    return new ChatMessageHistory();
  }

  /**
   * Show code if verbose mode is enabled
   */
  private showCode(code: string): void {
    if (this.verbose) {
      console.log(code);
    }
  }

  /**
   * Run code handler
   */
  private async runHandler(code: string): Promise<string> {
    this.showCode(code);
    const output: CodeBoxOutput = await this.codebox.run(code);
    this.codeLog.push([code, output.content]);

    if (typeof output.content !== 'string') {
      throw new TypeError('Expected output.content to be a string.');
    }

    // Handle image output
    if (output.type === 'image/png') {
      const filename = `image-${uuidv4()}.png`;
      const imageBuffer = Buffer.from(output.content, 'base64');
      this.outputFiles.push(new File(filename, imageBuffer));
      return `Image ${filename} got send to the user.`;
    }

    // Handle errors
    if (output.type === 'error') {
      const moduleNotFoundMatch = output.content.match(
        /ModuleNotFoundError: No module named '(.*)'/,
      );
      if (moduleNotFoundMatch) {
        const packageName = moduleNotFoundMatch[1];
        await this.codebox.install(packageName);
        return `${packageName} was missing but got installed now. Please try again.`;
      }
      if (this.verbose) {
        console.error('Error:', output.content);
      }
    }

    // Check for file modifications
    const modifications = await getFileModifications(code, this.llm);
    if (modifications && modifications.length > 0) {
      for (const filename of modifications) {
        if (this.inputFiles.some((f) => f.name === filename)) {
          continue;
        }
        const fileBuffer = await this.codebox.download(filename);
        if (!fileBuffer.content) {
          continue;
        }
        this.outputFiles.push(new File(filename, Buffer.from(fileBuffer.content)));
      }
    }

    return output.content;
  }

  /**
   * Handle user input and file uploads
   */
  private async inputHandler(request: UserRequest): Promise<void> {
    if (!request.files || request.files.length === 0) {
      return;
    }

    if (!request.content) {
      request.content = 'I uploaded, just text me back and confirm that you got the file(s).';
    }

    request.content += '\n**The user uploaded the following files: **\n';
    for (const file of request.files) {
      this.inputFiles.push(file);
      request.content += `[Attachment: ${file.name}]\n`;
      await this.codebox.upload(file.name, file.content);
    }
    request.content += '**File(s) are now available in the cwd. **\n';
  }

  /**
   * Handle output and embed images in the response
   */
  private async outputHandler(finalResponse: string): Promise<CodeInterpreterResponse> {
    let processedResponse = finalResponse;

    // Remove image markdown
    for (const file of this.outputFiles) {
      if (processedResponse.includes(file.name)) {
        processedResponse = processedResponse.replace(/\n\n!\[.*\]\(.*\)/g, '');
      }
    }

    // Remove download links
    if (this.outputFiles.length > 0 && /\n\[.*\]\(.*\)/.test(processedResponse)) {
      try {
        processedResponse = await removeDownloadLink(processedResponse, this.llm);
      } catch (e) {
        if (this.verbose) {
          console.error('Error while removing download links:', e);
        }
      }
    }

    const outputFiles = [...this.outputFiles];
    const codeLog = [...this.codeLog];
    this.outputFiles = [];
    this.codeLog = [];

    return new CodeInterpreterResponse({
      content: processedResponse,
      files: outputFiles,
      codeLog,
    });
  }

  /**
   * Generate a response based on user input
   */
  async generateResponse(userMsg: string, files: File[] = []): Promise<CodeInterpreterResponse> {
    const userRequest = new UserRequest({ content: userMsg, files });
    try {
      await this.inputHandler(userRequest);
      if (!this.agentExecutor) {
        throw new Error('Session not initialized.');
      }
      const response = await this.agentExecutor.invoke({
        input: userRequest.content,
      });
      return await this.outputHandler(response.output);
    } catch (e: any) {
      if (this.verbose) {
        console.error(e);
      }
      if (this.config.detailedError) {
        return new CodeInterpreterResponse({
          content: `Error in CodeInterpreterSession: ${e.constructor.name} - ${e.message}`,
          files: [],
          codeLog: [],
        });
      } else {
        return new CodeInterpreterResponse({
          content:
            'Sorry, something went wrong while generating your response. ' +
            'Please try again or restart the session.',
          files: [],
          codeLog: [],
        });
      }
    }
  }

  /**
   * Check if the session is running
   */
  async isRunning(): Promise<boolean> {
    const status = await this.codebox.status();
    return status === 'running';
  }

  /**
   * Log message if verbose mode is enabled
   */
  private log(msg: string): void {
    if (this.verbose) {
      console.log(msg);
    }
  }

  /**
   * Stop the session
   */
  async stop(): Promise<SessionStatus> {
    const status = await this.codebox.stop();
    return SessionStatus.fromCodeBoxStatus(status);
  }
}
