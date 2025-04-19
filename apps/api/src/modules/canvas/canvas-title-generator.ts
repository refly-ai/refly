import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';
import { zodToJsonSchema } from 'zod-to-json-schema';
import parseJson from 'json-parse-even-better-errors';

// Define a more flexible CanvasContentItem interface to accommodate different content types
export interface CanvasContentItem {
  // Question/answer content
  question?: string;
  answer?: string;

  // Document/resource content
  title?: string;
  content?: string;
  contentPreview?: string;
}

/**
 * Define Zod schema for title generation output
 */
const titleSchema = z.object({
  title: z
    .string()
    .min(2)
    .max(100)
    .describe('The concise title (maximum 5 words) that represents the canvas content'),
  keywords: z
    .array(z.string())
    .describe('Key terms extracted from the content that informed the title'),
  language: z.enum(['en', 'zh']).default('en').describe('The detected language of the content'),
  category: z
    .enum([
      'programming',
      'data_science',
      'web_development',
      'devops',
      'ai_ml',
      'general_tech',
      'other',
    ])
    .describe('The general category of the content'),
});

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
  let result = str;

  // Remove BOM characters that can appear at the start of some strings
  result = result.replace(/^\uFEFF/, '');

  // Normalize line endings
  result = result.replace(/\r\n/g, '\n');

  // Remove zero-width spaces and other invisible characters
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

// Helper function to convert single quotes to double quotes
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

// Helper function to extract JSON from markdown code blocks
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

/**
 * Generates a detailed schema guide with example for LLM
 */
function generateSchemaInstructions(): string {
  // Convert Zod schema to JSON Schema for better documentation
  const jsonSchema = zodToJsonSchema(titleSchema, { target: 'openApi3' });

  // Generate example based on the schema
  const exampleOutput = {
    title: 'Python Data Visualization Tools',
    keywords: ['python', 'data analysis', 'visualization', 'matplotlib', 'pandas'],
    language: 'en',
    category: 'data_science',
  };

  return `Please generate a structured JSON object with the following schema:

1. "title": A concise title (MAXIMUM 5 WORDS) that represents the canvas content
2. "keywords": An array of key terms extracted from the content
3. "language": The language of the content (either "en" or "zh")
4. "category": The general category of the content

Example output:
\`\`\`json
${JSON.stringify(exampleOutput, null, 2)}
\`\`\`

JSON Schema Definition:
\`\`\`json
${JSON.stringify(jsonSchema, null, 2)}
\`\`\`

IMPORTANT:
- Keep the title brief (MAXIMUM 5 WORDS)
- Use technical terminology when appropriate
- Be specific rather than generic
- Ensure your response is valid JSON and follows the schema exactly
`;
}

/**
 * Builds few-shot examples for title generation to improve consistency
 */
function buildTitleGenerationExamples(): string {
  return `
Example 1:
Canvas Content:
Title: Python Data Analysis
Content Preview: This document contains code snippets for data analysis using pandas and matplotlib.
Title: Data Visualization Techniques
Content Preview: A review of various data visualization libraries in Python including seaborn, plotly, and bokeh.

Expected Output:
{
  "title": "Python Data Visualization Tools",
  "keywords": ["python", "data visualization", "pandas", "matplotlib", "seaborn"],
  "language": "en",
  "category": "data_science"
}

Example 2:
Canvas Content:
Question: How do I implement authentication in my Node.js API?
Answer: You can use Passport.js, which is a popular authentication middleware for Node.js.

Expected Output:
{
  "title": "Node.js API Authentication",
  "keywords": ["node.js", "api", "authentication", "passport.js", "middleware"],
  "language": "en",
  "category": "web_development"
}

Example 3:
Canvas Content:
Title: React State Management
Content Preview: Discussion of state management in React applications using hooks, context, and Redux.
Question: What are the benefits of Redux over Context API?
Answer: Redux offers more robust debugging tools, middleware support, and is better suited for complex state logic.

Expected Output:
{
  "title": "React State Management Comparison",
  "keywords": ["react", "state management", "redux", "context api", "hooks"],
  "language": "en",
  "category": "web_development"
}
`;
}

/**
 * Formats canvas content items into a unified string format
 */
