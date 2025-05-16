import { Logger } from '@nestjs/common';
import { BaseChatModel } from '@refly/providers';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { extractJsonFromMarkdown } from '@refly/utils';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { PilotSession } from '@/generated/client';
import { SkillInput } from '@refly/openapi-schema';

const pilotStepSchema = z
  .object({
    name: z.string().describe('A clear and concise title for the step'),
    skillName: z
      .enum(['commonQnA', 'webSearch', 'librarySearch', 'generateDoc', 'codeArtifacts'])
      .describe('The name of the skill to invoke'),
    query: z.string().describe('The query to ask the skill'),
    contextItemIds: z
      .array(z.string())
      .describe('The ID list of the relevant canvas items for this step'),
  })
  .describe('A single action step of the pilot');

const multiStepSchema = z
  .object({
    steps: z.array(pilotStepSchema).describe('A list of steps of the pilot'),
  })
  .describe('A list of steps of the pilot');

type PilotStep = z.infer<typeof pilotStepSchema>;

/**
 * Generates a detailed schema guide with example for LLM
 */
function generateSchemaInstructions(): string {
  // Convert Zod schema to JSON Schema for better documentation
  const jsonSchema = zodToJsonSchema(pilotStepSchema, { target: 'openApi3' });

  // Generate example based on the schema
  const exampleStep = {
    name: 'Find recent research on quantum computing',
    skillName: 'webSearch',
    query: 'latest advancements in quantum computing 2023',
    contextItemIds: ['quantum-intro-123'],
  };

  return `Please generate a structured JSON array of research steps with the following schema:

Each step should have:
1. "name": A clear, concise title for the step
2. "skillName": The specific skill to invoke (one of: "commonQnA", "webSearch", "librarySearch", "generateDoc", "codeArtifacts")
3. "query": The specific question or prompt to send to the skill
4. "contextItemIds": Array of IDs for relevant canvas items that provide context for this step

Example step:
\`\`\`json
${JSON.stringify(exampleStep, null, 2)}
\`\`\`

JSON Schema Definition:
\`\`\`json
${JSON.stringify(jsonSchema, null, 2)}
\`\`\`

IMPORTANT:
- Each step should be focused on a specific research sub-task
- Make steps logical and progressive, building on previous steps when appropriate
- Ensure each step has a clear purpose that contributes to answering the main research question
- Ensure your response is a valid JSON array of steps that follow the schema exactly
`;
}

/**
 * Builds few-shot examples for research step decomposition
 */
function buildResearchStepExamples(): string {
  return `
Example 1:
User Question: "What are the latest advancements in quantum computing and their potential applications?"
Canvas Content:
## Canvas Item 1 (ID: quantum-intro-123, Type: document)
**Document Title:** Introduction to Quantum Computing
**Document Preview:**
This document provides a basic overview of quantum computing principles including qubits, superposition, and entanglement.
**Context ID:** quantum-intro-123

Expected Output:
[
  {
    "name": "Search for recent quantum computing papers",
    "skillName": "webSearch",
    "query": "latest research papers quantum computing 2023",
    "contextItemIds": ["quantum-intro-123"]
  },
  {
    "name": "Find quantum computing applications",
    "skillName": "webSearch",
    "query": "practical applications of quantum computing in industry",
    "contextItemIds": ["quantum-intro-123"]
  },
  {
    "name": "Research leading companies in quantum",
    "skillName": "librarySearch",
    "query": "leading companies in quantum computing technology",
    "contextItemIds": ["quantum-intro-123"]
  },
  {
    "name": "Generate summary document",
    "skillName": "generateDoc",
    "query": "Create a comprehensive summary of recent quantum computing advancements and applications",
    "contextItemIds": ["quantum-intro-123"]
  }
]

Example 2:
User Question: "How can I implement a secure authentication system for my Node.js API?"
Canvas Content:
## Canvas Item 1 (ID: nodejs-dev-456, Type: document)
**Document Title:** Node.js API Development
**Document Preview:**
Guide to building RESTful APIs with Node.js and Express.
**Context ID:** nodejs-dev-456

## Canvas Item 2 (ID: jwt-info-789, Type: skillResponse)
**Question:** What is JWT authentication?
**Answer:**
JSON Web Tokens (JWT) provide a way to securely transmit information between parties as a JSON object.
**Context ID:** jwt-info-789

Expected Output:
[
  {
    "name": "Research authentication libraries",
    "skillName": "webSearch",
    "query": "most secure Node.js authentication libraries 2023",
    "contextItemIds": ["nodejs-dev-456"]
  },
  {
    "name": "Get JWT implementation best practices",
    "skillName": "webSearch",
    "query": "JWT implementation best practices Node.js",
    "contextItemIds": ["jwt-info-789"]
  },
  {
    "name": "Find code examples",
    "skillName": "codeArtifacts",
    "query": "secure JWT authentication implementation in Node.js",
    "contextItemIds": ["nodejs-dev-456", "jwt-info-789"]
  },
  {
    "name": "Get security considerations",
    "skillName": "commonQnA",
    "query": "What are the security vulnerabilities to consider when implementing JWT authentication?",
    "contextItemIds": ["jwt-info-789"]
  },
  {
    "name": "Generate implementation guide",
    "skillName": "generateDoc",
    "query": "Create a step-by-step guide for implementing secure JWT authentication in a Node.js API",
    "contextItemIds": ["nodejs-dev-456", "jwt-info-789"]
  }
]`;
}

