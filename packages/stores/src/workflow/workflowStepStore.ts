import { create } from 'zustand';
import { StepNodeStatus } from '@refly/common-types';

interface WorkflowStepState {
  // Step节点状态
  stepStates: Map<string, StepNodeStatus>;
  currentExecutingStep: string | null;
  completedSteps: Set<string>;

  // 执行结果和上下文
  stepResults: Map<string, any>;
  workflowContext: Record<string, any>;

  // UI状态
  selectedStepId: string | null;
  isWorkflowMode: boolean;
  workflowTitle: string;

  // Actions
  updateStepStatus: (stepId: string, status: StepNodeStatus) => void;
  canExecuteStep: (stepId: string, stepDependencies?: string[]) => boolean;
  setStepResult: (stepId: string, result: any) => void;
  updateWorkflowContext: (updates: Record<string, any>) => void;
  selectStep: (stepId: string | null) => void;
  resetWorkflow: () => void;
  executeStep: (stepId: string, options?: StepExecutionOptions) => Promise<void>;
  setWorkflowMode: (enabled: boolean) => void;
  setWorkflowTitle: (title: string) => void;
}

interface StepExecutionResult {
  success: boolean;
  result: string;
  contextUpdates?: Record<string, any>;
  nodeId?: string;
  modelUsed?: string;
  executionTime?: number;
}