function formatCanvasContent(contentItems: CanvasContentItem[]): string {
  return contentItems
    .map((item) => {
      if (item.question && item.answer) {
        return `Question: ${item.question}\nAnswer: ${item.answer}`;
      }

      if (item.title && item.contentPreview) {
        return `Title: ${item.title}\nContent Preview: ${item.contentPreview}`;
      }

      if (item.title && item.content) {
        return `Title: ${item.title}\nContent: ${item.content}`;
      }

      return null;
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Generates a descriptive title for canvas content using structured output
 * Returns a string title with appropriate length constraints
 */
export async function generateCanvasTitle(
  contentItems: CanvasContentItem[],
  modelInfo: any,
  logger: Logger,
): Promise<string> {
  const combinedContent = formatCanvasContent(contentItems);

  try {
    if (!combinedContent) {
      logger.warn('No content available for title generation');
      return '';
    }

    const model = new ChatOpenAI({
      model: modelInfo?.name,
      apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
      temperature: 0.2, // Lower temperature for more consistent titles
      configuration: {
        baseURL: process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : undefined,
        defaultHeaders: {
          'HTTP-Referer': 'https://refly.ai',
          'X-Title': 'Refly',
        },
      },
    });

    logger.log(`Generating title from ${contentItems.length} content items`);

    // First attempt: Use LLM structured output capability
    try {
      const structuredLLM = model.withStructuredOutput(titleSchema);

      // Combine schema instructions with examples and content
      const fullPrompt = `You are an expert at generating concise, descriptive titles for canvases.

## Your Task
Analyze this canvas content and generate a structured output that follows the specified schema.

## Guidelines
1. Keep titles concise - MAXIMUM 5 WORDS
2. Be specific rather than generic - capture the unique focus
3. Use technical terminology when appropriate
4. Detect the language of the content and use it for the title

${generateSchemaInstructions()}

Here are examples with expected outputs:
${buildTitleGenerationExamples()}

Canvas Content:
${combinedContent}`;

      const result = await structuredLLM.invoke(fullPrompt);

      logger.log(`Generated structured output: ${JSON.stringify(result)}`);

      // Validate title word count
      const titleWords = result.title.split(/\s+/);
      if (titleWords.length > 15) {
        result.title = titleWords.slice(0, 15).join(' ');
        logger.log(`Title truncated to 15 words: "${result.title}"`);
      }

      return result.title;
    } catch (structuredError) {
      logger.warn(`Structured output failed: ${structuredError.message}, trying fallback approach`);
      // Continue to fallback
    }

    // Second attempt: Manual JSON parsing approach
    const schemaInstructions = generateSchemaInstructions();
    const fullPrompt = `You are an expert at generating concise, descriptive titles for canvases.

## Your Task
Analyze this canvas content and generate a structured output following the schema below.

${schemaInstructions}

Canvas Content:
${combinedContent}

Respond ONLY with a valid JSON object wrapped in \`\`\`json and \`\`\` tags.`;

    const response = await model.invoke(fullPrompt);
    const responseText = response.content.toString();

    // Extract and parse JSON
    const extraction = extractJsonFromMarkdown(responseText);

    if (extraction.error) {
      logger.warn(`JSON extraction failed: ${extraction.error.message}, using final fallback`);
      // Continue to final fallback
    } else if (extraction.result) {
      try {
        const validatedData = await titleSchema.parseAsync(extraction.result);

        // Validate title word count
        const titleWords = validatedData.title.split(/\s+/);
        if (titleWords.length > 15) {
          validatedData.title = titleWords.slice(0, 15).join(' ');
          logger.log(`Title truncated to 15 words: "${validatedData.title}"`);
        }

        logger.log(`Successfully extracted title: "${validatedData.title}"`);
        return validatedData.title;
      } catch (validationError) {
        logger.warn(`Schema validation failed: ${validationError.message}, using final fallback`);
        // Continue to final fallback
      }
    }

    // Final fallback: Simple title generation
    const fallbackResponse = await model.invoke([
      new SystemMessage(
        'Generate a very concise title (5 words maximum) for this content. Output only the title itself.',
      ),
      new HumanMessage(combinedContent),
    ]);

    let title = fallbackResponse.content.toString().trim();
    title = title.replace(/^["'](.*)["']$/, '$1');

    // Enforce maximum 15 words limit
    const words = title.split(/\s+/);
    if (words.length > 15) {
      title = words.slice(0, 15).join(' ');
      logger.log(`Title truncated to 15 words: "${title}"`);
    }

    // Ensure title has at least 2 words
    if (words.length < 2 && words[0]?.length > 0) {
      title = `${words[0]} Content`;
      logger.log(`Title expanded to ensure minimum length: "${title}"`);
    }

    logger.log(`Generated fallback title: "${title}"`);
    return title;
  } catch (error) {
    logger.error(`Error generating canvas title: ${error.message}`);
    return '';
  }
}
