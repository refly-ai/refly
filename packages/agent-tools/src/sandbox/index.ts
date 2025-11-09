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
// @ts-ignore - Package import will be resolved at runtime
import { CodeInterpreterSession, File } from '@refly/sandbox-agent';
import { SandboxToolParams, SandboxCodeInterpreterResponse } from './types';

export interface ReflyService {
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
 * Toolset definition for Sandbox agent-tool.
 * Provides AI-powered code interpreter capabilities for comprehensive data analysis and processing.
 */
export const SandboxToolsetDefinition: ToolsetDefinition = {
  key: 'sandbox',
  domain: 'https://refly.ai/',
  labelDict: {
    en: 'Sandbox Code Interpreter',
    'zh-CN': '沙箱代码解释器',
  },
  descriptionDict: {
    en: `AI-powered code interpreter with comprehensive capabilities for data analysis, visualization, file processing, and automation. Perfect for:

• **Data Analysis**: Process CSV/JSON/Excel files, statistical analysis, time series analysis, correlation analysis
• **Data Visualization**: Create charts (bar, line, scatter, pie, heatmap), dashboards, interactive plots  
• **File Processing**: Format conversion (CSV↔JSON↔Excel), data cleaning, merging, splitting
• **Math & Statistics**: Probability calculations, hypothesis testing, regression analysis, optimization
• **Machine Learning**: Classification, clustering, feature engineering, time series forecasting
• **Audio/Video Processing**: Video editing, audio mixing, format conversion, subtitle processing
• **Web Automation**: Browser automation, web scraping, form filling, content extraction
• **Frontend Development**: Create React/Vue apps, data dashboards, interactive visualizations

Pre-installed libraries: pandas, numpy, matplotlib, seaborn, scikit-learn, opencv, moviepy, playwright, and more.`,
    'zh-CN': `AI驱动的代码解释器，具备全面的数据分析、可视化、文件处理和自动化能力。适用于：

• **数据分析**: 处理CSV/JSON/Excel文件，统计分析，时间序列分析，相关性分析
• **数据可视化**: 创建图表（柱状图、折线图、散点图、饼图、热力图）、仪表板、交互式图表
• **文件处理**: 格式转换（CSV↔JSON↔Excel）、数据清洗、合并、拆分
• **数学统计**: 概率计算、假设检验、回归分析、优化问题
• **机器学习**: 分类、聚类、特征工程、时间序列预测
• **音视频处理**: 视频编辑、音频混音、格式转换、字幕处理
• **网页自动化**: 浏览器自动化、网页爬取、表单填写、内容提取
• **前端开发**: 创建React/Vue应用、数据仪表板、交互式可视化

预装库：pandas, numpy, matplotlib, seaborn, scikit-learn, opencv, moviepy, playwright等。`,
  },
  tools: [
    {
      name: 'generateResponse',
      descriptionDict: {
        en: 'Execute code and generate comprehensive responses with data analysis, visualization, and file processing capabilities',
        'zh-CN': '执行代码并生成包含数据分析、可视化和文件处理功能的综合响应',
      },
    },
  ],
  requiresAuth: false,
  authPatterns: [],
  configItems: [],
};

// Global session storage for managing sessions across tool calls
const sessionStorage = new Map<string, CodeInterpreterSession>();

/**
 * Ensure API key is set in environment variable.
 * This is required by some underlying SDKs that expect the API key in process.env.
 */
function ensureApiKey(apiKey?: string): void {
  if (apiKey && (!process.env.SCALEBOX_API_KEY || process.env.SCALEBOX_API_KEY !== apiKey)) {
    process.env.SCALEBOX_API_KEY = apiKey;
  }
}

/**
 * Generate response using code interpreter
 */
export class SandboxGenerateResponse extends AgentBaseTool<SandboxToolParams> {
  name = 'generateResponse';
  toolsetKey = SandboxToolsetDefinition.key;

  schema = z.object({
    sessionId: z
      .string()
      .optional()
      .describe(
        'Existing session ID to use for conversation continuity. If not provided, a new session will be created automatically.',
      ),
    message: z.string().describe('The message or request to send to the code interpreter'),
    files: z
      .array(
        z.object({
          name: z.string().describe('File name'),
          content: z.string().describe('Base64 encoded file content'),
        }),
      )
      .optional()
      .describe('Optional files to upload with the request'),
    options: z
      .object({
        verbose: z.boolean().optional().describe('Enable verbose logging').default(true),
        additionalTools: z.array(z.any()).optional().describe('Additional tools to provide'),
        callbacks: z.array(z.any()).optional().describe('Callback functions'),
      })
      .optional()
      .describe('Session options'),
  });

