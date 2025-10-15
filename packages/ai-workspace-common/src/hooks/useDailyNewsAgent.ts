import { useCallback } from 'react';
import { useCopilotStore } from '@refly/stores';
import {
  shouldTriggerDailyNewsWorkflow,
  DAILY_AI_NEWS_CONFIG,
  DAILY_AI_NEWS_WORKFLOW_STEPS,
} from '../data/daily-news-workflow';

// Hook for handling Daily AI News Digest agent interactions
export const useDailyNewsAgent = () => {
  const { setMode, setWorkflowTitle, setIsCopilotOpen } = useCopilotStore();

  // Process user input and trigger workflow if matched
  const processUserInput = useCallback(
    (userInput: string) => {
      const shouldTrigger = shouldTriggerDailyNewsWorkflow(userInput);

      if (shouldTrigger) {
        // Switch to workflow mode
        setMode('workflow');

        // Set the workflow title
        setWorkflowTitle(DAILY_AI_NEWS_CONFIG.title);

        // Open copilot panel to show workflow steps
        setIsCopilotOpen(true);

        // Return true to indicate this input was handled
        return true;
      }

      return false;
    },
    [setMode, setWorkflowTitle, setIsCopilotOpen],
  );

  // Generate Canvas configuration for the Daily AI News Digest
  const generateCanvasConfig = useCallback(() => {
    return {
      title: DAILY_AI_NEWS_CONFIG.title,
      description: DAILY_AI_NEWS_CONFIG.description,
      steps: DAILY_AI_NEWS_WORKFLOW_STEPS,
      variables: DAILY_AI_NEWS_CONFIG.variables,

      // Canvas node configuration
      nodes: [
        {
          id: 'start-node',
          type: 'start',
          position: { x: 100, y: 200 },
          data: {
            title: 'Daily AI News Digest Entry',
            note: DAILY_AI_NEWS_CONFIG.description,
            fields: DAILY_AI_NEWS_CONFIG.variables.map((variable) => ({
              name: variable.name,
              type: variable.type,
              placeholder: variable.placeholder,
              required: variable.required,
            })),
          },
        },
        ...DAILY_AI_NEWS_WORKFLOW_STEPS.map((step, index) => ({
          id: step.nodeId,
          type: 'skillResponse',
          position: {
            x: 300 + index * 280,
            y: 120,
          },
          data: {
            title: step.title,
            description: step.description,
            prompt: step.prompt,
            estimatedTime: step.estimatedTime,
            status: step.status,
          },
        })),
      ],
    };
  }, []);

  return {
    processUserInput,
    generateCanvasConfig,
    workflowSteps: DAILY_AI_NEWS_WORKFLOW_STEPS,
    workflowConfig: DAILY_AI_NEWS_CONFIG,
  };
};
