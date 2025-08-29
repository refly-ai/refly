import { SkillPromptModule } from '../../utils/message';
import {
  buildGenerateDocumentContextUserPrompt,
  buildGenerateDocumentSystemPrompt,
  buildGenerateDocumentUserPrompt,
} from './prompt';

export const generateDocPromptModule: SkillPromptModule = {
  buildSystemPrompt: buildGenerateDocumentSystemPrompt,
  buildUserPrompt: buildGenerateDocumentUserPrompt,
  buildContextUserPrompt: buildGenerateDocumentContextUserPrompt,
};
