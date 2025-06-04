import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SkillRunnableConfig } from '../../base';
import { z } from 'zod';
import { checkIsSupportedModel } from './model';
import { AIMessage, AIMessageChunk } from '@langchain/core/messages';
import { ToolCall } from '@langchain/core/messages/tool';
import { LLMModelConfig } from '@refly/openapi-schema';
import parseJson from 'json-parse-even-better-errors';
import { jsonrepair } from 'jsonrepair';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Enhanced interface for extraction errors
interface ExtractionError {
  message: string;
  pattern?: string;
  content?: string;
  cause?: Error;
  attemptedRepair?: boolean;
}

// Helper functions to preprocess and fix common JSON issues
function preprocessJsonString(str: string): string {
  // 创建一个新变量而不是修改参数
  let result = str;

  // Remove BOM characters that can appear at the start of some strings
  result = result.replace(/^\uFEFF/, '');

  // Normalize line endings
  result = result.replace(/\r\n/g, '\n');

  // Remove zero-width spaces and other invisible characters
  // 修复字符类问题，分开定义特殊字符
  result = result
    .replace(/\u200B/g, '')
    .replace(/\u200C/g, '')
    .replace(/\u200D/g, '')
    .replace(/\uFEFF/g, '');

  // Replace "smart" quotes with straight quotes
  result = result.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');

  // Fix trailing commas in arrays and objects (common LLM error)
  result = result.replace(/,(\s*[\]}])/g, '$1');

  // Fix unquoted property names
  result = result.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

  // Fix single-quoted strings (convert to double-quoted)
  result = fixSingleQuotedStrings(result);

  return result;
}

// Helper function to convert single quotes to double quotes while being careful with nested quotes
function fixSingleQuotedStrings(str: string): string {
  // This is a simplified approach - for complex cases we rely on jsonrepair
  let inString = false;
  let inDoubleQuoteString = false;
  let result = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const prevChar = i > 0 ? str[i - 1] : '';

    // Toggle string state based on quotes
    if (char === '"' && prevChar !== '\\') {
      inDoubleQuoteString = !inDoubleQuoteString;
    } else if (char === "'" && prevChar !== '\\' && !inDoubleQuoteString) {
      inString = !inString;
      result += '"';
      continue;
    }

    result += char;
  }

  return result;
}

// Helper function to extract JSON from markdown code blocks with better error handling
function extractJsonFromMarkdown(content: string): { result?: any; error?: ExtractionError } {
  // Remove any escaped newlines and normalize line endings
  const normalizedContent = content.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

  // Try different JSON extraction patterns
  const patterns = [
    // Pattern 1: Standard markdown code block with json tag
    /```(?:json)\s*\n([\s\S]*?)\n```/,
    // Pattern 2: Standard markdown code block without language tag
    /```\s*\n([\s\S]*?)\n```/,
    // Pattern 3: Single-line code block
    /`(.*?)`/,
    // Pattern 4: Raw JSON in common structures
    /({[\s\S]*}|\[[\s\S]*\])/,
    // Pattern 5: Raw JSON (fallback)
    /([\s\S]*)/,
  ];

  const errors: ExtractionError[] = [];

  // First pass - try with the original patterns
  for (const pattern of patterns) {
    const match = normalizedContent.match(pattern);
    if (match?.[1]) {
      try {
        const trimmed = match[1].trim();
        const preprocessed = preprocessJsonString(trimmed);
        return { result: parseJson(preprocessed) };
      } catch (e) {
        errors.push({
          message: `Failed to parse JSON using pattern ${pattern}`,
          pattern: pattern.toString(),
          content: match[1].substring(0, 200) + (match[1].length > 200 ? '...' : ''),
          cause: e instanceof Error ? e : new Error(String(e)),
        });
      }
    }
  }

  // Second pass - try with jsonrepair
  for (const pattern of patterns) {
    const match = normalizedContent.match(pattern);
    if (match?.[1]) {
      try {
        const trimmed = match[1].trim();
        // First preprocess, then try to repair the JSON
        const preprocessed = preprocessJsonString(trimmed);
        const repaired = jsonrepair(preprocessed);
        return {
          result: parseJson(repaired),
        };
      } catch (e) {
        errors.push({
          message: `Failed to repair and parse JSON using pattern ${pattern}`,
          pattern: pattern.toString(),
          content: match[1].substring(0, 200) + (match[1].length > 200 ? '...' : ''),
          cause: e instanceof Error ? e : new Error(String(e)),
          attemptedRepair: true,
        });
      }
    }
  }

  // Last resort - try to parse the entire content with repair
  try {
    // Try to repair the entire content
    const preprocessed = preprocessJsonString(normalizedContent);
    const repaired = jsonrepair(preprocessed);
    return { result: parseJson(repaired) };
  } catch (e) {
    // If all attempts fail, return a detailed error
    const finalError: ExtractionError = {
      message:
        'Failed to parse JSON from response after trying all extraction patterns and repair attempts',
      content: normalizedContent.substring(0, 200) + (normalizedContent.length > 200 ? '...' : ''),
      cause: e instanceof Error ? e : new Error(String(e)),
      attemptedRepair: true,
    };

    return { error: finalError };
  }
}

