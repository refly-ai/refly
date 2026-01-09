import { config } from 'dotenv';
import { CODE_INTERPRETER_SYSTEM_MESSAGE as DEFAULT_SYSTEM_MESSAGE } from './prompts';

// Load environment variables
config();

/**
 * CodeInterpreter API Settings
 */
export interface CodeInterpreterAPISettings {
  DEBUG: boolean;

  // Models
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_API_BASE?: string;
  AZURE_API_VERSION?: string;
  AZURE_DEPLOYMENT_NAME?: string;
  ANTHROPIC_API_KEY?: string;

  // LLM Settings
  MODEL: string;
  TEMPERATURE: number;
  DETAILED_ERROR: boolean;
  SYSTEM_MESSAGE: string;
  REQUEST_TIMEOUT: number; // Timeout in seconds
  MAX_ITERATIONS: number;
  MAX_RETRY: number;

  // Production Settings
  HISTORY_BACKEND?: string;
  REDIS_URL: string;
  POSTGRES_URL: string;

  // CodeBox
  CODEBOX_API_KEY?: string;
  CUSTOM_PACKAGES: string[];
}

/**
 * Default settings for CodeInterpreter API
 */
export const settings: CodeInterpreterAPISettings = {
  DEBUG: process.env.DEBUG === 'true' || false,

  // Models
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
  AZURE_API_BASE: process.env.AZURE_API_BASE,
  AZURE_API_VERSION: process.env.AZURE_API_VERSION,
  AZURE_DEPLOYMENT_NAME: process.env.AZURE_DEPLOYMENT_NAME,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

  // LLM Settings
  MODEL: process.env.MODEL || 'gpt-4o',
  TEMPERATURE: Number.parseFloat(process.env.TEMPERATURE || '0.03'),
  DETAILED_ERROR: process.env.DETAILED_ERROR !== 'false',
  SYSTEM_MESSAGE: process.env.SYSTEM_MESSAGE || DEFAULT_SYSTEM_MESSAGE,
  REQUEST_TIMEOUT: Number.parseInt(process.env.REQUEST_TIMEOUT || String(5 * 60)), // 5 minutes default (in seconds)
  MAX_ITERATIONS: Number.parseInt(process.env.MAX_ITERATIONS || '12'),
  MAX_RETRY: Number.parseInt(process.env.MAX_RETRY || '3'),

  // Production Settings
  HISTORY_BACKEND: process.env.HISTORY_BACKEND,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  POSTGRES_URL:
    process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',

  // CodeBox
  CODEBOX_API_KEY: process.env.CODEBOX_API_KEY,
  CUSTOM_PACKAGES: process.env.CUSTOM_PACKAGES
    ? process.env.CUSTOM_PACKAGES.split(',').map((pkg) => pkg.trim())
    : [],
};
