/**
 * Sandbox agent-tool type definitions
 *
 * This module defines the TypeScript interfaces and types used for the
 * sandbox agent-tool that wraps CodeInterpreterSession functionality.
 */

import type { ISkillEngine } from '@refly/common-types';
import { User, SkillContext } from '@refly/openapi-schema';

/**
 * File representation for sandbox operations
 */
export interface SandboxFile {
  name: string;
  content: Buffer;
}

/**
 * Code interpreter response from sandbox
 */
export interface SandboxCodeInterpreterResponse {
  content: string;
  files: SandboxFile[];
  codeLog: Array<[string, string]>;
}

/**
 * Session status information
 */
export interface SandboxSessionStatus {
  status: 'starting' | 'running' | 'stopped' | 'error';
  sessionId?: string;
  message?: string;
}

/**
 * Sandbox session options
 */
export interface SandboxSessionOptions {
  verbose?: boolean;
  additionalTools?: any[];
  callbacks?: any[];
  llm?: any;

  // Model configuration
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
 * Parameters for sandbox tools
 */
export interface SandboxToolParams {
  user: User;
  apiKey?: string;
  reflyService?: any;

  /**
   * SkillEngine instance for creating LLM instances.
   * When provided, the sandbox agent will use engine.chatModel() to create LLM instances,
   * which ensures proper token usage tracking and credit billing.
   *
   * @see {@link ISkillEngine} for the interface definition
   */
  engine?: ISkillEngine;

  /**
   * Skill context containing documents, resources, code artifacts, and media files.
   * When provided, these will be automatically downloaded and uploaded to the sandbox
   * as files, allowing the sandbox agent to process them without polluting the LLM context.
   */
  context?: SkillContext;

  // Model configuration - only used when engine is not available (fallback)
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
}

/**
 * Generate response input schema
 */
export interface GenerateResponseInput {
  sessionId?: string;
  message: string;
  files?: Array<{
    name: string;
    content: string; // base64 encoded content
  }>;
  options?: SandboxSessionOptions;
}