// Helper function to generate schema instructions from Zod schema with improved documentation
function generateSchemaInstructions(schema: z.ZodType): string {
  // 使用 zodToJsonSchema 将 Zod schema 转换为 JSON Schema
  const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });

  // 保留原有的字段描述逻辑，用于生成更友好的文档
  const shape = (schema as any)._def.shape;
  const schemaName = schema.description || 'structured_output';

  // Generate field descriptions with better type information
  const fields = Object.entries(shape || {})
    .map(([key, value]) => {
      const fieldType = (value as any).typeName;
      const description = (value as any).description;
      const isOptional = !(value as any)._def.required;
      const constraints = getFieldConstraints(value as z.ZodType);

      return `- "${key}": ${fieldType}${isOptional ? ' (optional)' : ''}${
        constraints ? ` ${constraints}` : ''
      } - ${description || ''}`;
    })
    .join('\n');

  // 添加 JSON Schema 的完整定义
  const jsonSchemaStr = JSON.stringify(jsonSchema, null, 2);

  return `Please provide a JSON object for "${schemaName}" with the following structure:
${fields}

Important:
1. Respond ONLY with a valid JSON object
2. Wrap the JSON in \`\`\`json and \`\`\` tags
3. Make sure all required fields are included
4. Follow the exact types specified
5. Ensure JSON is properly formatted without syntax errors
6. Use double quotes for property names and string values
7. Avoid trailing commas in arrays and objects
8. Use camelCase for property names (not snake_case)

JSON Schema Definition:
\`\`\`json
${jsonSchemaStr}
\`\`\`

Your response MUST match this schema exactly.`;
}

// Helper function to extract field constraints for better schema documentation
function getFieldConstraints(field: z.ZodType): string | undefined {
  if (!field._def) return undefined;

  const constraints: string[] = [];

  if ('minLength' in field._def && field._def.minLength !== undefined) {
    constraints.push(`min length: ${field._def.minLength}`);
  }

  if ('maxLength' in field._def && field._def.maxLength !== undefined) {
    constraints.push(`max length: ${field._def.maxLength}`);
  }

  if ('minimum' in field._def && field._def.minimum !== undefined) {
    constraints.push(`min: ${field._def.minimum}`);
  }

  if ('maximum' in field._def && field._def.maximum !== undefined) {
    constraints.push(`max: ${field._def.maximum}`);
  }

  return constraints.length > 0 ? `(${constraints.join(', ')})` : undefined;
}

interface ExtendedAIMessage extends AIMessage {
  tool_calls?: ToolCall[];
}

