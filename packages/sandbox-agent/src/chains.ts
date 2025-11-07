import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  DETERMINE_MODIFICATIONS_PROMPT,
  parseModifications,
  REMOVE_DL_LINK_PROMPT,
  extractCleanResponse,
} from './prompts';

/**
 * Extract Python code from a code block
 */
export function extractPythonCode(text: string): string {
  const codeBlockRegex = /```python\n([\s\S]*?)\n```/g;
  const matches = text.match(codeBlockRegex);

  if (matches && matches.length > 0) {
    return matches[0].replace(/```python\n/, '').replace(/\n```/, '');
  }

  return text;
}

/**
 * Check if code modifies files using LLM
 */
export async function getFileModifications(
  code: string,
  llm: BaseChatModel,
): Promise<string[] | null> {
  // First, do a quick heuristic check
  const fileOperationPatterns = [
    /\.to_csv\(/,
    /\.to_excel\(/,
    /\.to_json\(/,
    /\.savefig\(/,
    /with open\(/,
    /open\(['"](.*?)['"]/,
    /\.write\(/,
    /\.dump\(/,
  ];

  const hasFileOperations = fileOperationPatterns.some((pattern) => pattern.test(code));

  if (!hasFileOperations) {
    return null;
  }

  try {
    // Use LLM to determine modifications
    const chain = DETERMINE_MODIFICATIONS_PROMPT.pipe(llm);
    const response = await chain.invoke({ code });

    if (typeof response.content === 'string') {
      const modifications = parseModifications(response.content);
      return modifications;
    }
  } catch (error) {
    console.error('Error determining modifications with LLM:', error);
  }

  // Fallback: extract filenames using regex
  const filenameMatches = [
    ...code.matchAll(/['"]([\w\-\.]+\.(?:csv|xlsx|json|png|jpg|jpeg|pdf|txt|html))['"]/gi),
  ];

  if (filenameMatches.length === 0) {
    return null;
  }

  const filenames = filenameMatches.map((match) => match[1]);
  return [...new Set(filenames)]; // Remove duplicates
}

/**
 * Remove download links from response text using LLM
 */
export async function removeDownloadLink(text: string, llm: BaseChatModel): Promise<string> {
  try {
    const chain = REMOVE_DL_LINK_PROMPT.pipe(llm);
    const response = await chain.invoke({ input_response: text });

    if (typeof response.content === 'string') {
      return response.content;
    }
  } catch (error) {
    console.error('Error removing download link with LLM:', error);
  }

  // Fallback: use regex-based cleaning
  return extractCleanResponse(text);
}

/**
 * Analyze code for potential issues
 */
export async function analyzeCode(
  code: string,
  llm: BaseChatModel,
): Promise<{ hasIssues: boolean; issues: string[] }> {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'You are a code analysis assistant. Analyze the given Python code for potential issues, errors, or improvements.',
    ],
    ['human', 'Analyze this Python code and list any potential issues:\n\n```python\n{code}\n```'],
  ]);

  try {
    const chain = prompt.pipe(llm);
    const response = await chain.invoke({ code });

    if (typeof response.content === 'string') {
      const content = response.content.toLowerCase();
      const hasIssues =
        content.includes('issue') || content.includes('error') || content.includes('problem');

      return {
        hasIssues,
        issues: hasIssues ? [response.content] : [],
      };
    }
  } catch (error) {
    console.error('Error analyzing code:', error);
  }

  return { hasIssues: false, issues: [] };
}

/**
 * Generate code suggestions based on user request
 */
export async function generateCodeSuggestion(
  userRequest: string,
  llm: BaseChatModel,
): Promise<string> {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'You are a helpful Python coding assistant. Generate Python code to fulfill user requests.',
    ],
    ['human', 'Generate Python code for the following request:\n\n{request}'],
  ]);

  const chain = prompt.pipe(llm);
  const response = await chain.invoke({ request: userRequest });

  if (typeof response.content === 'string') {
    return extractPythonCode(response.content);
  }

  return '';
}
