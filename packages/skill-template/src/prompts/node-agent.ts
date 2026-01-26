import { PromptTemplate } from './prompt-template';
import { PtcContext } from '../base';

export interface BuildNodeAgentSystemPromptOptions {
  ptcEnabled?: boolean;
  ptcContext?: PtcContext;
}

const template = PromptTemplate.load('node-agent-system.md');

export const buildNodeAgentSystemPrompt = (options?: BuildNodeAgentSystemPromptOptions): string => {
  const { ptcEnabled = false, ptcContext } = options ?? {};

  return template.render({
    ptcEnabled,
    toolsets: ptcContext?.toolsets,
    sdkDocs: ptcContext?.sdk?.docs,
  });
};
