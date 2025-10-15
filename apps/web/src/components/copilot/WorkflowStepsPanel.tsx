import React from 'react';
import { StepStatusIndicator } from '@refly/ai-workspace-common';
import type { CopilotWorkflowStep } from '@refly/common-types';
import { StepNodeStatus } from '@refly/common-types';

interface WorkflowStepsPanelProps {
  steps: CopilotWorkflowStep[];
  currentStepId?: string;
  onStepClick: (step: CopilotWorkflowStep) => void;
  onExecuteStep: (stepId: string) => void;
  workflowTitle?: string;
}

export const WorkflowStepsPanel: React.FC<WorkflowStepsPanelProps> = ({
  steps,
  currentStepId,
  onStepClick,
  onExecuteStep,
  workflowTitle,
}) => {
  const canExecuteStep = (step: CopilotWorkflowStep): boolean => {
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
        <h3 className="font-semibold text-gray-900">{workflowTitle || 'How It Works'}</h3>
        <p className="text-sm text-gray-600 mt-1">
          Follow these steps to set up your daily AI news digest
        </p>
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
            onClick={() => onStepClick(step)}
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
                        onExecuteStep(step.id);
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
                    <div className="text-gray-600">{step.prompt}</div>
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
