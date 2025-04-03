/**
 * Interface for JSON extraction errors
 */
export interface JsonRepairError {
  message: string;
  pattern?: string;
  content?: string;
  cause?: Error;
  attemptedRepair?: boolean;
}

/**
 * Helper function to preprocess and fix common JSON issues
 * This is the first step of JSON repair, handling common formatting issues
 */
export function preprocessJsonString(str: string): string {
  if (!str) return '';

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

/**
 * Helper function to convert single quotes to double quotes while being careful with nested quotes
 */
export function fixSingleQuotedStrings(str: string): string {
  // This is a simplified approach - for complex cases we rely on jsonrepair
  let inDoubleQuoteString = false;
  let result = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const prevChar = i > 0 ? str[i - 1] : '';

    // Toggle string state based on quotes
    if (char === '"' && prevChar !== '\\') {
      inDoubleQuoteString = !inDoubleQuoteString;
    } else if (char === "'" && prevChar !== '\\' && !inDoubleQuoteString) {
      result += '"';
      continue;
    }

    result += char;
  }

  return result;
}

/**
 * Fix incomplete JSON by adding missing closing brackets and braces
 */
export function fixIncompleteJson(jsonStr: string): string {
  if (!jsonStr) return '{}';

  // Count opening and closing braces/brackets
  const openBraces = (jsonStr.match(/{/g) || []).length;
  const closeBraces = (jsonStr.match(/}/g) || []).length;
  const openBrackets = (jsonStr.match(/\[/g) || []).length;
  const closeBrackets = (jsonStr.match(/\]/g) || []).length;

  // Add missing closing braces and brackets
  let repairedJSON = jsonStr;

  // Add missing close brackets
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repairedJSON += ']';
  }

  // Add missing close braces
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repairedJSON += '}';
  }

  return repairedJSON;
}

/**
 * Extract JSON from various formats (including markdown code blocks)
 */
export function extractJsonFromMarkdown(content: string): {
  result?: any;
  error?: JsonRepairError;
} {
  if (!content) {
    return { error: { message: 'Empty content provided' } };
  }

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

  const errors: JsonRepairError[] = [];

  // First pass - try with the original patterns
  for (const pattern of patterns) {
    const match = normalizedContent.match(pattern);
    if (match?.[1]) {
      try {
        const trimmed = match[1].trim();
        const preprocessed = preprocessJsonString(trimmed);
        return { result: JSON.parse(preprocessed) };
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

  // Second pass - try fixing incomplete JSON
  for (const pattern of patterns) {
    const match = normalizedContent.match(pattern);
    if (match?.[1]) {
      try {
        const trimmed = match[1].trim();
        const preprocessed = preprocessJsonString(trimmed);
        const fixedIncomplete = fixIncompleteJson(preprocessed);
        return {
          result: JSON.parse(fixedIncomplete),
        };
      } catch (e) {
        errors.push({
          message: `Failed to fix incomplete JSON using pattern ${pattern}`,
          pattern: pattern.toString(),
          content: match[1].substring(0, 200) + (match[1].length > 200 ? '...' : ''),
          cause: e instanceof Error ? e : new Error(String(e)),
          attemptedRepair: true,
        });
      }
    }
  }

  // Last resort - try using jsonrepair (to be imported by the consumer if needed)
  const finalError: JsonRepairError = {
    message: 'Failed to parse JSON from response after all repair attempts',
    content: normalizedContent.substring(0, 200) + (normalizedContent.length > 200 ? '...' : ''),
    attemptedRepair: true,
  };

  return { error: finalError };
}

/**
 * Comprehensive function to repair JSON with multiple approaches
 * This tries different strategies to repair broken JSON
 */
export function repairJson(jsonStr: string): string {
  if (!jsonStr) return '{}';

  try {
    // 1. First try preprocessing to fix common issues
    const preprocessed = preprocessJsonString(jsonStr);

    // 2. Try parsing directly after preprocessing
    try {
      JSON.parse(preprocessed);
      return preprocessed; // If it parses successfully, return the preprocessed version
    } catch (e) {
      console.log('e', e);
      // Continue to next repair method if parsing fails
    }

    // 3. Try fixing incomplete JSON (missing brackets/braces)
    const fixedIncomplete = fixIncompleteJson(preprocessed);

    // 4. Try parsing after fixing incomplete JSON
    try {
      JSON.parse(fixedIncomplete);
      return fixedIncomplete; // If it parses successfully, return the fixed version
    } catch (e) {
      console.log('e', e);
      // Continue to next repair method if parsing fails
    }

    // 5. Return the fixed incomplete version even if it doesn't parse correctly
    // The consumer can apply jsonrepair if needed
    return fixedIncomplete;
  } catch (e) {
    // If all repair attempts fail, return the original string
    // This way the calling code can handle the error
    console.error('Failed to repair JSON:', e);
    return jsonStr;
  }
}
