import React, { useState, useCallback, useMemo } from 'react';
import { StepStatusIndicator } from '@refly-packages/ai-workspace-common/components/step/StepStatusIndicator';
import type { CopilotWorkflow, CopilotWorkflowStep } from '@refly/common-types';
import { StepNodeStatus } from '@refly/common-types';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genNodeEntityId } from '@refly/utils';

interface WorkflowStepsPanelProps {
  workflow: CopilotWorkflow;
  workflowTitle?: string;
}

export const WorkflowStepsPanel: React.FC<WorkflowStepsPanelProps> = ({
  workflow,
  workflowTitle,
}) => {
  const { addNode } = useAddNode();
  const [currentStepId, setCurrentStepId] = useState<string>();

  // Initialize steps with PENDING status
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepNodeStatus>>(() => {
    const statuses: Record<string, StepNodeStatus> = {};
    for (const step of workflow.steps) {
      statuses[step.id] = StepNodeStatus.PENDING;
    }
    return statuses;
  });

  // Create enhanced steps with current status
  const steps = useMemo(() => {
    return workflow.steps.map((step) => ({
      ...step,
      status: stepStatuses[step.id] || StepNodeStatus.PENDING,
    }));
  }, [workflow.steps, stepStatuses]);

  const handleStepClick = useCallback((step: CopilotWorkflowStep) => {
    setCurrentStepId(step.id);
  }, []);

  const handleExecuteStep = useCallback(
    async (stepId: string) => {
      const step = steps.find((s) => s.id === stepId);
      if (!step) return;

      // Update step status to running
      setStepStatuses((prev) => ({
        ...prev,
        [stepId]: StepNodeStatus.RUNNING,
      }));

      try {
        // Generate a unique entity ID for the skill response node
        const entityId = genNodeEntityId('skillResponse');

        // Create skill response node in canvas
        addNode({
          type: 'skillResponse',
          position: { x: step.order * 300, y: 100 },
          data: {
            entityId,
            title: step.title,
            metadata: {
              isWorkflowStep: true,
              workflowStepId: step.id,
              workflowId: workflow.id,
              stepOrder: step.order,
              description: step.description,
              prompt: step.prompt,
              model: step.model || '@kimi',
              contextFrom: step.dependencies?.length ? step.dependencies : undefined,
              estimatedTime: step.estimatedTime,
              stepId: step.id,
            },
          },
        });

        // Simulate completion after a short delay
        setTimeout(() => {
          setStepStatuses((prev) => ({
            ...prev,
            [stepId]: StepNodeStatus.COMPLETED,
          }));
        }, 1000);
      } catch (error) {
        console.error('Failed to execute step:', error);
        setStepStatuses((prev) => ({
          ...prev,
          [stepId]: StepNodeStatus.PENDING,
        }));
      }
    },
    [steps, addNode, workflow.id],
  );

  const handleStartWorkflow = useCallback(async () => {
    // Create all workflow nodes in the canvas
    const positions = [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 700, y: 100 },
      { x: 1000, y: 100 },
      { x: 100, y: 300 },
      { x: 400, y: 300 },
      { x: 700, y: 300 },
      { x: 1000, y: 300 },
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const entityId = genNodeEntityId('skillResponse');

      addNode({
        type: 'skillResponse',
        position: positions[i] || { x: (i % 4) * 300 + 100, y: Math.floor(i / 4) * 200 + 100 },
        data: {
          entityId,
          title: step.title,
          metadata: {
            isWorkflowStep: true,
            workflowStepId: step.id,
            workflowId: workflow.id,
            stepOrder: step.order,
            description: step.description,
            prompt: step.prompt,
            model: step.model || '@kimi',
            contextFrom: step.dependencies?.length ? step.dependencies : undefined,
            estimatedTime: step.estimatedTime,
            stepId: step.id,
          },
        },
      });
    }
  }, [steps, addNode, workflow.id]);

  const canExecuteStep = (step: CopilotWorkflowStep & { status: StepNodeStatus }): boolean => {
    if (!step.dependencies?.length) return true;

    return step.dependencies.every((depId) => {
      const depStep = steps.find((s) => s.id === depId);
      return depStep?.status === StepNodeStatus.COMPLETED;
    });
  };

  const getStatusText = (status: StepNodeStatus): string => {
    switch (status) {
      case StepNodeStatus.COMPLETED:
        return '✓ Completed';
      case StepNodeStatus.RUNNING:
        return '→ Running...';
      case StepNodeStatus.PENDING:
        return 'Ready to run';
      default:
        return 'Ready to run';
    }
  };

  const getStatusTextColor = (status: StepNodeStatus): string => {
    switch (status) {
      case StepNodeStatus.COMPLETED:
        return 'text-green-600';
      case StepNodeStatus.RUNNING:
        return 'text-blue-600';
      case StepNodeStatus.PENDING:
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="workflow-steps-panel bg-white rounded-lg border border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{workflowTitle || 'How It Works'}</h3>
            <p className="text-sm text-gray-600 mt-1">
              Follow these steps to set up your daily AI news digest
            </p>
          </div>
          <button
            type="button"
            onClick={handleStartWorkflow}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            Start Workflow
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`step-item border rounded-lg p-3 cursor-pointer transition-all duration-200 ${
              currentStepId === step.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleStepClick(step)}
          >
            <div className="flex items-start gap-3">
              {/* Step number and status */}
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center text-sm font-medium text-gray-600">
                    {step.order}
                  </div>

                  {/* Status indicator overlay */}
                  <div className="absolute -top-1 -right-1">
                    <StepStatusIndicator status={step.status} size="small" />
                  </div>
                </div>

                {/* Connector line */}
                {index < steps.length - 1 && <div className="w-0.5 h-6 bg-gray-200 mt-2" />}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900 text-sm">{step.title}</h4>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {step.estimatedTime}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mt-1">{step.description}</p>

                {/* Status text */}
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-xs font-medium ${getStatusTextColor(step.status)}`}>
                    {getStatusText(step.status)}
                  </span>

                  {/* Execute button */}
                  {step.status === StepNodeStatus.PENDING && canExecuteStep(step) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExecuteStep(step.id);
                      }}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                    >
                      Run Step
                    </button>
                  )}

                  {step.status === StepNodeStatus.PENDING && !canExecuteStep(step) && (
                    <span className="text-xs text-gray-400">Waiting for dependencies</span>
                  )}
                </div>

                {/* Show prompt preview when selected */}
                {currentStepId === step.id && (
                  <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                    <div className="font-medium text-gray-700 mb-1">Prompt Preview:</div>
                    <div className="text-gray-600 max-h-32 overflow-y-auto">{step.prompt}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div className="p-4 border-t border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Progress</span>
          <span className="font-medium text-gray-900">
            {steps.filter((s) => s.status === StepNodeStatus.COMPLETED).length} / {steps.length}{' '}
            steps
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(steps.filter((s) => s.status === StepNodeStatus.COMPLETED).length / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default WorkflowStepsPanel;
