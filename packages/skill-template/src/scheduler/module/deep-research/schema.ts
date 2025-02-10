import { z } from 'zod';

// Add title schema with reason
export const titleSchema = z.object({
  title: z.string().describe('The document title based on user query and context'),
  description: z.string().optional().describe('A brief description of the document content'),
  reason: z.string().describe('The reasoning process for generating this title'),
});

// Define research step schemas with detailed descriptions
export const searchResultSchema = z.object({
  title: z.string().describe('The title of the search result'),
  url: z.string().describe('The URL of the search result'),
  description: z.string().describe('A brief description of the search result content'),
  relevance: z.number().min(0).max(1).describe('Relevance score between 0 and 1'),
  confidence: z.number().min(0).max(1).describe('Confidence score of the result between 0 and 1'),
});

export const extractResultSchema = z.object({
  url: z.string().describe('The URL of the extracted content'),
  content: z.string().describe('The extracted content from the URL'),
  keyPoints: z.array(z.string()).describe('Key points extracted from the content'),
  metadata: z
    .object({
      author: z.string().optional().describe('Author of the content if available'),
      date: z.string().optional().describe('Publication date if available'),
      source: z.string().describe('Source domain or platform'),
    })
    .describe('Additional metadata about the content'),
});

export const analysisSchema = z.object({
  summary: z.string().describe('A comprehensive summary of the findings'),
  gaps: z.array(z.string()).describe('Identified gaps in the current research'),
  nextSteps: z.array(z.string()).describe('Recommended next steps for research'),
  shouldContinue: z.boolean().describe('Whether further research is needed'),
  nextSearchTopic: z.string().optional().describe('The next topic to search if continuing'),
  confidence: z
    .object({
      findings: z.number().min(0).max(1).describe('Confidence in the current findings'),
      gaps: z.number().min(0).max(1).describe('Confidence in identified gaps'),
      recommendations: z.number().min(0).max(1).describe('Confidence in next step recommendations'),
    })
    .describe('Confidence scores for different aspects of the analysis'),
});

// Add schema for research planning
export const researchPlanSchema = z
  .object({
    mainTopic: z
      .string()
      .describe('The main research topic, possibly refined from the original query'),
    scope: z
      .object({
        breadth: z.number().min(1).max(5).describe('How broad the research scope should be (1-5)'),
        depth: z.number().min(1).max(5).describe('How deep the research should go (1-5)'),
        timeEstimate: z.number().describe('Estimated time needed in minutes'),
      })
      .describe('Research scope parameters'),
    subTopics: z
      .array(
        z.object({
          topic: z.string().describe('A specific sub-topic to research'),
          priority: z.number().min(1).max(5).describe('Priority level of this sub-topic (1-5)'),
          rationale: z.string().describe('Why this sub-topic is important'),
        }),
      )
      .describe('List of sub-topics to investigate'),
    approach: z
      .object({
        initialFocus: z.string().describe('What to focus on first'),
        methodology: z.array(z.string()).describe('Steps to follow in the research'),
        potentialSources: z.array(z.string()).describe('Types of sources to prioritize'),
      })
      .describe('Research approach details'),
    confidence: z.number().min(0).max(1).describe('Overall confidence in the research plan'),
  })
  .describe('Structured research plan');
