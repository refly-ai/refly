import React, { useEffect } from 'react';
import { WorkflowStepsPanel } from './WorkflowStepsPanel';
import { useWorkflowStepStore } from '@refly/stores';
import { useCopilotStoreShallow } from '@refly/stores';
import { DAILY_AI_NEWS_WORKFLOW_STEPS } from '@refly/ai-workspace-common';
import { StepNodeStatus, CopilotWorkflowStep } from '@refly/common-types';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genNodeEntityId } from '@refly/utils/id';

interface CopilotPanelProps {
  canvasId?: string;
  className?: string;
}

// Mock chat interface component
const ChatInterface: React.FC = () => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4">
        <div className="text-center text-gray-500">Chat with AI Assistant</div>
      </div>
      <div className="p-4 border-t">
        <input
          type="text"
          placeholder="Type your message..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

export const CopilotPanel: React.FC<CopilotPanelProps> = ({ canvasId, className = '' }) => {
  const { mode, workflowTitle, setMode, setWorkflowTitle } = useCopilotStoreShallow((state) => ({
    mode: state.mode,
    workflowTitle: state.workflowTitle,
    setMode: state.setMode,
    setWorkflowTitle: state.setWorkflowTitle,
  }));

  const { stepStates, selectedStepId, selectStep, executeStep, updateStepStatus, setWorkflowMode } =
    useWorkflowStepStore();

  // Hook for adding nodes to canvas
  const { addNode } = useAddNode();

  // Check if current canvas is a template canvas
  useEffect(() => {
    const isTemplateCanvas = checkIfTemplateCanvas(canvasId);
    if (isTemplateCanvas) {
      setMode('workflow');
      setWorkflowMode(true);
      setWorkflowTitle('Daily AI News Digest');
      initializeWorkflowSteps();
    } else {
      setMode('chat');
      setWorkflowMode(false);
    }
  }, [canvasId, setMode, setWorkflowMode, setWorkflowTitle]);

  // Initialize workflow steps
  const initializeWorkflowSteps = () => {
    for (const step of DAILY_AI_NEWS_WORKFLOW_STEPS) {
      if (!stepStates.has(step.nodeId)) {
        updateStepStatus(step.nodeId, StepNodeStatus.PENDING);
      }
    }
  };

  const handleStepClick = (step: CopilotWorkflowStep) => {
    selectStep(step.id);
  };

  const handleExecuteStep = async (stepId: string) => {
    try {
      // Find the step being executed
      const step = DAILY_AI_NEWS_WORKFLOW_STEPS.find((s: CopilotWorkflowStep) => s.id === stepId);
      if (!step) {
        console.error('Step not found:', stepId);
        return;
      }

      // Generate a unique entity ID for the skill response node
      const entityId = genNodeEntityId('skillResponse');

      // Build context items based on step dependencies (for individual step execution)
      const contextItems =
        step.dependencies
          ?.map((depId: string) => {
            const dependentStep = DAILY_AI_NEWS_WORKFLOW_STEPS.find((s) => s.id === depId);
            if (dependentStep) {
              // For individual step execution, we create a reference to the dependent step
              return {
                type: 'skillResponse' as const,
                title: dependentStep.title,
                entityId: `placeholder-${depId}`, // In real implementation, this would be the actual entity ID
                metadata: {
                  withHistory: true,
                  stepId: depId,
                  workflowContext: true,
                  placeholder: true, // Indicates this is a reference to an expected dependency
                },
              };
            }
            return null;
          })
          .filter(Boolean) || [];

      // Create skill response node on canvas before executing the step
      const nodePosition = addNode({
        type: 'skillResponse',
        data: {
          title: step.title,
          entityId: entityId,
          contentPreview: '', // Will be populated when execution completes
          metadata: {
            status: 'waiting',
            selectedSkill: {
              name: 'commonQnA',
              icon: {},
            },
            query: step.prompt,
            modelInfo: {
              name: '@kimi',
              label: '@kimi',
              provider: 'moonshot',
            },
            contextItems: contextItems,
            stepId: step.id,
            stepNodeId: step.nodeId,
            workflowStep: true,
            dependencies: step.dependencies || [],
          },
          createdAt: new Date().toISOString(),
        },
        position: {
          x: 100 + (step.order || 0) * 350,
          y: 100 + (step.order || 0) * 150,
        },
      });

      // Update step status to running
      updateStepStatus(step.nodeId, StepNodeStatus.RUNNING);

      // Execute the step
      await executeStep(stepId);

      console.log(
        `Created skill response node for step "${step.title}" with ${contextItems.length} context references at position:`,
        nodePosition,
      );
    } catch (error) {
      console.error('Failed to execute step:', error);
    }
  };

  const handleStartWorkflow = async () => {
    try {
      console.log('Starting Daily AI News Workflow - creating all nodes...');

      // Create a map to store created nodes for dependency linking
      const createdNodes: Map<string, { entityId: string; stepId: string }> = new Map();

      // Create all workflow nodes on the canvas
      DAILY_AI_NEWS_WORKFLOW_STEPS.forEach((step: CopilotWorkflowStep, index: number) => {
        // Generate a unique entity ID for each skill response node
        const entityId = genNodeEntityId('skillResponse');

        // Store the node reference for dependency linking
        createdNodes.set(step.id, { entityId, stepId: step.id });

        // Build context items based on step dependencies
        const contextItems =
          step.dependencies
            ?.map((depId: string) => {
              const dependentNode = createdNodes.get(depId);
              if (dependentNode) {
                const dependentStep = DAILY_AI_NEWS_WORKFLOW_STEPS.find((s) => s.id === depId);
                return {
                  type: 'skillResponse' as const,
                  title: dependentStep?.title || `Step ${depId}`,
                  entityId: dependentNode.entityId,
                  metadata: {
                    withHistory: true,
                    stepId: depId,
                    workflowContext: true,
                  },
                };
              }
              return null;
            })
            .filter(Boolean) || [];

        // Calculate position in a linear flow layout
        const x = 100 + index * 350;
        const y = 100 + Math.floor(index / 4) * 250; // Arrange in rows of 4

        // Create connection filters for dependency linking
        const connectTo =
          step.dependencies
            ?.map((depId: string) => {
              const dependentNode = createdNodes.get(depId);
              if (dependentNode) {
                return {
                  type: 'skillResponse' as const,
                  entityId: dependentNode.entityId,
                };
              }
              return null;
            })
            .filter(Boolean) || [];

        // Create skill response node for each workflow step
        addNode(
          {
            type: 'skillResponse',
            data: {
              title: step.title,
              entityId: entityId,
              contentPreview: '', // Will be populated when step is executed
              metadata: {
                status: 'waiting',
                selectedSkill: {
                  name: 'commonQnA',
                  icon: {},
                },
                query: step.prompt,
                modelInfo: {
                  name: '@kimi',
                  label: '@kimi',
                  provider: 'moonshot',
                },
                contextItems: contextItems,
                stepId: step.id,
                stepNodeId: step.nodeId,
                workflowStep: true,
                workflowOrder: step.order,
                dependencies: step.dependencies || [],
              },
              createdAt: new Date().toISOString(),
            },
            position: {
              x: x,
              y: y,
            },
          },
          connectTo,
        );

        console.log(
          `Created node for step ${index + 1}: "${step.title}" with ${contextItems.length} context items and ${connectTo.length} connections`,
        );
      });

      console.log(
        `Successfully created ${DAILY_AI_NEWS_WORKFLOW_STEPS.length} workflow nodes on canvas with proper context linking`,
      );
    } catch (error) {
      console.error('Failed to start workflow:', error);
    }
  };

  return (
    <div
      className={`copilot-panel h-full flex flex-col bg-white border border-gray-200 rounded-lg ${className}`}
    >
      {/* Mode switching tabs */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'chat'
              ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setMode('chat')}
        >
          Chat Mode
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'workflow'
              ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setMode('workflow')}
        >
          Workflow Mode
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {mode === 'chat' ? (
          <ChatInterface />
        ) : (
          <div className="h-full flex flex-col">
            {/* Start Workflow Button */}
            <div className="flex-shrink-0 p-4 border-b border-gray-100">
              <button
                type="button"
                onClick={handleStartWorkflow}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10V7a3 3 0 11-6 0V4a3 3 0 016 0v3zm-3 7a3 3 0 100-6 3 3 0 000 6z"
                  />
                </svg>
                Start Daily AI News Workflow
              </button>
            </div>

            {/* Workflow steps panel */}
            <div className="flex-1 overflow-hidden">
              <WorkflowStepsPanel
                steps={DAILY_AI_NEWS_WORKFLOW_STEPS.map((step: CopilotWorkflowStep) => ({
                  ...step,
                  status: stepStates.get(step.nodeId) || StepNodeStatus.PENDING,
                }))}
                currentStepId={selectedStepId}
                onStepClick={handleStepClick}
                onExecuteStep={handleExecuteStep}
                workflowTitle={workflowTitle}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      {mode === 'workflow' && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Mode: Workflow Template</span>
            <span>
              {
                Array.from(stepStates.values()).filter(
                  (status) => status === StepNodeStatus.COMPLETED,
                ).length
              }{' '}
              / {DAILY_AI_NEWS_WORKFLOW_STEPS.length} steps completed
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to check if canvas is a template
const checkIfTemplateCanvas = (canvasId?: string): boolean => {
  if (!canvasId) return false;

  // Check if canvas contains template indicators
  // This could be based on canvas metadata, URL patterns, or specific node types
  return (
    canvasId.includes('template') ||
    canvasId.includes('ai-news-digest') ||
    canvasId.includes('workflow')
  );
};

export default CopilotPanel;
