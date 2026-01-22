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
enum ChartType {
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
enum ScaleType {
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
interface Chart {
  type: ChartType;
  title: string;
  elements: any[];
}

/**
 * 2D chart interface
 */
interface Chart2D extends Chart {
  xLabel?: string;
  yLabel?: string;
  xUnit?: string;
  yUnit?: string;
}

/**
 * Point data
 */
interface PointData {
  label: string;
  points: Array<[string | number, string | number]>;
}

/**
 * Point chart interface (scatter plot, line chart)
 */
interface PointChart extends Chart2D {
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
interface BarData {
  label: string;
  group: string;
  value: string | number;
}

/**
 * Bar chart interface
 */
interface BarChart extends Chart2D {
  type: ChartType.BAR;
  elements: BarData[];
}

/**
 * Pie chart data
 */
interface PieData {
  label: string;
  angle: number;
  radius: number;
}

/**
 * Pie chart interface
 */
interface PieChart extends Chart {
  type: ChartType.PIE;
  elements: PieData[];
}

/**
 * Box and whisker chart data
 */
interface BoxAndWhiskerData {
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
interface BoxAndWhiskerChart extends Chart2D {
  type: ChartType.BOX_AND_WHISKER;
  elements: BoxAndWhiskerData[];
}

/**
 * Composite chart
 */
interface SuperChart extends Chart {
  type: ChartType.SUPERCHART;
  elements: ChartTypes[];
}

type ChartTypes = PointChart | BarChart | PieChart | BoxAndWhiskerChart | SuperChart;

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
