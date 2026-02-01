import { GenericToolset } from '@refly/openapi-schema';
import { PromptTemplate } from './prompt-template';

const formatInstalledToolsets = (installedToolsets: GenericToolset[]) => {
  return installedToolsets.map((toolset) => ({
    id: toolset.id,
    key: toolset.toolset?.key || toolset.name,
    name: toolset.name,
    description: toolset.toolset?.definition?.descriptionDict?.en ?? 'No description available',
  }));
};

const template = PromptTemplate.load('copilot-agent-system.md');

export const buildWorkflowCopilotPrompt = (params: {
  installedToolsets: GenericToolset[];
  webSearchEnabled?: boolean;
}) => {
  const availableToolsJson = JSON.stringify(
    formatInstalledToolsets(params.installedToolsets),
    null,
    2,
  );

  return template.render({
    availableToolsJson,
    webSearchEnabled: params.webSearchEnabled,
  });
};
