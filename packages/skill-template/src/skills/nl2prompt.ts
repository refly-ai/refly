import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly/openapi-schema';
import { GraphState } from '../scheduler/types';
import { safeStringifyJSON } from '@refly/utils';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export class NL2Prompt extends BaseSkill {
  name = 'nl2prompt';

  icon: Icon = { type: 'emoji', value: '🔄' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'promptStyle',
        inputMode: 'select',
        defaultValue: 'detailed',
        labelDict: {
          en: 'Prompt Style',
          'zh-CN': '提示词风格',
        },
        descriptionDict: {
          en: 'Choose the style of generated prompts',
          'zh-CN': '选择生成提示词的风格',
        },
        options: [
          { value: 'detailed', labelDict: { en: 'Detailed & Professional', 'zh-CN': '详细专业' } },
          { value: 'concise', labelDict: { en: 'Concise & Direct', 'zh-CN': '简洁直接' } },
          { value: 'creative', labelDict: { en: 'Creative & Open-ended', 'zh-CN': '创意开放' } },
          { value: 'technical', labelDict: { en: 'Technical & Precise', 'zh-CN': '技术精确' } },
        ],
      },
      {
        key: 'includeExamples',
        inputMode: 'switch',
        defaultValue: true,
        labelDict: {
          en: 'Include Examples',
          'zh-CN': '包含示例',
        },
        descriptionDict: {
          en: 'Whether to include examples in the generated prompt',
          'zh-CN': '是否在生成的提示词中包含示例',
        },
      },
      {
        key: 'outputFormat',
        inputMode: 'select',
        defaultValue: 'structured',
        labelDict: {
          en: 'Output Format',
          'zh-CN': '输出格式',
        },
        descriptionDict: {
          en: 'Format of the generated prompt',
          'zh-CN': '生成提示词的格式',
        },
        options: [
          {
            value: 'structured',
            labelDict: { en: 'Structured (with sections)', 'zh-CN': '结构化（分段）' },
          },
          { value: 'paragraph', labelDict: { en: 'Single paragraph', 'zh-CN': '单段落' } },
          { value: 'bullets', labelDict: { en: 'Bullet points', 'zh-CN': '要点列表' } },
        ],
      },
      {
        key: 'targetAudience',
        inputMode: 'select',
        defaultValue: 'general',
        labelDict: {
          en: 'Target Audience',
          'zh-CN': '目标受众',
        },
        descriptionDict: {
          en: 'Target audience for the AI response',
          'zh-CN': 'AI 回应的目标受众',
        },
        options: [
          { value: 'general', labelDict: { en: 'General audience', 'zh-CN': '普通受众' } },
          {
            value: 'technical',
            labelDict: { en: 'Technical professionals', 'zh-CN': '技术专业人员' },
          },
          { value: 'educational', labelDict: { en: 'Students/Learners', 'zh-CN': '学生/学习者' } },
          {
            value: 'business',
            labelDict: { en: 'Business professionals', 'zh-CN': '商务专业人员' },
          },
        ],
      },
    ],
  };

  invocationConfig: SkillInvocationConfig = {};

  description = 'Convert natural language descriptions into structured and effective AI prompts';

  schema = z.object({
    query: z
      .string()
      .optional()
      .describe('The natural language description to convert into a prompt'),
    images: z
      .array(z.string())
      .optional()
      .describe('The images to be analyzed for prompt generation'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  callNL2Prompt = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { messages = [] } = state;
    const { tplConfig, locale = 'en', currentSkill, project } = config.configurable;

    // Extract customInstructions from project if available
    const customInstructions = project?.customInstructions;

    // Extract configuration values
    const promptStyle = String(tplConfig?.promptStyle?.value || 'detailed');
    const includeExamples = Boolean(tplConfig?.includeExamples?.value ?? true);
    const outputFormat = String(tplConfig?.outputFormat?.value || 'structured');
    const targetAudience = String(tplConfig?.targetAudience?.value || 'general');

    this.engine.logger.log(
      `NL2Prompt config - Style: ${promptStyle}, Format: ${outputFormat}, Audience: ${targetAudience}, Examples: ${includeExamples}`,
    );

    config.metadata.step = { name: 'analyzeRequest' };

    // Extract the user's natural language description
    const lastMessage = messages[messages.length - 1];
    const userDescription = (lastMessage?.content as string) || '';

    if (!userDescription?.trim()) {
      const errorMsg =
        locale === 'zh-CN'
          ? '请提供自然语言描述以转换为提示词'
          : 'Please provide a natural language description to convert into a prompt';
      throw new Error(errorMsg);
    }

    this.engine.logger.log(`Processing user description: ${userDescription.substring(0, 100)}...`);

    config.metadata.step = { name: 'generatePrompt' };

    // Build the system prompt for NL2Prompt conversion
    const systemPrompt = this.buildNL2PromptSystemPrompt(
      promptStyle,
      includeExamples,
      outputFormat,
      targetAudience,
      locale,
      customInstructions,
    );

    // Build the user prompt
    const userPrompt = this.buildUserPrompt(
      userDescription,
      promptStyle,
      outputFormat,
      targetAudience,
      locale,
      customInstructions,
    );

    // Generate the optimized prompt
    const model = this.engine.chatModel({
      temperature: 0.3, // Lower temperature for more consistent prompt generation
    });

    const responseMessage = await model.invoke(
      [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)],
      {
        ...config,
        metadata: {
          ...config.metadata,
          ...currentSkill,
        },
      },
    );

    this.engine.logger.log(`Generated prompt: ${safeStringifyJSON(responseMessage)}`);

    return { messages: [responseMessage] };
  };

  private buildNL2PromptSystemPrompt(
    promptStyle: string,
    includeExamples: boolean,
    outputFormat: string,
    targetAudience: string,
    locale: string,
    customInstructions: string | undefined,
  ): string {
    const language = locale === 'zh-CN' ? 'Chinese' : 'English';

    const systemPrompt = `You are an expert prompt engineer specializing in converting natural language descriptions into highly effective AI prompts. Your task is to transform user descriptions into structured, clear, and actionable prompts that will generate the best possible AI responses.

## Your Expertise:
- Understanding user intent and context
- Crafting clear, specific instructions
- Adding appropriate constraints and guidelines
- Optimizing for different AI models and use cases
- Structuring prompts for maximum effectiveness

## Prompt Style: ${promptStyle}
${this.getStyleGuidelines(promptStyle)}

## Output Format: ${outputFormat}
${this.getFormatGuidelines(outputFormat)}

## Target Audience: ${targetAudience}
${this.getAudienceGuidelines(targetAudience)}

${
  includeExamples
    ? `## Include Examples:
When appropriate, include 1-2 relevant examples in the generated prompt to clarify the expected output format or style.`
    : ''
}

## Instructions:
1. Analyze the user's natural language description carefully
2. Identify the core intent and desired outcome
3. Structure the prompt according to the specified format
4. Add clear, actionable instructions
5. Include relevant constraints and guidelines
6. Ensure the prompt is specific enough to generate consistent results
7. Make the prompt engaging and easy to understand

## Output Language: ${language}

Generate a well-structured AI prompt that will effectively achieve the user's described goal.${customInstructions ? `\n\n## Additional Project Instructions:\n${customInstructions}` : ''}`;

    return systemPrompt;
  }

  private buildUserPrompt(
    userDescription: string,
    promptStyle: string,
    outputFormat: string,
    targetAudience: string,
    locale: string,
    customInstructions: string | undefined,
  ): string {
    const language = locale === 'zh-CN' ? 'Chinese' : 'English';

    return `## User's Natural Language Description:
${userDescription}

## Requirements:
- Style: ${promptStyle}
- Format: ${outputFormat}
- Target Audience: ${targetAudience}
- Language: ${language}${customInstructions ? `\n- Additional Instructions: ${customInstructions}` : ''}

Please convert this description into an optimized AI prompt that will effectively accomplish the user's goal. Make sure the prompt is clear, specific, and actionable.`;
  }

  private getStyleGuidelines(style: string): string {
    switch (style) {
      case 'detailed':
        return 'Create comprehensive, thorough prompts with detailed instructions, context, and guidelines. Include multiple aspects and considerations.';
      case 'concise':
        return 'Create brief, direct prompts that get straight to the point. Focus on essential instructions only.';
      case 'creative':
        return 'Create open-ended, imaginative prompts that encourage creative and innovative responses. Allow room for interpretation.';
      case 'technical':
        return 'Create precise, methodical prompts with specific parameters, constraints, and technical requirements.';
      default:
        return 'Create well-balanced prompts that are clear and effective.';
    }
  }

  private getFormatGuidelines(format: string): string {
    switch (format) {
      case 'structured':
        return 'Organize the prompt into clear sections (e.g., Role, Task, Context, Instructions, Output Format, Examples).';
      case 'paragraph':
        return 'Present the prompt as a flowing, cohesive paragraph with natural transitions.';
      case 'bullets':
        return 'Use bullet points and numbered lists to organize instructions clearly and concisely.';
      default:
        return 'Use a clear, logical structure that enhances readability and effectiveness.';
    }
  }

  private getAudienceGuidelines(audience: string): string {
    switch (audience) {
      case 'technical':
        return 'Tailor the prompt for technical professionals. Use precise terminology, include technical specifications, and focus on accuracy and detail.';
      case 'educational':
        return 'Design the prompt for learning contexts. Include explanations, encourage step-by-step thinking, and promote understanding.';
      case 'business':
        return 'Focus on business outcomes, efficiency, and practical applications. Use professional language and business-relevant examples.';
      default:
        return 'Make the prompt accessible to a general audience with clear, everyday language while maintaining effectiveness.';
    }
  }

  toRunnable(): Runnable<any, any, RunnableConfig> {
    const workflow = new StateGraph<BaseSkillState>({
      channels: this.graphState,
    }).addNode('callNL2Prompt', this.callNL2Prompt);

    workflow.addEdge(START, 'callNL2Prompt');
    workflow.addEdge('callNL2Prompt', END);

    return workflow.compile();
  }
}