export async function extractStructuredData<T extends z.ZodType>(
  model: BaseChatModel,
  schema: T,
  prompt: string,
  config: SkillRunnableConfig,
  maxRetries: number,
  modelInfo: LLMModelConfig,
): Promise<z.infer<T>> {
  let lastError = '';
  const detailedErrors: string[] = [];
  let structuredOutputFailed = false;

  // Check if model supports structured output
  const useStructuredOutput = checkIsSupportedModel(modelInfo);

  const tryParseContent = async (
    content: string,
  ): Promise<{ data?: z.infer<T>; error?: string; rawContent?: string }> => {
    try {
      const extraction = extractJsonFromMarkdown(content);

      if (extraction.error) {
        return {
          error: `JSON extraction failed: ${extraction.error.message}`,
          rawContent: extraction.error.content,
        };
      }

      if (!extraction.result) {
        return { error: 'No JSON data could be extracted from the response' };
      }

      // Perform schema validation with detailed error capture
      try {
        const validatedData = await schema.parseAsync(extraction.result);
        return { data: validatedData };
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          const formattedErrors = validationError.errors
            .map((err) => `- ${err.path.join('.')}: ${err.message}`)
            .join('\n');
          return {
            error: `Schema validation failed: \n${formattedErrors}`,
            rawContent: JSON.stringify(extraction.result, null, 2).substring(0, 300),
          };
        }
        return {
          error: `Schema validation error: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
          rawContent: JSON.stringify(extraction.result, null, 2).substring(0, 300),
        };
      }
    } catch (e) {
      return {
        error: `Unexpected error during parsing: ${e instanceof Error ? e.message : String(e)}`,
      };
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
                // Remove suppressOutput to allow Langfuse monitoring
                // suppressOutput: true,
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
            const parseResult = await tryParseContent(String(result.raw.content));
            if (parseResult.data) return parseResult.data;
            if (parseResult.error) {
              const errorWithContent = parseResult.rawContent
                ? `${parseResult.error}\n\nPartial content: ${parseResult.rawContent}`
                : parseResult.error;
              detailedErrors.push(errorWithContent);
            }
          }

          const rawMessage = result?.raw as ExtendedAIMessage;
          if (rawMessage?.tool_calls?.[0]?.args) {
            try {
              return await schema.parseAsync(rawMessage.tool_calls[0].args);
            } catch (validationError) {
              if (validationError instanceof z.ZodError) {
                const formattedErrors = validationError.errors
                  .map((err) => `- ${err.path.join('.')}: ${err.message}`)
                  .join('\n');
                const errorWithContent = `Tool call schema validation failed: \n${formattedErrors}\n\nPartial content: ${JSON.stringify(
                  rawMessage.tool_calls[0].args,
                  null,
                  2,
                ).substring(0, 300)}`;
                detailedErrors.push(errorWithContent);
              } else {
                detailedErrors.push(
                  `Tool call validation error: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
                );
              }
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
          detailedErrors.push(lastError);
        }
      }

      // Fallback approach with more explicit JSON formatting guidance
      const schemaInstructions = generateSchemaInstructions(schema);

      // 添加更明确的 JSON 结构示例，基于 schema 生成
      const jsonSchemaExample = generateSchemaExample(schema);

      const jsonFormatExamples = `
JSON formatting tips:
- Always use double quotes for keys and string values: {"name": "value"}
- Arrays use square brackets: ["item1", "item2"]
- Objects use curly braces: {"key1": "value1", "key2": "value2"}
- Boolean values are lowercase: true, false
- Numbers don't need quotes: {"count": 42}
- Nested objects example: {"user": {"name": "John", "age": 30}}
- Nested arrays example: {"items": ["apple", "banana"]}

Example response format:
\`\`\`json
${jsonSchemaExample}
\`\`\`
`;

      const errorFeedback =
        detailedErrors.length > 0
          ? `\n\nPrevious attempts failed with these errors:
${detailedErrors
  .slice(-2)
  .map((err, idx) => `Attempt ${i - detailedErrors.slice(-2).length + idx + 1}: ${err}`)
  .join('\n\n')}

Please fix these issues and ensure your response matches the schema exactly.`
          : '';

      const fullPrompt = `${prompt}\n\n${schemaInstructions}\n${jsonFormatExamples}${errorFeedback}`;

      const response = await Promise.resolve(
        model.invoke(fullPrompt, {
          ...config,
          metadata: {
            ...config.metadata,
            // Remove suppressOutput to allow Langfuse monitoring
            // suppressOutput: true,
          },
        }),
      ).catch((error) => {
        throw new Error(`Model invocation failed: ${error.message}`);
      });

      const content = await processResponse(response);
      const parseResult = await tryParseContent(content);

      if (parseResult.data) {
        return parseResult.data;
      }

      if (parseResult.error) {
        const errorWithContent = parseResult.rawContent
          ? `${parseResult.error}\n\nPartial content: ${parseResult.rawContent}`
          : parseResult.error;
        detailedErrors.push(errorWithContent);
        throw new Error(parseResult.error);
      }

      throw new Error('Failed to parse response as valid JSON matching schema');
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Attempt ${i + 1}/${maxRetries} failed:`, lastError);

      if (i === maxRetries - 1) {
        throw new Error(
          `Failed to extract structured data after ${maxRetries} attempts. Last error: ${lastError}\n\nDetailed errors:\n${detailedErrors.slice(-3).join('\n\n')}`,
        );
      }
    }
  }

  throw new Error(
    `Failed to extract structured data after ${maxRetries} attempts. Last error: ${lastError}\n\nDetailed errors:\n${detailedErrors.slice(-3).join('\n\n')}`,
  );
}

// 生成基于 schema 的示例 JSON
function generateSchemaExample(schema: z.ZodType): string {
  try {
    const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });

    // 递归生成示例值
    function generateExampleForSchema(schema: any): any {
      if (!schema) return null;

      // 处理不同类型的 schema
      if (schema.type === 'object' && schema.properties) {
        const result: Record<string, any> = {};
        for (const [key, prop] of Object.entries<any>(schema.properties)) {
          result[key] = generateExampleForSchema(prop);
        }
        return result;
      }

      if (schema.type === 'array' && schema.items) {
        return [generateExampleForSchema(schema.items)];
      }

      if (schema.type === 'string') {
        if (schema.enum && schema.enum.length > 0) {
          return schema.enum[0];
        }
        return schema.example || schema.default || 'example string';
      }

      if (schema.type === 'number' || schema.type === 'integer') {
        return schema.example || schema.default || 42;
      }

      if (schema.type === 'boolean') {
        return schema.example || schema.default || true;
      }

      if (schema.type === 'null') {
        return null;
      }

      // 处理复合类型
      if (schema.oneOf || schema.anyOf) {
        const options = schema.oneOf || schema.anyOf;
        if (options && options.length > 0) {
          return generateExampleForSchema(options[0]);
        }
      }

      return null;
    }

    const example = generateExampleForSchema(jsonSchema);
    return JSON.stringify(example, null, 2);
  } catch (error) {
    // 如果生成失败，返回一个基本示例
    console.error('Failed to generate schema example:', error);
    return '{\n  "example": "This is a placeholder. Please follow the schema definition above."\n}';
  }
}
