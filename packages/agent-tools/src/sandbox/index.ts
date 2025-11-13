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
import {
  CodeInterpreterSession,
  File,
  CODE_INTERPRETER_SYSTEM_MESSAGE,
} from '@refly/sandbox-agent';
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
  downloadFile: (params: { storageKey: string; visibility?: FileVisibility }) => Promise<Buffer>;
  downloadFileFromUrl: (url: string) => Promise<Buffer>;
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
    previousFiles: z
      .array(
        z.object({
          storageKey: z.string().describe('Storage key of the file (e.g., static/xxx.csv)'),
          filename: z
            .string()
            .optional()
            .describe('Original filename if available (e.g., 13f-report.csv)'),
          description: z
            .string()
            .optional()
            .describe('Description of the file content (e.g., "13F quarterly report data")'),
        }),
      )
      .optional()
      .describe(
        'Files generated by previous tool executions. Extract storageKey and filename from previous tool outputs in the conversation history. The tool will automatically download and make these files available in the sandbox.',
      ),
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

## 📁 Working with Previous Tool Files

**IMPORTANT**: If previous tools (like apify-13f, web scrapers, etc.) generated files, you MUST extract their file metadata and pass it in the \`previousFiles\` parameter:

1. Look for file information in previous tool outputs (usually in the format):
   - Storage Key: static/xxx.csv
   - Filename: report.csv
   - Or in JSON: {"storageKey": "static/xxx.csv", "filename": "report.csv"}

2. Extract and pass the file metadata:
\`\`\`json
{
  "message": "Analyze the top 10 holdings",
  "previousFiles": [
    {
      "storageKey": "static/abc-123.csv",
      "filename": "13f-berkshire-q2-2024.csv",
      "description": "13F quarterly report data"
    }
  ]
}
\`\`\`

3. The tool will automatically download these files and make them available in the sandbox.

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

  /**
   * Process context files and convert them to File objects for sandbox upload
   */
  private async processContextFiles(): Promise<File[]> {
    const contextFiles: File[] = [];
    const context = this.params.context;

    if (!context || !this.params.reflyService) {
      return contextFiles;
    }

    try {
      // Process resources (documents like PDF, Word, etc.)
      if (context.resources && context.resources.length > 0) {
        for (const item of context.resources) {
          const resource = item?.resource;
          if (!resource?.storageKey) continue;

          try {
            const buffer = await this.params.reflyService?.downloadFile({
              storageKey: resource.storageKey,
              visibility: 'private',
            });
            if (!buffer) continue;

            const fileName = resource.title || resource.storageKey.split('/').pop() || 'resource';
            contextFiles.push(new File(fileName, buffer));
          } catch (error) {
            console.error(
              `Failed to download resource ${resource.resourceId ?? 'unknown'}:`,
              error,
            );
          }
        }
      }

      // Process documents (Refly documents)
      if (context.documents && context.documents.length > 0) {
        for (const item of context.documents) {
          const doc = item?.document;
          if (!doc?.docId) continue;

          try {
            // Save document content as markdown file
            const content = doc.content || '';
            const fileName = `${doc.title || doc.docId}.md`;
            const buffer = Buffer.from(content, 'utf-8');
            contextFiles.push(new File(fileName, buffer));
          } catch (error) {
            console.error(`Failed to process document ${doc.docId}:`, error);
          }
        }
      }

      // Process code artifacts
      if (context.codeArtifacts && context.codeArtifacts.length > 0) {
        for (const item of context.codeArtifacts) {
          const artifact = item?.codeArtifact;
          if (!artifact?.artifactId) continue;

          try {
            const content = artifact.content || '';
            // Use appropriate file extension based on artifact type
            const ext = this.getCodeFileExtension(artifact.type);
            const fileName = `${artifact.title || artifact.artifactId}.${ext}`;
            const buffer = Buffer.from(content, 'utf-8');
            contextFiles.push(new File(fileName, buffer));
          } catch (error) {
            console.error(`Failed to process code artifact ${artifact.artifactId}:`, error);
          }
        }
      }

      // Process media files (images, audio, video)
      if (context.mediaList && context.mediaList.length > 0) {
        for (const media of context.mediaList) {
          if (!media?.storageKey && !media?.url) continue;

          try {
            let buffer: Buffer | undefined;
            if (media.storageKey) {
              buffer = await this.params.reflyService?.downloadFile({
                storageKey: media.storageKey,
                visibility: 'private',
              });
            } else if (media.url) {
              buffer = await this.params.reflyService?.downloadFileFromUrl(media.url);
            }

            if (!buffer) continue;

            const fileName = media.title || media.entityId || 'media';
            contextFiles.push(new File(fileName, buffer));
          } catch (error) {
            console.error(`Failed to download media ${media.entityId ?? 'unknown'}:`, error);
          }
        }
      }

      // Process content list (plain text content)
      if (context.contentList && context.contentList.length > 0) {
        for (let i = 0; i < context.contentList.length; i++) {
          const item = context.contentList[i];
          if (!item?.content) continue;

          try {
            const fileName = `content_${i + 1}.txt`;
            const buffer = Buffer.from(item.content, 'utf-8');
            contextFiles.push(new File(fileName, buffer));
          } catch (error) {
            console.error(`Failed to process content item ${i}:`, error);
          }
        }
      }

      // Process URLs (save URL list as text file)
      if (context.urls && context.urls.length > 0) {
        try {
          const urlContent = context.urls
            .map((item) => item?.url)
            .filter(Boolean)
            .join('\n');
          const buffer = Buffer.from(urlContent, 'utf-8');
          contextFiles.push(new File('urls.txt', buffer));
        } catch (error) {
          console.error('Failed to process URL list:', error);
        }
      }
    } catch (error) {
      console.error('Error processing context files:', error);
    }

    return contextFiles;
  }

  /**
   * Get appropriate file extension for code artifact type
   */
  private getCodeFileExtension(type?: string): string {
    const extensionMap: Record<string, string> = {
      html: 'html',
      react: 'tsx',
      vue: 'vue',
      mermaid: 'mmd',
      svg: 'svg',
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rust: 'rs',
      ruby: 'rb',
      php: 'php',
      shell: 'sh',
      sql: 'sql',
      json: 'json',
      yaml: 'yaml',
      xml: 'xml',
      css: 'css',
      markdown: 'md',
    };

    return extensionMap[type?.toLowerCase() || ''] || 'txt';
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
          // Use optimized system message if not provided
          systemMessage: this.params.systemMessage || CODE_INTERPRETER_SYSTEM_MESSAGE,
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

      // Prepare files from input
      const inputFiles: File[] = [];
      if (input.files && input.files.length > 0) {
        for (const file of input.files) {
          const buffer = Buffer.from(file.content, 'base64');
          inputFiles.push(new File(file.name, buffer));
        }
      }

      // Download files from previousFiles parameter (LLM-extracted from chat history)
      const previousFiles: File[] = [];
      if (input.previousFiles && input.previousFiles.length > 0) {
        console.log(`Processing ${input.previousFiles.length} previous files from tool parameters`);
        for (const fileInfo of input.previousFiles) {
          try {
            const buffer = await this.params.reflyService?.downloadFile({
              storageKey: fileInfo.storageKey,
              visibility: 'private',
            });

            if (buffer) {
              const fileName = fileInfo.filename || fileInfo.storageKey.split('/').pop() || 'file';
              previousFiles.push(new File(fileName, buffer));
              console.log(
                `Downloaded previous file: ${fileName} from storageKey: ${fileInfo.storageKey}`,
              );
            }
          } catch (error) {
            console.error(
              `Failed to download previous file from storageKey ${fileInfo.storageKey}:`,
              error,
            );
          }
        }
      }

      // Process context files and merge with input files and previous files
      const contextFiles = await this.processContextFiles();
      const allFiles = [...previousFiles, ...contextFiles, ...inputFiles];

      // Build enhanced message with file information
      let enhancedMessage = input.message;

      // Add previousFiles information
      if (previousFiles.length > 0) {
        enhancedMessage += '\n\n**Files from Previous Tools:**\n';
        for (const file of previousFiles) {
          enhancedMessage += `- ${file.name}\n`;
        }
      }

      // Add context files information
      if (contextFiles.length > 0) {
        enhancedMessage += '\n\n**Context Files Available:**\n';
        for (const file of contextFiles) {
          enhancedMessage += `- ${file.name}\n`;
        }
      }

      // Add summary message
      if (previousFiles.length > 0 || contextFiles.length > 0) {
        enhancedMessage +=
          '\n\nAll these files have been uploaded to your workspace and are ready to use.';
      }

      // Generate response with all files
      const response = await session.generateResponse(enhancedMessage, allFiles);

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
      // The upper layer (skill-invoker) will handle adding nodes to canvas
      const uploadedFiles = [];
      // Track uploaded file content hashes to prevent duplicates within this response
      const uploadedContentHashes = new Set<string>();

      if (sandboxResponse.files.length > 0) {
        for (const file of sandboxResponse.files) {
          try {
            const base64Content = file.content.toString('base64');

            // Create a simple hash of the content to detect duplicates
            // Use first 100 chars + length as a simple dedup key
            const contentHash = `${file.name}:${base64Content.slice(0, 100)}:${base64Content.length}`;

            // Skip if this file content has already been uploaded in this batch
            if (uploadedContentHashes.has(contentHash)) {
              console.log(`Skipping duplicate file: ${file.name} (same content already uploaded)`);
              continue;
            }

            const entityId = await this.params.reflyService?.genImageID?.();
            const mimeType = this.getMimeType(file.name);
            const dataUrl = `data:${mimeType};base64,${base64Content}`;

            const uploaded = await this.params.reflyService?.uploadBase64?.(this.params.user, {
              base64: dataUrl,
              filename: file.name,
              entityId,
            });

            if (uploaded) {
              // Determine file type based on MIME type
              const fileType = this.getNodeTypeFromMimeType(mimeType);
              const fileData: any = {
                name: file.name,
                storageKey: uploaded.storageKey,
                url: uploaded.url,
                entityId,
                type: fileType,
                mimeType,
              };

              // Add artifactType for codeArtifact nodes
              if (fileType === 'codeArtifact') {
                fileData.artifactType = this.getCodeArtifactTypeFromMimeType(mimeType) || mimeType;
              }

              uploadedFiles.push(fileData);

              // Mark this content as uploaded
              uploadedContentHashes.add(contentHash);
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
          hasGeneratedFiles: uploadedFiles.length > 0,
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
      webp: 'image/webp',
      pdf: 'application/pdf',
      csv: 'text/csv',
      txt: 'text/plain',
      json: 'application/json',
      html: 'text/html',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      mp4: 'video/mp4',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Determine canvas node type based on MIME type
   */
  private getNodeTypeFromMimeType(
    mimeType: string,
  ): 'image' | 'audio' | 'video' | 'document' | 'codeArtifact' {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }
    if (mimeType.startsWith('audio/')) {
      return 'audio';
    }
    if (mimeType.startsWith('video/')) {
      return 'video';
    }
    // Check if it's a data file that should be a codeArtifact
    const codeArtifactMimeTypes = [
      'text/csv',
      'application/json',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/xml',
      'application/xml',
    ];
    if (codeArtifactMimeTypes.includes(mimeType)) {
      return 'codeArtifact';
    }
    return 'document';
  }

  /**
   * Get CodeArtifactType from MIME type
   */
  private getCodeArtifactTypeFromMimeType(
    mimeType: string,
  ):
    | 'text/csv'
    | 'application/json'
    | 'application/vnd.ms-excel'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    | undefined {
    const codeArtifactTypes = [
      'text/csv',
      'application/json',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ] as const;
    return codeArtifactTypes.find((type) => type === mimeType);
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
