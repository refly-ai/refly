// 模拟NestJS依赖
const Injectable = () => (target: any) => target;

// 使用 Node.js Buffer 而不是自定义的
export type CustomBuffer = Buffer;

export interface ParserOptions {
  format?: string;
  mockMode?: boolean;
  timeout?: number;
  extractMedia?: boolean;
  resourceId?: string;
  useBatchUpload?: boolean;
  isOcr?: boolean;
  enableFormula?: boolean;
  enableTable?: boolean;
  language?: string;
}

export interface ParseResult {
  content: string;
  title?: string;
  images?: Record<string, CustomBuffer>; // pathname to image buffer
  metadata?: Record<string, any>;
  error?: string;
  buffer?: CustomBuffer;
}

@Injectable()
export abstract class BaseParser {
  protected constructor(protected readonly options: ParserOptions = {}) {}

  abstract name: string;

  abstract parse(input: string | CustomBuffer): Promise<ParseResult>;

  protected handleError(error: Error): ParseResult {
    return {
      content: '',
      error: error.message,
    };
  }
}
