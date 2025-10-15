import { CopilotWorkflowStep, StepNodeStatus } from '@refly/common-types';

export const AI_NEWS_DIGEST_STEPS: CopilotWorkflowStep[] = [
  {
    id: 'step-1-schedule',
    order: 1,
    title: 'Schedule Daily Automation',
    description: 'Configure the workflow to run automatically every day at your preferred time.',
    status: StepNodeStatus.PENDING,
    nodeId: 'schedule-step',
    prompt:
      'Set up daily schedule for AI news digest delivery at 9 AM. Configure automation parameters and validate timing settings for consistent daily execution.',
    estimatedTime: '30 seconds',
    dependencies: [],
  },
  {
    id: 'step-2-perplexity-search',
    order: 2,
    title: 'Search Latest AI News',
    description:
      'Use Perplexity AI to find the most recent and relevant AI news from the past 24 hours.',
    status: StepNodeStatus.PENDING,
    nodeId: 'perplexity-fetch-step',
    prompt:
      'Search for breaking AI news from the last 24 hours using Perplexity AI. Focus on: AI breakthroughs, product launches, research developments, and industry updates.',
    estimatedTime: '1-2 minutes',
    dependencies: ['step-1-schedule'],
  },
  {
    id: 'step-3-content-processing',
    order: 3,
    title: 'Process & Format Content',
    description:
      'Extract key information and reformat raw news data into a clean, readable digest format.',
    status: StepNodeStatus.PENDING,
    nodeId: 'content-extractor-step',
    prompt:
      'Process and format the collected AI news into a structured digest. Extract headlines, summaries, and key points. Organize by relevance and impact. Create clean, engaging content ready for email delivery.',
    estimatedTime: '1 minute',
    dependencies: ['step-2-perplexity-search'],
  },
  {
    id: 'step-4-email-delivery',
    order: 4,
    title: 'Send Gmail Digest',
    description: 'Generate and send the formatted AI news digest to your Gmail inbox.',
    status: StepNodeStatus.PENDING,
    nodeId: 'send-email-step',
    prompt:
      'Generate professional email with formatted AI news digest and send to specified Gmail address. Include engaging subject line, well-structured content, and source attribution. Ensure mobile-friendly formatting.',
    estimatedTime: '30 seconds',
    dependencies: ['step-3-content-processing'],
  },
];
