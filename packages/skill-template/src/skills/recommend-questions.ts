import { START, END, StateGraph } from '@langchain/langgraph';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { GraphState } from '../scheduler/types';
import { z } from 'zod';
import { BaseMessage } from '@langchain/core/messages';
import { extractStructuredData } from '../scheduler/utils/extractor';
import { truncateMessages } from '../scheduler/utils/truncator';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly-packages/openapi-schema';

// Schema for recommended questions with reasoning
const recommendQuestionsSchema = z.object({
  recommended_questions: z
    .array(z.string().describe('A concise follow-up question (10-30 characters)'))
    .min(3)
    .max(6)
    .describe('List of recommended follow-up questions'),
  reasoning: z.string().describe('Brief explanation of why these questions are recommended'),
});

export class RecommendQuestions extends BaseSkill {
  name = 'recommendQuestions';

  icon: Icon = { type: 'emoji', value: '❓' };

  description = 'Generate relevant follow-up questions based on conversation context';

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {};

  schema = z.object({
    query: z.string().describe('The query to recommend questions'),
  });

  graphState = {
    ...baseStateGraphArgs,
  };

  // Main method to generate related questions
  genRecommendQuestions = async (state: GraphState, config: SkillRunnableConfig): Promise<Partial<GraphState>> => {
    const { messages = [] } = state;
    const { locale = 'en', chatHistory = [] } = config.configurable || {};

    // Generate title first
    config.metadata.step = { name: 'recommendQuestions' };

    // Truncate chat history with larger window for better context
    const usedChatHistory = truncateMessages(chatHistory, 10, 800, 4000);

    const model = this.engine.chatModel({ temperature: 0.1 });

    const systemPrompt = `## Role
You are an expert at analyzing conversations and generating relevant follow-up questions.

## Task
Generate 3 highly relevant follow-up questions based on the provided context (if any) or initial query.
Each question should:
- Be concise (30-100 characters)
- Be contextually relevant
- Help deepen the conversation
- Be in the specified language: ${locale}

## Output Format
Generate questions with reasoning in JSON format:
{
  "recommended_questions": ["question1", "question2", "question3"],
  "reasoning": "Brief explanation of why these questions are recommended"
}

## Guidelines
- Questions should be specific and focused
- Avoid repetitive or overly general questions
- Ensure questions naturally flow from the conversation or initial query
- Provide clear reasoning for the questions' relevance
- IMPORTANT: Generate NEW questions based on the actual context, DO NOT copy from examples
- Each question should be unique and specifically tailored to the current conversation

## Examples (For Format Reference Only)
IMPORTANT: These examples are only to demonstrate the expected format. 
DO NOT reuse or modify these example questions. 
Always generate completely new questions based on the actual conversation context.

### Example 1: With Conversation History
Input:
CONVERSATION HISTORY:
human: What are the best practices for React performance optimization?
assistant: The key practices include using React.memo for component memoization, proper key usage in lists, and avoiding unnecessary re-renders through useCallback and useMemo hooks.

Output:
{
  "recommended_questions": [
    "How does React.memo work?",
    "When to use useCallback?",
    "Best practices for keys?"
  ],
  "reasoning": "These questions dive deeper into specific performance optimization techniques mentioned in the conversation."
}

### Example 2: Without Conversation History
Input:
human: How to get started with TypeScript?

Output:
{
  "recommended_questions": [
    "TypeScript vs JavaScript?",
    "Essential TS features?",
    "Setup TS project?"
  ],
  "reasoning": "These questions cover fundamental aspects that beginners need to understand."
}

## IMPORTANT REMINDER:
- The examples above are for format reference ONLY
- Generate completely new and relevant questions based on the current context
- Do not copy or paraphrase questions from the examples
- Focus on the actual conversation content to create targeted, meaningful questions`;

    try {
      // Prepare messages for context
      const contextMessages = [...usedChatHistory, ...messages]
        .map((msg) => `${msg?.getType?.()}: ${msg.content}`)
        .join('\n');

      const prompt = `${systemPrompt}

${contextMessages ? `CONVERSATION HISTORY:\n${contextMessages}\n` : ''}
Please generate relevant follow-up questions in ${locale} language.`;

      const result = await extractStructuredData(
        model,
        recommendQuestionsSchema,
        prompt,
        config,
        3, // Max retries
      );

      // Emit structured data including both questions and reasoning
      this.emitEvent(
        {
          event: 'structured_data',
          content: JSON.stringify({
            questions: result.recommended_questions,
            locale,
          }),
          structuredDataKey: 'recommendedQuestions',
        },
        config,
      );

      return {};
    } catch (error) {
      this.engine.logger.error(`Error generating recommended questions: ${error.stack}`);
      return {};
    }
  };

  // Convert to runnable workflow
  toRunnable(): Runnable<any, any, RunnableConfig> {
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    })
      .addNode('recommendQuestions', this.genRecommendQuestions)
      .addEdge(START, 'recommendQuestions')
      .addEdge('recommendQuestions', END);

    return workflow.compile();
  }
}
