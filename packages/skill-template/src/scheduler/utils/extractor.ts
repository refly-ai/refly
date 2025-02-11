import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SkillRunnableConfig } from '../../base';
import { z } from 'zod';
import { checkIsSupportedModel } from './model';
import { AIMessage, AIMessageChunk } from '@langchain/core/messages';
import { ToolCall } from '@langchain/core/messages/tool';
import { ModelInfo } from '@refly-packages/openapi-schema';

// Helper function to extract JSON from markdown code blocks
function extractJsonFromMarkdown(content: string): any {
  // Remove any escaped newlines and normalize line endings
  const normalizedContent = content.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

  // Try different JSON extraction patterns
  const patterns = [
    // Pattern 1: Standard markdown code block with json tag
    /```json\n([\s\S]*?)\n```/,
    // Pattern 2: Standard markdown code block without language tag
    /```\n([\s\S]*?)\n```/,
    // Pattern 3: Single-line code block
    /`(.*?)`/,
    // Pattern 4: Raw JSON with optional whitespace
    /^\s*({\s*[\s\S]*?\s*})\s*$/,
    // Pattern 5: Raw JSON content
    /([\s\S]*)/,
  ];

  for (const pattern of patterns) {
    const match = normalizedContent.match(pattern);
    if (match?.[1]) {
      try {
        // Clean the extracted content
        const extracted = match[1]
          .replace(/^\s+|\s+$/g, '') // Trim whitespace
          .replace(/\\"/g, '"') // Handle escaped quotes
          .replace(/\\n/g, '\n'); // Handle escaped newlines

        return JSON.parse(extracted);
      } catch (_e) {
        // Move to next pattern if parsing fails
        console.log('extractJsonFromMarkdown json parse failed: ', _e);
      }
    }
  }

  // If all patterns fail, try to parse the entire content as a last resort
  try {
    return JSON.parse(normalizedContent);
  } catch (error) {
    throw new Error(`Failed to parse JSON from response: ${error.message}`);
  }
}

// Helper function to generate schema instructions from Zod schema
function generateSchemaInstructions(schema: z.ZodType): string {
  const shape = (schema as any)._def.shape;
  const schemaName = schema.description || 'structured_output';

  // Generate field descriptions
  const fields = Object.entries(shape || {})
    .map(([key, value]) => {
      const fieldType = (value as any).typeName;
      const description = (value as any).description;
      const isOptional = !(value as any)._def.required;

      return `- "${key}": ${fieldType}${isOptional ? ' (optional)' : ''} - ${description || ''}`;
    })
    .join('\n');

  return `Please provide a JSON object for "${schemaName}" with the following structure:
${fields}

Important:
1. Respond ONLY with a valid JSON object
2. Wrap the JSON in \`\`\`json and \`\`\` tags
3. Make sure all required fields are included
4. Follow the exact types specified`;
}

interface ExtendedAIMessage extends AIMessage {
  tool_calls?: ToolCall[];
}

export async function extractStructuredData<T extends z.ZodType>(
  model: BaseChatModel,
  schema: T,
  prompt: string,
  config: SkillRunnableConfig,
  maxRetries,
  modelInfo: ModelInfo,
): Promise<z.infer<T>> {
  let lastError = '';
  let structuredOutputFailed = false;

  // Check if model supports structured output
  const useStructuredOutput = checkIsSupportedModel(modelInfo);

  const tryParseContent = async (content: string): Promise<z.infer<T> | null> => {
    try {
      const extractedJson = extractJsonFromMarkdown(content);
      return await schema.parseAsync(extractedJson);
    } catch (_error) {
      return null;
    }
  };

  const processResponse = async (response: any): Promise<string> => {
    if (typeof response === 'string') {
      return response;
    }
    if (response?.content === 'string') {
      return response.content;
    }
    if (response instanceof AIMessageChunk) {
      if (typeof response.content === 'string') {
        return response.content;
      }
      if (Array.isArray(response.content)) {
        return response.content
          .map((item) => {
            if (typeof item === 'string') return item;
            if ('type' in item && item.type === 'text') return item.text;
            return '';
          })
          .join('');
      }
    }
    return String(response);
  };

  for (let i = 0; i < maxRetries; i++) {
    try {
      if (useStructuredOutput && !structuredOutputFailed) {
        try {
          const structuredLLM = model.withStructuredOutput(schema, {
            includeRaw: true,
            name: 'structured_output',
          });

          const result = await Promise.resolve(
            structuredLLM.invoke(prompt, {
              ...config,
              metadata: {
                ...config.metadata,
                suppressOutput: true,
              },
            }),
          ).catch((error) => {
            throw new Error(`Structured output invocation failed: ${error.message}`);
          });

          // Try to get parsed result first
          if (result?.parsed) {
            return result.parsed;
          }

          // Try different result formats
          if (result?.raw?.content) {
            const parsed = await tryParseContent(String(result.raw.content));
            if (parsed) return parsed;
          }

          const rawMessage = result?.raw as ExtendedAIMessage;
          if (rawMessage?.tool_calls?.[0]?.args) {
            try {
              return await schema.parseAsync(rawMessage.tool_calls[0].args);
            } catch {
              // Continue to next attempt if parsing fails
            }
          }

          throw new Error('Structured output did not provide valid results');
        } catch (structuredError) {
          console.error('Structured output failed:', structuredError);
          structuredOutputFailed = true;
          lastError =
            structuredError instanceof Error
              ? structuredError.message
              : 'Unknown structured output error';
        }
      }

      // Fallback approach
      const schemaInstructions = generateSchemaInstructions(schema);
      const fullPrompt = `${prompt}\n\n${schemaInstructions}${
        lastError
          ? `\n\nPrevious attempt failed with error: ${lastError}\nPlease try again and ensure the response is valid JSON.`
          : ''
      }`;

      const response = await Promise.resolve(
        model.invoke(fullPrompt, {
          ...config,
          metadata: {
            ...config.metadata,
            suppressOutput: true,
          },
        }),
      ).catch((error) => {
        throw new Error(`Model invocation failed: ${error.message}`);
      });

      const content = await processResponse(response);
      const parsed = await tryParseContent(content);

      if (parsed) {
        return parsed;
      }

      throw new Error('Failed to parse response as valid JSON matching schema');
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Attempt ${i + 1}/${maxRetries} failed:`, lastError);

      if (i === maxRetries - 1) {
        throw new Error(
          `Failed to extract structured data after ${maxRetries} attempts. Last error: ${lastError}`,
        );
      }
    }
  }

  throw new Error(
    `Failed to extract structured data after ${maxRetries} attempts. Last error: ${lastError}`,
  );
}