/**
 * Formats canvas content items into a detailed, structured string format
 * Provides rich context including item types, IDs, and formatted content
 */
function formatCanvasContent(contentItems: CanvasContentItem[]): string {
  if (!contentItems?.length) {
    return '';
  }

  // Add an index to each item and format with detailed information
  return contentItems
    .map((item, index) => {
      const itemId = item?.id || 'unknown-id';
      const itemType = item?.type || 'unknown-type';
      const header = `## Canvas Item ${index + 1} (ID: ${itemId}, Type: ${itemType})`;

      if (itemType === 'skillResponse') {
        return `${header}\n**Question:** ${item?.title || 'No title'}\n**Answer:**\n${item?.content || 'No content'}\n**Context ID:** ${itemId}`;
      }

      if (itemType === 'document') {
        if (item?.title && item?.content) {
          return `${header}\n**Document Title:** ${item.title}\n**Document Content:**\n${item.content}\n**Context ID:** ${itemId}`;
        }
        if (item?.title && item?.contentPreview) {
          return `${header}\n**Document Title:** ${item.title}\n**Document Preview:**\n${item.contentPreview}\n**Context ID:** ${itemId}`;
        }
      }

      if (itemType === 'codeArtifact') {
        return `${header}\n**Code Snippet:** ${item?.title || 'Untitled Code'}\n\`\`\`\n${item?.content || item?.contentPreview || 'No code available'}\n\`\`\`\n**Context ID:** ${itemId}`;
      }

      // Generic case for other item types
      if (item?.title && (item?.content || item?.contentPreview)) {
        return `${header}\n**Title:** ${item.title}\n**Content:**\n${item?.content || item?.contentPreview || 'No content available'}\n**Context ID:** ${itemId}`;
      }

      return null;
    })
    .filter(Boolean)
    .join('\n\n---\n\n');
}

export class PilotEngine {
  private logger = new Logger(PilotEngine.name);

  constructor(
    private readonly model: BaseChatModel,
    private readonly session: PilotSession,
  ) {}

