import { PromptTemplate } from './prompt-template';
import { PtcConfig } from '../base';

export interface BuildNodeAgentSystemPromptOptions {
  ptcEnabled?: boolean;
  ptcConfig?: PtcConfig;
}

const template = PromptTemplate.load('node-agent-system.md');

export const buildNodeAgentSystemPrompt = (options?: BuildNodeAgentSystemPromptOptions): string => {
  const { ptcEnabled = false, ptcConfig } = options ?? {};
  const ptcToolsets = ptcConfig?.toolsets ?? [];

  const sdkDefinitions = ptcToolsets.map((t) => t.sdkDefinition);

  // Prepare available tools string
  const availableTools =
    ptcToolsets.length > 0
      ? ptcToolsets.map((t) => t.key).join(', ')
      : 'No specialized SDK tools available.';

  // Render the template with the provided data
  return template.render({
    ptcEnabled,
    availableTools,
    sdkDefinitions,
  });
};
