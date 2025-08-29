// Export prompt for generating canvas artifacts
// Export prompt and schema for generating reactive artifacts
import { SkillPromptModule } from '../../utils/message';
import {
  buildArtifactsSystemPrompt,
  buildArtifactsUserPrompt,
  buildArtifactsContextUserPrompt,
} from './prompt';

export const codeArtifactsPromptModule: SkillPromptModule = {
  buildSystemPrompt: buildArtifactsSystemPrompt,
  buildUserPrompt: buildArtifactsUserPrompt,
  buildContextUserPrompt: buildArtifactsContextUserPrompt,
};

// Export the prompt building functions for artifacts module
export { buildArtifactsSystemPrompt, buildArtifactsUserPrompt, buildArtifactsContextUserPrompt };
