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
import { removeDownloadLink } from './chains';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { formatToOpenAIToolMessages } from 'langchain/agents/format_scratchpad/openai_tools';
import { OpenAIToolsAgentOutputParser } from 'langchain/agents/openai/output_parser';
import { v4 as uuidv4 } from 'uuid';

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

    // Set working directory to /workspace
    await this.codebox.run(
      'import os; os.chdir("/workspace"); print(f"Working directory: {os.getcwd()}")',
    );

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
      description: `Execute Python code in an IPython interpreter with persistent state across executions.

IMPORTANT GUIDELINES:
1. **Write Complete, Comprehensive Code**: Write all necessary code in ONE execution to fully accomplish the task. Include data loading, processing, visualization, and saving in a single code block.

2. **Minimize Iterations**: Avoid splitting tasks into multiple small executions. Write robust, complete code that handles the entire workflow at once.

3. **MANDATORY Output Confirmation (CRITICAL)**: 
   - ALWAYS print confirmation messages IMMEDIATELY after saving any files
   - After plt.savefig(), add: print(f"✓ Image saved: {filename}")
   - After df.to_csv(), add: print(f"✓ CSV saved: {filename}")
   - After any file save, add: print(f"✓ File saved: {filename}")
   - These print statements are REQUIRED for file detection and confirmation
   - The system uses these prints to verify successful file creation

4. **Task Completion Signals**: When you create files (images, CSVs, etc.), the system will automatically notify you with "✓ File(s) successfully created and saved". This means the task is COMPLETE - do NOT create variations or additional versions unless explicitly requested.

5. **Semantic File Naming (CRITICAL)**: 
   - ALWAYS use meaningful, descriptive filenames that reflect the content
   - Use snake_case (e.g., 'sales_trend_2024.png', 'customer_analysis.csv')
   - Include the type of visualization/data in the name
   - Examples: 'bar_chart.png', 'temperature_trend.png', 'revenue_by_region.csv'
   - AVOID: generic names like 'output.png', 'chart.png', 'data.csv'

6. **Code Format**: 
   - Write entire code in a single string
   - Use semicolons to separate statements if needed
   - Start code immediately after opening quote (no leading newline)
   - Variables and state persist between executions

7. **Available Packages**: numpy, pandas, matplotlib, seaborn, scikit-learn, PIL/Pillow, scipy, and more${
        this.config.customPackages.length > 0
          ? `. Custom packages: ${this.config.customPackages.join(', ')}`
          : ''
      }

8. **File Operations**: Files are automatically saved and sent to the user. You'll receive confirmation when complete.

Example of GOOD code (with MANDATORY print statements):
\`\`\`python
import pandas as pd
import matplotlib.pyplot as plt

# Load and analyze sales data
sales_data = pd.read_csv('sales.csv')
monthly_summary = sales_data.groupby('month')['revenue'].sum()

# Create visualization with semantic filename
plt.figure(figsize=(12, 6))
plt.bar(monthly_summary.index, monthly_summary.values)
plt.title('Monthly Revenue Trends')
plt.xlabel('Month')
plt.ylabel('Revenue ($)')
plt.savefig('monthly_revenue_chart.png')
print("✓ Image saved: monthly_revenue_chart.png")  # ✅ REQUIRED print statement

# Export summary with semantic filename
monthly_summary.to_csv('revenue_summary_by_month.csv')
print("✓ CSV saved: revenue_summary_by_month.csv")  # ✅ REQUIRED print statement
\`\`\`

Example of BAD code (missing print statements or generic filenames):
\`\`\`python
plt.savefig('chart.png')  # ❌ Too generic + missing print
df.to_csv('output.csv')   # ❌ No context + missing print

# Should be:
plt.savefig('monthly_sales_chart.png')
print("✓ Image saved: monthly_sales_chart.png")

df.to_csv('sales_data_export.csv')
print("✓ CSV saved: sales_data_export.csv")
\`\`\``,
      schema: z.object({
        code: z.string().describe('Complete Python code to execute the entire task'),
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
        configuration: {
          apiKey: this.config.azureOpenAIApiKey,
          baseURL: this.config.azureApiBase,
          defaultQuery: { 'api-version': this.config.azureApiVersion },
          defaultHeaders: { 'api-key': this.config.azureOpenAIApiKey },
        },
        modelName: this.config.azureDeploymentName,
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
   * Generate semantic filename for images based on code content
   */
  private generateSemanticImageName(code: string): string {
    const lowerCode = code.toLowerCase();

    // Extract common visualization types
    if (lowerCode.includes('bar') && lowerCode.includes('chart')) return 'bar_chart';
    if (lowerCode.includes('line') && lowerCode.includes('chart')) return 'line_chart';
    if (lowerCode.includes('pie') && lowerCode.includes('chart')) return 'pie_chart';
    if (
      lowerCode.includes('scatter') &&
      (lowerCode.includes('plot') || lowerCode.includes('chart'))
    )
      return 'scatter_plot';
    if (lowerCode.includes('histogram')) return 'histogram';
    if (lowerCode.includes('heatmap')) return 'heatmap';
    if (lowerCode.includes('boxplot') || lowerCode.includes('box plot')) return 'boxplot';
    if (lowerCode.includes('violin') && lowerCode.includes('plot')) return 'violin_plot';

    // Extract subject matter
    if (lowerCode.includes('temperature')) return 'temperature_chart';
    if (lowerCode.includes('sales')) return 'sales_chart';
    if (lowerCode.includes('revenue')) return 'revenue_chart';
    if (lowerCode.includes('trend')) return 'trend_analysis';
    if (lowerCode.includes('distribution')) return 'distribution_plot';
    if (lowerCode.includes('correlation')) return 'correlation_matrix';
    if (lowerCode.includes('comparison')) return 'comparison_chart';
    if (lowerCode.includes('combined') || lowerCode.includes('merge'))
      return 'combined_visualization';

    // Check for plot/figure
    if (lowerCode.includes('plot') || lowerCode.includes('plt.')) return 'plot';
    if (lowerCode.includes('figure') || lowerCode.includes('fig')) return 'figure';

    // Fallback to generic name with timestamp
    return `visualization_${Date.now()}`;
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
      // Use filename from metadata if available, otherwise generate semantic name
      const filename = `image-${uuidv4()}.png`;

      const imageBuffer = Buffer.from(output.content, 'base64');
      this.outputFiles.push(new File(filename, imageBuffer));

      // Provide clear completion signal
      return `✓ Image successfully generated and saved as "${filename}". The image has been sent to the user. 
      Python run code stdout: ${output.stdout}
      Task completed.`;
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
      // Don't try to download files if code execution failed
      return output.content;
    }

    // // Check for file modifications (only if code executed successfully)
    // // First, try to use extracted metadata from code
    // let filesToDownload: string[] = [];

    // if (output.files && output.files.length > 0) {
    //   // Use filenames extracted from code (e.g., plt.savefig('chart.png'))
    //   filesToDownload = output.files.map((f) => f.filename!).filter(Boolean);
    //   console.log(`[Session] Using extracted filenames from code: ${filesToDownload.join(', ')}`);
    // } else {
    //   // Fallback to LLM-based modification detection
    //   // const modifications = await getFileModifications(code, this.llm);
    //   // if (modifications && modifications.length > 0) {
    //   //   filesToDownload = modifications;
    //   //   console.log(`[Session] Using LLM-detected modifications: ${filesToDownload.join(', ')}`);
    //   // }
    // }

    // if (filesToDownload.length > 0) {
    //   const savedFiles: string[] = [];
    //   for (const filename of filesToDownload) {
    //     if (this.inputFiles.some((f) => f.name === filename)) {
    //       continue;
    //     }
    //     // Try to download from /workspace directory
    //     let fileBuffer = await this.codebox.download(filename);

    //     // If not found, try with /workspace/ prefix
    //     if (!fileBuffer.content && !filename.startsWith('/workspace/')) {
    //       fileBuffer = await this.codebox.download(`/workspace/${filename}`);
    //     }

    //     if (!fileBuffer.content) {
    //       console.warn(`[CodeBox] Failed to download file: ${filename}`);
    //       continue;
    //     }
    //     this.outputFiles.push(new File(filename, Buffer.from(fileBuffer.content)));
    //     savedFiles.push(filename);
    //   }

    //   // Append clear success message about saved files
    //   if (savedFiles.length > 0) {
    //     const fileList = savedFiles.map((f) => `"${f}"`).join(', ');
    //     return `${output.content}\n\n✓ File(s) successfully created and saved: ${fileList}. These files have been sent to the user.
    //     Python run code stdout: ${output?.stdout}

    //     Task completed.`;
    //   }
    // }

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

    // Ensure we're working in /workspace directory
    await this.codebox.run('import os; os.chdir("/workspace")');

    request.content += '\n**The user uploaded the following files: **\n';
    for (const file of request.files) {
      this.inputFiles.push(file);
      const uploadedPath = await this.codebox.upload(file.name, file.content);
      request.content += `[Attachment: ${file.name}] (available at: ${uploadedPath})\n`;
    }
    request.content +=
      '**File(s) are now available in the current working directory (/workspace). **\n';
    request.content +=
      '**You can access them directly by filename (e.g., "image.png") or with full path ("/workspace/image.png"). **\n';
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

    // Add detailed file summary if files were generated
    if (this.outputFiles.length > 0) {
      const fileDescriptions = this.outputFiles
        .map((file) => {
          const sizeKB = (file.content.length / 1024).toFixed(2);
          const type = file.name.endsWith('.png')
            ? 'Image (PNG)'
            : file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')
              ? 'Image (JPEG)'
              : file.name.endsWith('.csv')
                ? 'CSV Data'
                : file.name.endsWith('.json')
                  ? 'JSON Data'
                  : file.name.endsWith('.txt')
                    ? 'Text File'
                    : 'File';
          return `  • ${file.name} (${type}, ${sizeKB} KB)`;
        })
        .join('\n');

      // Only append if not already mentioned in response
      if (
        !processedResponse.includes('File(s) successfully created') &&
        !processedResponse.includes('Task completed')
      ) {
        processedResponse += `\n\n✓ Generated ${this.outputFiles.length} file(s):\n${fileDescriptions}\n\nAll files have been delivered to you successfully.`;
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
