/**
 * CodeInterpreter type definitions
 *
 * This module defines the TypeScript interfaces and types used throughout the
 * Code Interpreter SDK. These types bridge between the generated protobuf types
 * and the public API, providing a clean and ergonomic interface for SDK users.
 */

/**
 * Supported programming languages for code execution
 * These correspond to the runtime environments available in the sandbox
 */
export type Language =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'r'
  | 'java'
  | 'bash'
  | 'node'
  | 'nodejs'
  | 'deno';

/**
 * Chart type enumeration
 */
export enum ChartType {
  LINE = 'line',
  SCATTER = 'scatter',
  BAR = 'bar',
  PIE = 'pie',
  BOX_AND_WHISKER = 'box_and_whisker',
  SUPERCHART = 'superchart',
  UNKNOWN = 'unknown',
}

/**
 * Axis scale types
 */
export enum ScaleType {
  LINEAR = 'linear',
  DATETIME = 'datetime',
  CATEGORICAL = 'categorical',
  LOG = 'log',
  SYMLOG = 'symlog',
  LOGIT = 'logit',
  FUNCTION = 'function',
  FUNCTIONLOG = 'functionlog',
  ASINH = 'asinh',
  UNKNOWN = 'unknown',
}

/**
 * Base chart interface
 */
export interface Chart {
  type: ChartType;
  title: string;
  elements: any[];
}

/**
 * 2D chart interface
 */
export interface Chart2D extends Chart {
  xLabel?: string;
  yLabel?: string;
  xUnit?: string;
  yUnit?: string;
}

/**
 * Point data
 */
export interface PointData {
  label: string;
  points: Array<[string | number, string | number]>;
}

/**
 * Point chart interface (scatter plot, line chart)
 */
export interface PointChart extends Chart2D {
  xTicks: Array<string | number>;
  xTickLabels: string[];
  xScale: ScaleType;
  yTicks: Array<string | number>;
  yTickLabels: string[];
  yScale: ScaleType;
  elements: PointData[];
}

/**
 * Bar chart data
 */
export interface BarData {
  label: string;
  group: string;
  value: string | number;
}

/**
 * Bar chart interface
 */
export interface BarChart extends Chart2D {
  type: ChartType.BAR;
  elements: BarData[];
}

/**
 * Pie chart data
 */
export interface PieData {
  label: string;
  angle: number;
  radius: number;
}

/**
 * Pie chart interface
 */
export interface PieChart extends Chart {
  type: ChartType.PIE;
  elements: PieData[];
}

/**
 * Box and whisker chart data
 */
export interface BoxAndWhiskerData {
  label: string;
  min: number;
  firstQuartile: number;
  median: number;
  thirdQuartile: number;
  max: number;
  outliers: number[];
}

/**
 * Box and whisker chart interface
 */
export interface BoxAndWhiskerChart extends Chart2D {
  type: ChartType.BOX_AND_WHISKER;
  elements: BoxAndWhiskerData[];
}

/**
 * Composite chart
 */
export interface SuperChart extends Chart {
  type: ChartType.SUPERCHART;
  elements: ChartTypes[];
}

export type ChartTypes = PointChart | BarChart | PieChart | BoxAndWhiskerChart | SuperChart;

export interface CodeInterpreterOpts {
  /**
   * Template ID
   * @default 'code-interpreter'
   */
  templateId?: string;

  /**
   * Timeout duration (milliseconds)
   * @default 300000
   */
  timeout?: number;

  /**
   * Metadata
   * @default {}
   */
  metadata?: Record<string, string>;

  /**
   * Environment variables
   * @default {}
   */
  envs?: Record<string, string>;

  /**
   * API key
   */
  apiKey?: string;

  /**
   * API URL
   */
  apiUrl?: string;

  /**
   * Request timeout (milliseconds)
   * @default 30000
   */
  requestTimeoutMs?: number;

  /**
   * Debug mode
   * @default false
   */
  debug?: boolean;

  /**
   * Allow internet access
   * @default true
   */
  allowInternetAccess?: boolean;

  /**
   * Secure mode
   * @default true
   */
  secure?: boolean;

  /**
   * Auto pause
   * @default false
   */
  autoPause?: boolean;
}

/**
 * Code execution context
 *
 * A context maintains the state across multiple code executions,
 * including variables, imports, and runtime state. This is similar
 * to a Jupyter notebook kernel.
 *
 * @property id - Unique context identifier
 * @property language - Programming language for this context
 * @property cwd - Working directory for code execution
 * @property createdAt - Context creation timestamp
 * @property envVars - Environment variables for this context
 * @property metadata - Additional metadata for the context
 */
export interface CodeContext {
  id: string;
  language: Language;
  cwd?: string;
  createdAt: Date;
  envVars?: Record<string, string>;
  metadata?: Record<string, string>;
}

export interface CodeExecutionOpts {
  /**
   * Programming language
   */
  language: Language;

  /**
   * Working directory
   */
  cwd?: string;

