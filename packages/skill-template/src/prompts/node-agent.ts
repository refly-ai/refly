import { PromptTemplate } from './prompt-template';
import { PtcContext } from '../base';

export interface BuildNodeAgentSystemPromptOptions {
  ptcEnabled?: boolean;
  ptcContext?: PtcContext;
  ptcSequential?: boolean;
}

const template = PromptTemplate.load('node-agent-system.md');

export const buildNodeAgentSystemPrompt = (options?: BuildNodeAgentSystemPromptOptions): string => {
  const { ptcEnabled = false, ptcContext, ptcSequential = false } = options ?? {};

  return template.render({
    ptcEnabled,
    ptcSequential,
    toolsets: ptcContext?.toolsets,
    sdkDocs: ptcContext?.sdk?.docs,
  });
};