  async run(contentItems: CanvasContentItem[], maxStepsPerEpoch = 3): Promise<PilotStep[]> {
    const sessionInput: SkillInput = JSON.parse(this.session.input);
    const userQuestion = sessionInput.query;
    const combinedContent = formatCanvasContent(contentItems);

    try {
      if (!userQuestion) {
        this.logger.warn('No user question provided for research planning');
        return [];
      }

      // If no content is available, bootstrap with just the user question
      if (!combinedContent) {
        this.logger.log(
          `No canvas content available. Bootstrapping research planning based solely on user question: "${userQuestion}"`,
        );
        return this.generateResearchWithoutContent(userQuestion, maxStepsPerEpoch);
      }

      this.logger.log(
        `Planning research steps for "${userQuestion}" with ${contentItems.length} content items`,
      );

      // First attempt: Use LLM structured output capability
      try {
        const structuredLLM = this.model.withStructuredOutput(multiStepSchema);

        // Combine schema instructions with examples and content
        const fullPrompt = `You are an expert research assistant capable of breaking down complex questions into clear, actionable research steps.

## Your Task
Analyze the user's question and available canvas content, then generate a structured research plan with specific steps to thoroughly investigate the topic.

## Guidelines
1. Break down the research into logical, sequential steps
2. Select the most appropriate skill for each research step
3. Craft specific and focused queries for each skill
4. Reference relevant context items from the canvas when appropriate
   - Use the exact context IDs (e.g., "quantum-intro-123") from the Canvas Content section
   - Include multiple context IDs when a step builds on multiple sources
   - Reference different context items based on their relevance to each specific step
5. Build on information gained from previous steps
6. Consider which skills would be most effective for different aspects of the research:
   - Use 'webSearch' for recent information or specific facts
   - Use 'librarySearch' for academic or in-depth research
   - Use 'commonQnA' for general knowledge questions
   - Use 'codeArtifacts' for technical implementation details
   - Use 'generateDoc' to synthesize findings into reports or summaries
7. Generate exactly ${maxStepsPerEpoch} research steps to efficiently explore the topic

${generateSchemaInstructions()}

Here are examples with expected outputs:
${buildResearchStepExamples()}

User Question: "${userQuestion}"

Canvas Content:
${combinedContent}`;

        const { steps } = await structuredLLM.invoke(fullPrompt);

        this.logger.log(`Generated research plan: ${JSON.stringify(steps)}`);

        return steps;
      } catch (structuredError) {
        this.logger.warn(
          `Structured output failed: ${structuredError.message}, trying fallback approach`,
        );
        // Continue to fallback
      }

      // Second attempt: Manual JSON parsing approach
      const schemaInstructions = generateSchemaInstructions();
      const fullPrompt = `You are an expert research assistant capable of breaking down complex questions into clear, actionable research steps.

## Your Task
Analyze the user's question and available canvas content, then generate a structured research plan to thoroughly investigate the topic.

## Guidelines
1. Break down the research into logical, sequential steps
2. Select the most appropriate skill for each research step
3. Craft specific and focused queries for each skill
4. Reference relevant context items from the canvas when appropriate
   - Use the exact context IDs (e.g., "quantum-intro-123") from the Canvas Content section
   - Include multiple context IDs when a step builds on multiple sources
   - Reference different context items based on their relevance to each specific step
5. Build on information gained from previous steps
6. Consider which skills would be most effective for different aspects of the research:
   - Use 'webSearch' for recent information or specific facts
   - Use 'librarySearch' for academic or in-depth research
   - Use 'commonQnA' for general knowledge questions
   - Use 'codeArtifacts' for technical implementation details
   - Use 'generateDoc' to synthesize findings into reports or summaries
7. Generate exactly ${maxStepsPerEpoch} research steps to efficiently explore the topic

${schemaInstructions}

User Question: "${userQuestion}"

Canvas Content:
${combinedContent}

Respond ONLY with a valid JSON array wrapped in \`\`\`json and \`\`\` tags.`;

      const response = await this.model.invoke(fullPrompt);
      const responseText = response.content.toString();

      // Extract and parse JSON
      const extraction = extractJsonFromMarkdown(responseText);

      if (extraction.error) {
        throw new Error(
          `JSON extraction failed: ${extraction.error.message}, using final fallback`,
        );
      }

      const { steps } = await multiStepSchema.parseAsync(extraction.result);

      this.logger.log(`Successfully generated research plan with ${steps?.length} steps`);
      return steps;
    } catch (error) {
      this.logger.error(`Error generating research plan: ${error.message}`);
      return [];
    }
  }