  description = `Generate comprehensive responses using the AI-powered code interpreter. This tool excels at data analysis, visualization, file processing, and automation tasks.

## 🎯 Core Capabilities

### 📊 Data Analysis & Statistics
**Libraries**: pandas, numpy, scipy, statsmodels
**Examples**:
- "Analyze sales.csv: calculate basic statistics (mean, median, std) for each column"
- "Perform correlation analysis on customer_data.csv and create a heatmap"
- "Detect outliers in revenue.csv using IQR method and visualize them"
- "Conduct A/B test analysis: compare two groups and perform t-test (α=0.05)"

### 📈 Data Visualization  
**Libraries**: matplotlib, seaborn, plotly, bokeh
**Examples**:
- "Create a bar chart showing top 10 products by sales from data.csv"
- "Generate a 2x2 subplot dashboard: sales trend, category pie chart, scatter plot, box plot"
- "Create an interactive time series plot with moving averages"
- "Build a correlation heatmap with annotations"

### 🔄 File Processing & Conversion
**Libraries**: pandas, openpyxl, json, csv
**Examples**:
- "Convert sales.csv to JSON format and save as sales.json"
- "Clean raw_data.csv: remove duplicates, fill missing values (numeric: mean, categorical: mode)"
- "Split large_dataset.csv by year into separate files: data_2021.csv, data_2022.csv, etc."
- "Merge customers.csv and orders.csv on customer_id and analyze purchase behavior"

### 🧮 Math & Machine Learning
**Libraries**: scikit-learn, tensorflow, xgboost, prophet
**Examples**:
- "Build a linear regression model to predict house prices using housing.csv"
- "Perform K-means clustering (k=4) on customer data and visualize clusters"
- "Create a classification model for customer churn prediction with accuracy metrics"
- "Forecast next 30 days sales using ARIMA or Prophet model"

### 🎵 Audio/Video Processing
**Libraries**: moviepy, pydub, ffmpeg-python, librosa, opencv-python
**Examples**:
- "Merge audio1.mp3, audio2.mp3, audio3.mp3 into one file with fade transitions"
- "Extract audio from video.mp4 and save as audio.mp3"
- "Add background_music.mp3 to video.mp4 with 70% original audio, 30% background music"
- "Convert video.mp4 first 5 seconds to GIF at 480p, 10fps"
- "Add subtitles.srt to video.mp4 with white text and black outline"

### 🌐 Web Automation & Scraping
**Libraries**: playwright, selenium, beautifulsoup4, requests
**Examples**:
- "Scrape news headlines from website homepage and save to news.csv"
- "Take screenshots of all URLs in urls.txt and save as page_1.png, page_2.png"
- "Extract table data from webpage with pagination support"
- "Download all PDF files from document sharing page"

### 💻 Frontend Web Development
**Libraries**: Built-in Node.js, React, Vue, Vite, Express
**Examples**:
- "Create a React dashboard for sales.csv with interactive charts using Chart.js"
- "Build a Vue.js customer management app with search and filtering"
- "Generate an HTML report page with embedded charts and data tables"
- "Create a real-time monitoring dashboard with WebSocket updates"

## 📝 Usage Patterns

**Single File Analysis**:
\`\`\`
message: "Analyze sales.csv and create a summary report with key insights"
files: [{ name: "sales.csv", content: "base64_content" }]
\`\`\`

**Session Continuity (Recommended)**:
\`\`\`
// First call - creates new session
{ message: "Load and clean the sales data from sales.csv", files: [...] }
// Response includes sessionId: "session_abc123"

// Subsequent calls - reuse session for context
{ sessionId: "session_abc123", message: "Now create a bar chart of top products" }
{ sessionId: "session_abc123", message: "Calculate correlation with customer demographics" }
\`\`\`

**Multi-step Processing**:
\`\`\`
message: "1. Clean the data 2. Perform statistical analysis 3. Create visualizations 4. Generate summary report"
\`\`\`

**Code Execution**:
\`\`\`
message: "Calculate the correlation between temperature and ice cream sales, then create a scatter plot with regression line"
\`\`\`

**File Generation**:
\`\`\`
message: "Process customer_data.csv and generate: 1) cleaned_data.csv 2) analysis_report.pdf 3) charts.png"
\`\`\`

## 🔧 Available Libraries
**Data**: pandas, numpy, scipy, openpyxl, xlrd, json, csv, sqlite3
**Visualization**: matplotlib, seaborn, plotly, bokeh, chart.js (web)
**ML/Stats**: scikit-learn, tensorflow, xgboost, prophet, statsmodels
**Media**: moviepy, pydub, ffmpeg-python, librosa, opencv-python, PIL
**Web**: playwright, selenium, beautifulsoup4, requests, flask, fastapi
**Frontend**: Node.js, React, Vue, Vite, Express, Chart.js, D3.js

## 💡 Pro Tips
- **Session Management**: Use sessionId for multi-step analysis to maintain variable context
- **Output Format**: Always specify desired output format (CSV, PNG, JSON, etc.)
- **Detailed Requirements**: Include specific requirements (chart colors, statistical significance levels)
- **Large Datasets**: For large datasets, mention if you need sampling or chunking
- **Explanations**: Request explanations of results for better understanding
- **Task Combination**: Combine multiple related tasks in one request for efficiency
- **Library Usage**: Mention specific libraries if you have preferences (e.g., "use seaborn for visualization")
- **File Naming**: Specify meaningful file names for generated outputs`;

