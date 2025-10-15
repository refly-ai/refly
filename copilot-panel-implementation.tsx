import React, { useEffect } from 'react';
import { WorkflowStepsPanel } from './WorkflowStepsPanel';
import { useWorkflowStepStore } from '@refly/stores';
import { useCopilotStoreShallow } from '@refly/stores';
import { DAILY_AI_NEWS_WORKFLOW_STEPS } from '@refly/ai-workspace-common';
import { StepNodeStatus, CopilotWorkflowStep } from '@refly/common-types';
import { useAddNode } from '@refly/ai-workspace-common/hooks/canvas/use-add-node';
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
            contextItems: [],
            stepId: step.id,
            stepNodeId: step.nodeId,
            workflowStep: true,
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
        `Created skill response node for step "${step.title}" at position:`,
        nodePosition,
      );
    } catch (error) {
      console.error('Failed to execute step:', error);
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
          <div className="h-full">
            {/* Workflow steps panel */}
            <div className="h-full">
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