  /**
   * Generates research steps based solely on the user question when no canvas content is available
   * @param userQuestion The user's research question
   * @param maxStepsPerEpoch The maximum number of steps to generate
   */
  private async generateResearchWithoutContent(
    userQuestion: string,
    maxStepsPerEpoch = 3,
  ): Promise<PilotStep[]> {
    try {
      // First attempt: Use LLM structured output capability with empty context
      try {
        const structuredLLM = this.model.withStructuredOutput(multiStepSchema);

        const fullPrompt = `You are an expert research assistant capable of breaking down complex questions into clear, actionable research steps.

## Your Task
Analyze the user's question and generate a structured research plan with specific steps to thoroughly investigate the topic. Since no existing content or context is available, create a plan that starts from scratch.

## Guidelines
1. Break down the research into logical, sequential steps
2. Select the most appropriate skill for each research step
3. Craft specific and focused queries for each skill
4. Use an empty array for contextItemIds since no context is available yet
5. Build on information gained from previous steps in your plan
6. Consider which skills would be most effective for different aspects of the research:
   - Use 'webSearch' for recent information or specific facts
   - Use 'librarySearch' for academic or in-depth research
   - Use 'commonQnA' for general knowledge questions
   - Use 'codeArtifacts' for technical implementation details or code examples
   - Use 'generateDoc' to synthesize findings into reports or summaries
7. Generate exactly ${maxStepsPerEpoch} research steps to efficiently explore the topic

${generateSchemaInstructions()}

Create a research plan that:
1. Begins with broad information gathering
2. Progresses to more specific aspects of the topic
3. Concludes with steps to synthesize or apply the information

User Question: "${userQuestion}"

Note: No existing context items are available, so use empty arrays for contextItemIds.`;

        const { steps } = await structuredLLM.invoke(fullPrompt);

        this.logger.log(`Generated bootstrap research plan: ${JSON.stringify(steps)}`);

        return steps;
      } catch (structuredError) {
        this.logger.warn(
          `Structured output for bootstrap plan failed: ${structuredError.message}, trying fallback approach`,
        );
        // Continue to fallback
      }

      // Second attempt: Manual JSON parsing approach
      const schemaInstructions = generateSchemaInstructions();
      const fullPrompt = `You are an expert research assistant capable of breaking down complex questions into clear, actionable research steps.

## Your Task
Analyze the user's question and generate a structured research plan to thoroughly investigate the topic. Since no existing content or context is available, create a plan that starts from scratch.

## Guidelines
1. Break down the research into logical, sequential steps
2. Select the most appropriate skill for each research step
3. Craft specific and focused queries for each skill
4. Use empty arrays for contextItemIds since no context is available yet
5. Build on information gained from previous steps
6. Consider which skills would be most effective for different aspects of the research:
   - Use 'webSearch' for recent information or specific facts
   - Use 'librarySearch' for academic or in-depth research
   - Use 'commonQnA' for general knowledge questions
   - Use 'codeArtifacts' for technical implementation details
   - Use 'generateDoc' to synthesize findings into reports or summaries
7. Generate exactly ${maxStepsPerEpoch} research steps to efficiently explore the topic

${schemaInstructions}

User Question: "${userQuestion}"

Respond ONLY with a valid JSON array wrapped in \`\`\`json and \`\`\` tags.`;

      const response = await this.model.invoke(fullPrompt);
      const responseText = response.content.toString();

      // Extract and parse JSON
      const extraction = extractJsonFromMarkdown(responseText);

      if (extraction.error) {
        throw new Error(`JSON extraction failed for bootstrap plan: ${extraction.error.message}`);
      }

      const { steps } = await multiStepSchema.parseAsync(extraction.result);

      this.logger.log(`Successfully generated bootstrap research plan with ${steps?.length} steps`);
      return steps;
    } catch (error) {
      this.logger.error(`Error generating bootstrap research plan: ${error.message}`);
      return [];
    }
  }
}