  /**
   * Execution context
   */
  context?: CodeContext;

  /**
   * Environment variables
   */
  envVars?: Record<string, string>;

  /**
   * Environment variables (compatible with envVars)
   */
  envs?: Record<string, string>;

  /**
   * Timeout duration (milliseconds)
   * @default 60000
   */
  timeout?: number;

  /**
   * Request timeout (milliseconds)
   * @default 30000
   */
  requestTimeout?: number;

  /**
   * Whether to run in background
   * @default false
   */
  background?: boolean;

  /**
   * User
   * @default 'user'
   */
  user?: string;

  /**
   * Callback functions
   */
  onStdout?: (msg: OutputMessage) => void;
  onStderr?: (msg: OutputMessage) => void;
  onResult?: (result: Result) => void;
  onError?: (error: ExecutionError) => void;
  onExit?: (exitCode: number) => void;
}

/**
 * Code execution result
 *
 * Represents the complete result of a code execution, including
 * all outputs, errors, and metadata. This is the primary return
 * type for code execution methods.
 *
 * The result includes:
 * - Standard output/error streams
 * - Rich media outputs (images, HTML, charts, etc.)
 * - Execution metadata (timing, status, etc.)
 * - Error information if the execution failed
 */
export interface ExecutionResult {
  /**
   * Standard output - All stdout content as a single string
   */
  stdout: string;

  /**
   * Standard error - All stderr content as a single string
   */
  stderr: string;

  /**
   * Exit code - 0 for success, non-zero for failure
   */
  exitCode: number;

  /**
   * Error information - Present if execution failed
   */
  error?: ExecutionError;

  /**
   * Text result
   */
  text?: string;

  /**
   * PNG image data
   */
  png?: string;

  /**
   * SVG image data
   */
  svg?: string;

  /**
   * HTML content
   */
  html?: string;

  /**
   * Execution logs
   */
  logs: {
    stdout: string;
    stderr: string;
    output: OutputMessage[];
    errors: ExecutionError[];
  };

  /**
   * Execution result
   */
  result?: Result;

  /**
   * Whether successful
   */
  success: boolean;

  /**
   * Execution time (milliseconds)
   */
  executionTime: number;

  /**
   * Programming language
   */
  language: Language;

  /**
   * Execution results (may contain multiple results)
   */
  results?: Result[];

  /**
   * Execution context
   */
  context?: CodeContext;

  /**
   * Process ID
   */
  pid?: number;
}

export interface OutputMessage {
  content: string;
  timestamp: Date;
  type?: 'stdout' | 'stderr' | 'result' | 'error';
  error?: boolean;
}

/**
 * Execution response type - Streaming event from gRPC
 *
 * Represents a single event in the execution stream. Each execution
 * may produce multiple events of different types (stdout, stderr, result, error).
 *
 * This type corresponds to the ExecuteResponse message from the protobuf definition.
 * It uses a discriminated union pattern where only one event type is present at a time.
 *
 * Event types:
 * - stdout: Standard output content
 * - stderr: Standard error content
 * - result: Rich execution result (images, charts, etc.)
 * - error: Execution error with traceback
 */
export interface ExecutionResponse {
  /**
   * Standard output event
   */
  stdout?: {
    content: string;
  };
  /**
   * Standard error event
   */
  stderr?: {
    content: string;
  };
  /**
   * Execution result event - Contains rich media and metadata
   */
  result?: {
    exitCode: number;
    startedAt?: Date;
    finishedAt?: Date;
    text?: string;
    html?: string;
    markdown?: string;
    svg?: string;
    png?: string;
    jpeg?: string;
    pdf?: string;
    latex?: string;
    json?: string;
    javascript?: string;
    data?: string;
    chart?: ChartTypes;
    executionCount?: number;
    isMainResult?: boolean;
    extra?: Record<string, any>;
  };
  /**
   * Error event - Execution failure information
   */
  error?: {
    name: string;
    value: string;
    traceback: string;
  };
}

/**
 * Output handler type
 */
export type OutputHandler<T> = (message: T) => void | Promise<void>;

/**
 * Asynchronous iterable execution response
 */
export interface ExecutionStream {
  [Symbol.asyncIterator](): AsyncIterableIterator<ExecutionResponse>;
}

export interface Result {
  /**
   * Text result
   */
  text?: string;

  /**
   * HTML result
   */
  html?: string;

  /**
   * Markdown result
   */
  markdown?: string;

  /**
   * SVG image
   */
  svg?: string;

  /**
   * PNG image
   */
  png?: string;

  /**
   * JPEG image
   */
  jpeg?: string;

  /**
   * PDF document
   */
  pdf?: string;

  /**
   * LaTeX document
   */
  latex?: string;

  /**
   * JSON data
   */
  json?: string;

  /**
   * JavaScript code
   */
  javascript?: string;

  /**
   * Data result
   */
  data?: string;

  /**
   * Chart data
   */
  chart?: ChartTypes;