  protected params: SandboxToolParams;

  constructor(params: SandboxToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    // Ensure API key is set in environment variable for underlying SDKs
    ensureApiKey(this.params.apiKey);

    try {
      let session: CodeInterpreterSession;
      let sessionId = input.sessionId;

      // Create session options with engine-based LLM if available
      const createSessionOptions = () => {
        const baseOptions = {
          ...input.options,
          // Pass API key to session - it will use it if environment variable is not set
          apiKey: this.params.apiKey ?? process.env.SCALEBOX_API_KEY,
          detailedError: this.params.detailedError,
          systemMessage: this.params.systemMessage,
          requestTimeout: this.params.requestTimeout,
          maxIterations: this.params.maxIterations,
          maxRetry: this.params.maxRetry,
          customPackages: this.params.customPackages,
        };

        // If engine is available, use it to create LLM instance for proper token tracking
        if (this.params.engine) {
          const llm = this.params.engine.chatModel({
            temperature: this.params.temperature ?? 0.1,
          });
          return {
            ...baseOptions,
            llm, // Pass LLM instance directly for token usage tracking
          };
        }

        // Fallback to manual configuration when engine is not available
        return {
          ...baseOptions,
          openaiApiKey: this.params.openaiApiKey,
          openaiBaseUrl: this.params.openaiBaseUrl,
          azureOpenAIApiKey: this.params.azureOpenAIApiKey,
          azureApiBase: this.params.azureApiBase,
          azureApiVersion: this.params.azureApiVersion,
          azureDeploymentName: this.params.azureDeploymentName,
          anthropicApiKey: this.params.anthropicApiKey,
          model: this.params.model,
          temperature: this.params.temperature,
        };
      };

      // Get or create session
      if (sessionId && sessionStorage.has(sessionId)) {
        session = sessionStorage.get(sessionId)!;
        // Verify session is still running
        const isRunning = await session.isRunning();
        if (!isRunning) {
          // Session expired, create new one
          sessionStorage.delete(sessionId);
          session = new CodeInterpreterSession(createSessionOptions());
          await session.start();
          sessionId = session.sessionId || `session_${Date.now()}`;
          if (sessionId) {
            sessionStorage.set(sessionId, session);
          }
        }
      } else {
        // Create new session
        session = new CodeInterpreterSession(createSessionOptions());
        await session.start();
        sessionId = session.sessionId || `session_${Date.now()}`;
        if (sessionId) {
          sessionStorage.set(sessionId, session);
        }
      }

      // Prepare files if provided
      const files: File[] = [];
      if (input.files && input.files.length > 0) {
        for (const file of input.files) {
          const buffer = Buffer.from(file.content, 'base64');
          files.push(new File(file.name, buffer));
        }
      }

      // Generate response
      const response = await session.generateResponse(input.message, files);

      // Convert response to our format
      const sandboxResponse: SandboxCodeInterpreterResponse = {
        content: response.content,
        files: response.files.map((f: any) => ({
          name: f.name,
          content: f.content,
        })),
        codeLog: response.codeLog,
      };

      // Upload generated files if any
      const uploadedFiles = [];
      if (sandboxResponse.files.length > 0) {
        for (const file of sandboxResponse.files) {
          try {
            const entityId = await this.params.reflyService?.genImageID?.();
            const base64Content = file.content.toString('base64');
            const mimeType = this.getMimeType(file.name);
            const dataUrl = `data:${mimeType};base64,${base64Content}`;

            const uploaded = await this.params.reflyService?.uploadBase64?.(this.params.user, {
              base64: dataUrl,
              filename: file.name,
              entityId,
            });

            if (uploaded) {
              uploadedFiles.push({
                name: file.name,
                storageKey: uploaded.storageKey,
                url: uploaded.url,
              });
            }
          } catch (uploadError) {
            console.error('Failed to upload file:', file.name, uploadError);
          }
        }
      }

      return {
        status: 'success',
        data: {
          sessionId,
          response: sandboxResponse,
          uploadedFiles,
          codeExecutions: sandboxResponse.codeLog.length,
        },
        summary: `Generated response with ${sandboxResponse.codeLog.length} code executions and ${uploadedFiles.length} files`,
        creditCost: Math.max(1, sandboxResponse.codeLog.length),
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to generate response',
        summary:
          error instanceof Error ? error.message : 'Unknown error during response generation',
      };
    }
  }

  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
      csv: 'text/csv',
      txt: 'text/plain',
      json: 'application/json',
      html: 'text/html',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}

/**
 * Sandbox toolset that provides AI-powered code interpreter capabilities
 */
export class SandboxToolset extends AgentBaseToolset<SandboxToolParams> {
  toolsetKey = SandboxToolsetDefinition.key;
  tools = [SandboxGenerateResponse] satisfies readonly AgentToolConstructor<SandboxToolParams>[];
}

// Export types for external use
export type {
  SandboxToolParams,
  GenerateResponseInput,
  SandboxFile,
  SandboxCodeInterpreterResponse,
  SandboxSessionStatus,
} from './types';
