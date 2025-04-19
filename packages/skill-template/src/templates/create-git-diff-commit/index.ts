import { Document } from '@langchain/core/documents';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../../base';
// schema
import { z } from 'zod';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly/openapi-schema';

interface GraphState extends BaseSkillState {
  documents: Document[];
  messages: BaseMessage[];
}

// Define a new graph

export class CreateGitDiffCommitSkill extends BaseSkill {
  name = 'create_git_diff_commit';
  displayName = {
    en: 'Create Git Diff Commit',
    'zh-CN': '创建Git Diff Commit',
  };

  icon: Icon = { type: 'emoji', value: '🔄' };
  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    context: {
      rules: [{ key: 'contentList' }],
    },
  };

  description = 'Create a git diff commit message based on changes';

  schema = z.object({
    query: z.string().describe('The user query or description of changes'),
  });

  graphState: StateGraphArgs<GraphState>['channels'] = {
    ...baseStateGraphArgs,
    documents: {
      reducer: (left?: Document[], right?: Document[]) => (right ? right : left || []),
      default: () => [],
    },
    messages: {
      reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
      default: () => [],
    },
  };

  async generate(state: GraphState, config?: SkillRunnableConfig) {
    this.engine.logger.log('---GENERATE GIT DIFF COMMIT---');

    const { locale = 'en', chatHistory = [] } = config?.configurable || {};
    const query = state.query || '';

    const llm = this.engine.chatModel({
      temperature: 0.2,
    });

    const systemPrompt = `
# IDENTITY and PURPOSE

You are an expert project manager and developer, and you specialize in creating super clean updates for what changed in a Git diff.

# STEPS
1. Analyze the provided information to understand the nature and scope of the changes.
2. Determine the appropriate conventional commit prefix (e.g., "feat:", "fix:", "chore:").
3. Craft a concise yet descriptive commit message.
4. Generate the necessary Git commands to stage the changes and create the commit.

# OUTPUT INSTRUCTIONS

- Use conventional commits - i.e. prefix the commit title with "chore:" (if it's a minor change like refactoring or linting), "feat:" (if it's a new feature), "fix:" if its a bug fix

- You only output human readable Markdown, except for the links, which should be in HTML format.

- The output should only be the shell commands needed to update git.

- Do not place the output in a code block

# OUTPUT TEMPLATE
git add <file_name(s)>
git commit -m "<commit_message>"

#Example Template:
For the current changes, replace \`<file_name>\` with \`temp.py\` and \`<commit_message>\` with \`Added --newswitch switch to temp.py to do newswitch behavior\`:

git add temp.py 
git commit -m "feat: Added --newswitch switch to temp.py to do newswitch behavior"
#EndTemplate

# INPUT
User Input: {userInput}

Please generate the appropriate Git commands and commit message based on the provided information.
`;

    const prompt = systemPrompt.replace('{userInput}', query);

    const responseMessage = await llm.invoke([
      new SystemMessage(prompt),
      ...chatHistory,
      new HumanMessage(
        `Generate Git commands and commit message based on the provided information in ${locale} language.`,
      ),
    ]);

    return { messages: [responseMessage] };
  }

  toRunnable() {
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    })
      .addNode('generate', this.generate.bind(this))
      .addEdge(START, 'generate')
      .addEdge('generate', END);

    return workflow.compile();
  }
}
