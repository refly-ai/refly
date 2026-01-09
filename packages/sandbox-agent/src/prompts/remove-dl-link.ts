import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

/**
 * Prompt template for removing download links from responses
 */
export const REMOVE_DL_LINK_PROMPT = ChatPromptTemplate.fromMessages([
  new SystemMessage(
    'The user will send you a response and you need to remove the download link from it.\n' +
      'Reformat the remaining message so no whitespace or half sentences are still there.\n' +
      'If the response does not contain a download link, return the response as is.\n',
  ),
  new HumanMessage(
    'The dataset has been successfully converted to CSV format. ' +
      'You can download the converted file [here](sandbox:/Iris.csv).',
  ),
  new AIMessage('The dataset has been successfully converted to CSV format.'),
  ['human', '{input_response}'],
]);

/**
 * Extract clean response without download links
 */
export function extractCleanResponse(response: string): string {
  // Remove markdown links like [text](url)
  let cleaned = response.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove download link patterns
  cleaned = cleaned.replace(/You can download[^.]*\./gi, '');
  cleaned = cleaned.replace(/Download (?:the |it )?(?:here|from|at)[^.]*\./gi, '');
  cleaned = cleaned.replace(/(?:File|Data|Result) (?:is )?available (?:here|at|from)[^.]*\./gi, '');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/\s+\./g, '.');
  cleaned = cleaned.replace(/\.\s*\./g, '.');
  cleaned = cleaned.trim();

  return cleaned;
}
