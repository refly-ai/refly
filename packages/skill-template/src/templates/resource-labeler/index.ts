import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';

// schema
import { z } from 'zod';
// types
import { SystemMessage } from '@langchain/core/messages';
import { HumanMessage } from '@langchain/core/messages';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../../base';
import { LabelClass, SkillInvocationConfig, SkillTemplateConfigSchema } from '@refly/openapi-schema';

interface GraphState extends BaseSkillState {
  labelClass: LabelClass;
  labels: string[];
}

export class ResourceLabelerSkill extends BaseSkill {
  name = 'resource_labeler';

  displayName = {
    en: 'Resource Labeler',
    'zh-CN': '资源标签归类',
  };

  configSchema: SkillTemplateConfigSchema = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {
    input: {
      rules: [],
    },
    context: {
      rules: [{ key: 'resourceIds', limit: 1, required: true }],
    },
  };

  description = 'Add labels to given resource. Key and values are arbitrary.';

  schema = z.object({});

  graphState: StateGraphArgs<GraphState>['channels'] = {
    ...baseStateGraphArgs,
    labelClass: {
      reducer: (left?: LabelClass, right?: LabelClass) => (right ? right : left || null),
      default: () => null,
    },
    labels: {
      reducer: (x: string[], y: string[]) => x.concat(y),
      default: () => [],
    },
  };

  checkResourceValid = (state: GraphState, config: SkillRunnableConfig): 'prepareLabelClass' | typeof END => {
    const { resources = [] } = config?.configurable || {};

    if (resources.length === 0) {
      this.emitEvent({ event: 'log', content: `No resource selected` }, config);
      return END;
    }

    if (!resources[0].content) {
      this.emitEvent({ event: 'log', content: `Resource content is empty, skip labeling` }, config);
      return END;
    }

    return 'prepareLabelClass';
  };

  prepareLabelClass = async (state: GraphState, config: SkillRunnableConfig): Promise<Partial<GraphState>> => {
    const { user } = config;

    // TODO: make label class configurable
    const { data: labelClass, success } = await this.engine.service.createLabelClass(user, {
      name: `resource_category_labeler`,
      displayName: `内容分类标签`,
      icon: 'IconBulb',
      prompt: '',
    });
    if (!success || !labelClass) {
      this.emitEvent({ event: 'log', content: `Create label class failed` }, config);
      return {};
    }

    this.emitEvent(
      { event: 'log', content: `Label class ready: ${labelClass.displayName} (${labelClass.name})` },
      config,
    );

    return { labelClass };
  };

  checkLabelClassValid = (state: GraphState): 'generateLabels' | typeof END => {
    const { labelClass } = state;
    if (labelClass) {
      return 'generateLabels';
    } else {
      return END;
    }
  };

  generateLabels = async (state: GraphState, config: SkillRunnableConfig): Promise<Partial<GraphState>> => {
    const { resources, locale = 'en' } = config?.configurable || {};
    const resource = resources[0];

    const getSystemPrompt = (title: string, content: string) => `# Role
You are a sharp expert in textual content classification, proficient in identifying textual information and categorizing it correctly. Your sole task is to interpret the text, provide the corresponding classification, and justify the categorization.

## Skills
### Skill 1: Text Content Classification
- Identify the textual content and keywords provided by the user.
- Determine the appropriate category based on the content and keywords.
- Interpret and analyze the information to output the categorization labels.

### Skill 2: Understanding Classification Criteria
- Comprehend different classification lists and their descriptions.
- Integrate the understanding of connections and distinctions between categories to perform accurate categorization.

## Constraints:
- Discussion should be limited to the classification of textual content.
- Ensure that all classifications adhere to the provided classification list.
- Explanations and reasons for each categorization should be within 100 words.
- Utilize content from the knowledge base. For unknown texts, conduct searches and browse for information.

## Context Supplement

Title: ${title}

Content: ${content}
`;

    const model = this.engine.chatModel({ temperature: 0.1 });

    const runnable = model.withStructuredOutput(
      z
        .object({
          labels: z.array(z.string()).describe(`Generate at most five labels in locale: ${locale} language`),
        })
        .describe(
          `Understand and analyze the provided context to identify key information, and based on this ` +
            `key information, formulate at most five labels to assist users in gaining a better understanding of the content.`,
        ),
    );
    const output = await runnable.invoke([
      new SystemMessage(getSystemPrompt(resource.title, resource.content)),
      new HumanMessage(`Please output answer in ${locale} language:`),
    ]);

    return { labels: output.labels || [] };
  };

  bindLabels = async (state: GraphState, config: SkillRunnableConfig): Promise<Partial<GraphState>> => {
    const { labelClass, labels } = state;
    const { user, configurable } = config;
    const { resources } = configurable;
    const resource = resources[0];

    const { data, success } = await this.engine.service.createLabelInstance(user, {
      labelClassId: labelClass.labelClassId,
      valueList: labels,
      entityType: 'resource',
      entityId: resource.resourceId,
    });

    if (!success || !data) {
      this.emitEvent({ event: 'log', content: `Create label instances failed` }, config);
      return {};
    }

    this.emitEvent({ event: 'log', content: `Total of ${data.length} label instances created` }, config);

    return {};
  };

  toRunnable() {
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    })
      .addNode('prepareLabelClass', this.prepareLabelClass)
      .addNode('generateLabels', this.generateLabels)
      .addNode('bindLabels', this.bindLabels);

    workflow.addConditionalEdges(START, this.checkResourceValid);
    workflow.addConditionalEdges('prepareLabelClass', this.checkLabelClassValid);
    workflow.addEdge('generateLabels', 'bindLabels');
    workflow.addEdge('bindLabels', END);

    return workflow.compile();
  }
}
