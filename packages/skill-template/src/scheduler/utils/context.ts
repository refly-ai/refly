import { SkillContext } from '@refly/openapi-schema';
import { encode } from 'gpt-tokenizer';
import { SkillEngine } from '../../engine';

export interface ContextFile {
  name: string;
  fileId: string;
  type: string;
  summary: string;
  content: string;
}

export interface AgentResult {
  resultId: string;
  title: string;
  content: string;
  outputFiles: ContextFile[];
}

export interface ContextBlock {
  files: ContextFile[];
  results: AgentResult[];
  totalTokens?: number;
}

/**
 * Prepare context from SkillContext into a structured ContextBlock format
 * Filters files and results based on token limits estimated from their content
 */
export async function prepareContext(
  context: SkillContext,
  options: {
    maxTokens: number;
    engine: SkillEngine;
    summarizerConcurrentLimit?: number;
  },
): Promise<ContextBlock> {
  if (!context) {
    return { files: [], results: [], totalTokens: 0 };
  }

  const maxTokens = options?.maxTokens ?? 0;
  const selectedFiles: ContextFile[] = [];
  const selectedResults: AgentResult[] = [];
  let currentTokens = 0;

  // Helper function to estimate tokens for content
  const estimateTokens = (content: string): number => {
    return encode(content ?? '').length;
  };

  // Process files with token estimation
  if (context?.files?.length > 0) {
    for (const item of context.files) {
      const file = item?.file;
      if (!file) continue;

      const fileContent = file?.content ?? '';
      const contentTokens = estimateTokens(fileContent);

      // Check if adding this file would exceed token limit
      if (maxTokens > 0 && currentTokens + contentTokens > maxTokens) {
        // If we can't add the full file, skip it
        continue;
      }

      const contextFile: ContextFile = {
        name: file?.name ?? 'Untitled File',
        fileId: file?.fileId ?? 'unknown',
        type: file?.type ?? 'unknown',
        summary: file?.summary ?? '',
        content: fileContent,
      };

      selectedFiles.push(contextFile);
      currentTokens += contentTokens;
    }
  }

  // Process results with token estimation
  if (context?.results?.length > 0) {
    for (const item of context.results) {
      const result = item?.result;
      if (!result) continue;

      const resultContent = result?.steps?.map((step) => step.content).join('\n\n') ?? '';
      const contentTokens = estimateTokens(resultContent);

      // Check if adding this result would exceed token limit
      if (maxTokens > 0 && currentTokens + contentTokens > maxTokens) {
        // If we can't add the full result, skip it
        continue;
      }

      const agentResult: AgentResult = {
        resultId: result?.resultId ?? 'unknown',
        title: result?.title ?? 'Untitled Result',
        content: resultContent,
        outputFiles:
          result?.files?.map((file) => ({
            name: file?.name ?? 'Untitled File',
            fileId: file?.fileId ?? 'unknown',
            type: file?.type ?? 'unknown',
            summary: file?.summary ?? '',
            content: file?.content ?? '',
          })) ?? [],
      };

      selectedResults.push(agentResult);
      currentTokens += contentTokens;
    }
  }

  return {
    files: selectedFiles,
    results: selectedResults,
    totalTokens: currentTokens,
  };
}