  /**
   * Execution count
   */
  executionCount?: number;

  /**
   * Whether main result
   */
  isMainResult?: boolean;

  /**
   * Extra data
   */
  extra?: Record<string, any>;
}

export interface ExecutionError {
  name: string;
  value: string;
  message: string;
  stack?: string;
  code?: string;
  details?: any;
  traceback?: string;
}

/**
 * Command execution handle
 */
export interface CommandHandle {
  /**
   * Process ID
   */
  pid: number;

  /**
   * Wait for command completion
   */
  wait(): Promise<ExecutionResult>;

  /**
   * Terminate command
   */
  kill(): Promise<void>;

  /**
   * Check if running
   */
  isRunning(): boolean;
}

/**
 * Code execution handle
 */
export interface CodeExecutionHandle extends CommandHandle {
  /**
   * Execution context
   */
  context: CodeContext;

  /**
   * Programming language
   */
  language: Language;
}

export type FileVisibility = 'public' | 'private';

export type BaseResponse = {
  /**
   * Whether the operation was successful
   */
  success: boolean;
  /**
   * Error code
   */
  errCode?: string;
  /**
   * Error message
   */
  errMsg?: string;
  /**
   * Trace ID
   */
  traceId?: string;
  /**
   * Error stack (only returned in development environment)
   */
  stack?: string;
};

export type UploadResponse = BaseResponse & {
  /**
   * File upload result
   */
  data?: {
    /**
     * File URL
     */
    url: string;
    /**
     * Storage key
     */
    storageKey: string;
  };
};

/**
 * Entity type
 */
export type EntityType =
  | 'document'
  | 'resource'
  | 'canvas'
  | 'share'
  | 'user'
  | 'project'
  | 'skillResponse'
  | 'codeArtifact'
  | 'page'
  | 'mediaResult'
  | 'workflowApp';

export type ToolDefinition = {
  /**
   * Tool name
   */
  name: string;
  /**
   * Tool description dictionary for humans
   */
  descriptionDict: {
    [key: string]: unknown;
  };
};

/**
 * Data input mode
 */
export type InputMode =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiSelect'
  | 'radio'
  | 'switch';

/**
 * Select option
 */
export type SelectOption = {
  /**
   * Option value
   */
  value: string;
  /**
   * Option label (key is locale, value is label)
   */
  labelDict?: {
    [key: string]: string;
  };
  /**
   * Whether this option is disabled
   */
  disabled?: boolean;
};

/**
 * Dynamic config item
 */
export type DynamicConfigItem = {
  /**
   * Config key
   */
  key: string;
  /**
   * Config input mode
   */
  inputMode: InputMode;
  /**
   * Specifies whether this config is required
   */
  required?: boolean;
  /**
   * Config label (key is locale, value is label)
   */
  labelDict: {
    [key: string]: string;
  };
  /**
   * Config description (key is locale, value is description)
   */
  descriptionDict: {
    [key: string]: string;
  };
  /**
   * Default value
   */
  defaultValue?: number | string | boolean | Array<string>;
  /**
   * Config options
   */
  options?: Array<SelectOption>;
  /**
   * Additional input properties
   */
  inputProps?: {
    /**
     * Minimum value for number input
     */
    min?: number;
    /**
     * Maximum value for number input
     */
    max?: number;
    /**
     * Step value for number input
     */
    step?: number;
    /**
     * Decimal precision for number input
     */
    precision?: number;
    /**
     * Whether to display as password input
     */
    passwordType?: boolean;
  };
};

/**
 * Toolset auth type
 */
export type ToolsetAuthType = 'credentials' | 'oauth';

/**
 * Refly user, used as JWT payload
 */
export type User = {
  /**
   * UID
   */
  uid: string;
  /**
   * Email
   */
  email?: string;
};

export type AuthPattern = {
  /**
   * Auth pattern type
   */
  type: ToolsetAuthType;
  /**
   * Credential items, only for `credentials` type
   */
  credentialItems?: Array<DynamicConfigItem>;
  /**
   * Auth provider, only for `oauth` type
   */
  provider?: string;
  /**
   * Auth scope, only for `oauth` type
   */
  scope?: Array<string>;
};

export type ToolsetDefinition = {
  /**
   * Toolset key
   */
  key: string;
  /**
   * Toolset domain (used for display icon)
   */
  domain?: string;
  /**
   * Toolset label dictionary
   */
  labelDict?: {
    [key: string]: unknown;
  };
  /**
   * Toolset description dictionary for humans
   */
  descriptionDict: {
    [key: string]: unknown;
  };
  /**
   * Toolset tools
   */
  tools: Array<ToolDefinition>;
  /**
   * Whether the toolset requires auth
   */
  requiresAuth?: boolean;
  /**
   * Toolset auth patterns
   */
  authPatterns?: Array<AuthPattern>;
  /**
   * Toolset config items
   */
  configItems?: Array<DynamicConfigItem>;
};
