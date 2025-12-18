/**
 * Tool Post-Handler Interface
 *
 * NestJS-compatible interfaces and abstract classes for tool post-processing.
 */

import type { User, DriveFile, UpsertDriveFileRequest } from '@refly/openapi-schema';

// Re-export ToolType from agent-tools for convenience
export type { ToolType } from '@refly/agent-tools';

/**
 * Service interface for file operations
 * Compatible with ReflyService from @refly/agent-tools
 */
export interface IPostHandlerFileService {
  writeFile: (user: User, param: UpsertDriveFileRequest) => Promise<DriveFile>;
}

/**
 * Context for post-handler processing
 */
export interface PostHandlerContext {
  user: User;
  canvasId: string;
  resultId: string;
  resultVersion: number;
  service?: IPostHandlerFileService;
}

/**
 * Input for post-handler processing
 */
export interface PostHandlerInput {
  toolName: string;
  toolsetKey: string;
  rawResult: unknown;
  maxTokens?: number;
  context: PostHandlerContext;
}

/**
 * Extended input for Composio post-handler with billing support
 */
export interface ComposioPostHandlerInput extends PostHandlerInput {
  /** Toolset name for display */
  toolsetName?: string;
  /** Credit cost for billing */
  creditCost?: number;
  /** File name title for uploads */
  fileNameTitle?: string;
}

/**
 * Output from post-handler processing
 */
export interface PostHandlerOutput {
  content: string;
  fileId?: string;
  fileMeta?: DriveFile;
  success: boolean;
  error?: string;
  wasTruncated: boolean;
}

/**
 * Abstract base class for tool post-handlers
 *
 * Use this as an injection token in NestJS:
 * @example
 * ```typescript
 * @Injectable()
 * export class MyPostHandler extends AbstractToolPostHandler {
 *   readonly name = 'my-post-handler';
 *   async process(input: PostHandlerInput): Promise<PostHandlerOutput> { ... }
 * }
 * ```
 */
export abstract class AbstractToolPostHandler {
  abstract readonly name: string;
  abstract process(input: PostHandlerInput): Promise<PostHandlerOutput>;
}

/**
 * Interface version for type checking (when abstract class is not needed)
 */
export interface IToolPostHandler {
  readonly name: string;
  process(input: PostHandlerInput): Promise<PostHandlerOutput>;
}
