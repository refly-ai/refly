import { GenericToolset, NodeEditContext } from '@refly/openapi-schema';
import { PromptTemplate } from './prompt-template';

export const formatInstalledToolsets = (installedToolsets: GenericToolset[]) => {
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
  nodeEditContext?: NodeEditContext;
}) => {
  const availableToolsJson = JSON.stringify(
    formatInstalledToolsets(params.installedToolsets),
    null,
    2,
  );

  // Build node edit context section if provided
  let nodeEditContextSection = '';
  if (params.nodeEditContext) {
    nodeEditContextSection = `
## Targeted Node Editing Mode

**ACTIVE**: User has selected a specific node for editing.

### Selected Node Context

\`\`\`json
${JSON.stringify(params.nodeEditContext, null, 2)}
\`\`\`

### Editing Rules

| Edit Mode | Tool | Operation | Key Points |
|-----------|------|-----------|------------|
| **modify** | \`patch_workflow\` | \`updateTask\` | Update the selected task (taskId: "${params.nodeEditContext.taskId}"); only change what user requests; preserve other fields |
| **extend** | \`patch_workflow\` | \`createTask\` | Create new task with \`dependentTasks: ["${params.nodeEditContext.taskId}"]\` to extend from selected node |

### Current Mode: **${params.nodeEditContext.editMode}**

${
  params.nodeEditContext.editMode === 'modify'
    ? `
**Modify Mode Instructions**:
- Target task ID is: \`${params.nodeEditContext.taskId}\`
- Current state: ${params.nodeEditContext.currentState?.title ? `"${params.nodeEditContext.currentState.title}"` : 'Untitled'}
- Current query/prompt: ${params.nodeEditContext.currentState?.query ? `"${params.nodeEditContext.currentState.query.substring(0, 100)}..."` : 'None'}
- Current toolsets: ${params.nodeEditContext.currentState?.toolsets?.length ? params.nodeEditContext.currentState.toolsets.join(', ') : 'None'}
- Use \`updateTask\` operation to modify only the requested fields
- Preserve fields that user didn't ask to change
`
    : `
**Extend Mode Instructions**:
- Create new task(s) that depend on: \`${params.nodeEditContext.taskId}\`
- The new task's \`dependentTasks\` MUST include: ["${params.nodeEditContext.taskId}"]
- Reference the selected task's output using: \`@{type=agent,id=${params.nodeEditContext.taskId},name=${params.nodeEditContext.currentState?.title || 'Selected Task'}}\`
- Upstream context available: ${params.nodeEditContext.graphContext?.upstreamTaskIds?.join(', ') || 'None (this is a root task)'}
`
}

### Examples

**Modify Mode Example** - User says "把这个节点的工具改成 Perplexity":
\`\`\`json
{
  "operations": [{
    "op": "updateTask",
    "taskId": "${params.nodeEditContext.taskId}",
    "data": { "toolsets": ["perplexity"] }
  }]
}
\`\`\`

**Extend Mode Example** - User says "在后面加一个总结步骤":
\`\`\`json
{
  "operations": [{
    "op": "createTask",
    "task": {
      "id": "task-new-summary",
      "title": "Summary",
      "prompt": "Summarize the results from @{type=agent,id=${params.nodeEditContext.taskId},name=${params.nodeEditContext.currentState?.title || 'Selected Task'}}",
      "dependentTasks": ["${params.nodeEditContext.taskId}"],
      "toolsets": []
    }
  }]
}
\`\`\`

---
`;
  }

  return template.render({
    availableToolsJson,
    nodeEditContextSection,
  });
};