interface StepExecutionOptions {
  modelConfig?: {
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  prompt?: string;
  contextData?: Record<string, any>;
}

// Enhanced Mock API function with context integration - replace with actual API call
const executeWorkflowStepAPI = async (
  stepId: string,
  _workflowContext: Record<string, any>,
  options?: StepExecutionOptions,
): Promise<StepExecutionResult> => {
  const startTime = Date.now();

  // Simulate API call with enhanced model configuration and context awareness
  return new Promise<StepExecutionResult>((resolve) => {
    setTimeout(() => {
      const executionTime = Date.now() - startTime;
      const modelUsed = options?.modelConfig?.model || '@kimi';

      // Generate context-aware results based on step type
      let resultContent = '';
      const contextData = options?.contextData || {};

      switch (stepId) {
        case 'schedule-step':
          resultContent = `Daily AI News Digest scheduled for 9:00 AM EST. Configuration includes timezone handling, retry mechanism (3 attempts), and health checks. Model: ${modelUsed}`;
          break;
        case 'perplexity-fetch-step':
          resultContent = `Fetched 15 AI news articles from past 24 hours using Perplexity API. Topics: ${contextData.workflow_variables?.perplexity_search_topic || 'AI developments'}. Sources include TechCrunch, MIT Tech Review, VentureBeat. Model: ${modelUsed}`;
          break;
        case 'content-extractor-step':
          resultContent = `Extracted full content from 15 articles. Generated structured JSON with metadata, key quotes, and topics. Handled 2 paywalled articles with preview text. Context from: ${contextData.context_summary ? 'Previous Perplexity results' : 'No context'}. Model: ${modelUsed}`;
          break;
        case 'news-quality-filter':
          resultContent = `Filtered and ranked articles. Selected top 12 articles (scores 7-10). Removed 3 duplicates and 2 low-quality sources. Quality distribution: 4 breaking news, 3 technical breakthroughs, 5 industry updates. Model: ${modelUsed}`;
          break;
        case 'llm-format-step':
          resultContent = `Formatted digest into professional email structure. Created sections: Top Headlines (4), Technical Breakthroughs (3), Industry Updates (3), Quick Bytes (5). Estimated read time: 8 minutes. Context integration from filtered articles. Model: ${modelUsed}`;
          break;
        case 'gmail-draft-step': {
          const recipientEmail =
            contextData.workflow_variables?.recipient_email || 'user@example.com';
          resultContent = `Created Gmail draft for ${recipientEmail}. Subject: "🤖 AI Daily Digest - ${new Date().toLocaleDateString()} | 12 stories, 8 min read". HTML formatted with responsive design and tracking. Model: ${modelUsed}`;
          break;
        }
        case 'approval-step':
          resultContent = `Presented draft for approval. Quality checks passed: fact-checking (95% confidence), bias detection (low bias), link validation (all accessible). Content balance: Research 33%, Business 42%, Policy 25%. Awaiting human approval. Model: ${modelUsed}`;
          break;
        case 'send-email-step': {
          const finalRecipient =
            contextData.workflow_variables?.recipient_email || 'user@example.com';
          resultContent = `Successfully delivered digest to ${finalRecipient}. Delivery metrics: sent in 2.3s, inbox placement confirmed, tracking pixels active. Next digest scheduled for tomorrow 9:00 AM. Model: ${modelUsed}`;
          break;
        }
        default:
          resultContent = `Step ${stepId} completed successfully using ${modelUsed}. Context integration: ${contextData.step_chain || 'No previous steps'}`;
      }

      resolve({
        success: true,
        result: resultContent,
        contextUpdates: {
          [`${stepId}_result`]: resultContent,
          [`${stepId}_model`]: modelUsed,
          [`${stepId}_prompt`]: options?.prompt || 'Default prompt',
          [`${stepId}_execution_time`]: executionTime,
          [`${stepId}_completion_timestamp`]: new Date().toISOString(),
          // Pass through workflow variables for next steps
          ...contextData.workflow_variables,
        },
        nodeId: stepId,
        modelUsed,
        executionTime,
      });
    }, 3000); // 3 seconds to show running process
  });
};

export const useWorkflowStepStore = create<WorkflowStepState>((set, get) => ({
  // Initial state
  stepStates: new Map(),
  currentExecutingStep: null,
  completedSteps: new Set(),
  stepResults: new Map(),
  workflowContext: {},
  selectedStepId: null,
  isWorkflowMode: false,
  workflowTitle: '',

  // Actions
  updateStepStatus: (stepId, status) => {
    const { stepStates, completedSteps } = get();
    const newStepStates = new Map(stepStates);
    newStepStates.set(stepId, status);

    const newCompletedSteps = new Set(completedSteps);
    if (status === StepNodeStatus.COMPLETED) {
      newCompletedSteps.add(stepId);
    } else if (completedSteps.has(stepId)) {
      newCompletedSteps.delete(stepId);
    }

    set({
      stepStates: newStepStates,
      completedSteps: newCompletedSteps,
      currentExecutingStep: status === StepNodeStatus.RUNNING ? stepId : null,
    });
  },

  // Check if step dependencies are satisfied
  canExecuteStep: (stepId: string, stepDependencies: string[] = []): boolean => {
    const { completedSteps, currentExecutingStep } = get();

    // Don't allow execution if another step is currently running
    if (currentExecutingStep !== null && currentExecutingStep !== stepId) {
      return false;
    }

    // Check if all dependencies are completed
    return stepDependencies.every((depStepId) => completedSteps.has(depStepId));
  },

  setStepResult: (stepId, result) => {
    const { stepResults } = get();
    const newResults = new Map(stepResults);
    newResults.set(stepId, result);
    set({ stepResults: newResults });
  },

  updateWorkflowContext: (updates) => {
    const { workflowContext } = get();
    set({
      workflowContext: { ...workflowContext, ...updates },
    });
  },

  selectStep: (stepId) => {
    set({ selectedStepId: stepId });
  },

  resetWorkflow: () => {
    set({
      stepStates: new Map(),
      currentExecutingStep: null,
      completedSteps: new Set(),
      stepResults: new Map(),
      workflowContext: {},
      selectedStepId: null,
    });
  },

  setWorkflowMode: (enabled) => {
    set({ isWorkflowMode: enabled });
  },

  setWorkflowTitle: (title) => {
    set({ workflowTitle: title });
  },

  executeStep: async (stepId, options) => {
    const { updateStepStatus, setStepResult, workflowContext, stepResults, canExecuteStep } = get();

    try {
      // Check dependencies before executing
      const stepDependencies = options?.contextData?.dependencies || [];
      if (!canExecuteStep(stepId, stepDependencies)) {
        throw new Error(`Dependencies not satisfied for step ${stepId}`);
      }

      updateStepStatus(stepId, StepNodeStatus.RUNNING);

      // Gather context from dependent steps with enhanced data structure
      const dependencyContext: Record<string, any> = {};
      const contextSummary: string[] = [];

      for (const depStepId of stepDependencies) {
        const depResult = stepResults.get(depStepId);
        if (depResult) {
          dependencyContext[`${depStepId}_output`] = depResult;
          dependencyContext[`${depStepId}_success`] = depResult.success;
          dependencyContext[`${depStepId}_result`] = depResult.result;

          // Create contextual summary for the current step
          if (depResult.result) {
            contextSummary.push(
              `Previous step (${depStepId}): ${depResult.result.substring(0, 200)}...`,
            );
          }
        }
      }

      // Add workflow-wide context variables
      dependencyContext.workflow_variables = {
        recipient_email: workflowContext.recipient_email || '@recipient_email',
        perplexity_api_key: workflowContext.perplexity_api_key || '@perplexity_api_key',
        perplexity_search_topic:
          workflowContext.perplexity_search_topic || 'latest AI developments',
      };

      // Create contextual prompt enhancement
      dependencyContext.context_summary = contextSummary.join('\n');
      dependencyContext.step_chain = Array.from(stepResults.keys()).join(' → ');

      // Set default model configuration if not provided
      const executionOptions: StepExecutionOptions = {
        modelConfig: {
          model: '@kimi',
          temperature: 0.7,
          maxTokens: 2000,
          ...options?.modelConfig,
        },
        prompt: options?.prompt,
        contextData: {
          ...workflowContext,
          ...dependencyContext,
          ...options?.contextData,
          // Pass previous step results as context
          previousSteps: Array.from(stepResults.entries()).reduce(
            (acc, [key, value]) => {
              acc[key] = value;
              return acc;
            },
            {} as Record<string, any>,
          ),
        },
      };

      // Call API to execute step with enhanced options and context
      const result: StepExecutionResult = await executeWorkflowStepAPI(
        stepId,
        workflowContext,
        executionOptions,
      );

      setStepResult(stepId, result);
      updateStepStatus(stepId, StepNodeStatus.COMPLETED);

      // Update workflow context with step results and dependencies
      if (result.contextUpdates) {
        get().updateWorkflowContext(result.contextUpdates);
      }
    } catch (error) {
      updateStepStatus(stepId, StepNodeStatus.PENDING);
      console.error('Step execution failed:', error);
      throw error;
    }
  },
}));
