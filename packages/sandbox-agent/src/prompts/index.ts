/**
 * Prompts for the code interpreter agent
 */

export {
  CODE_INTERPRETER_SYSTEM_MESSAGE,
  getSystemMessage,
} from './system-message';

export {
  DETERMINE_MODIFICATIONS_PROMPT,
  parseModifications,
} from './modifications-check';

export {
  REMOVE_DL_LINK_PROMPT,
  extractCleanResponse,
} from './remove-dl-link';
