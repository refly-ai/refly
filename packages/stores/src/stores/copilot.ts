import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { StepNodeStatus } from '@refly/common-types';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: StepNodeStatus;
  estimatedTime: string;
}

interface CopilotState {
  // state
  isCopilotOpen: boolean;
  mode: 'chat' | 'workflow';
  workflowTitle: string;
  workflowSteps: WorkflowStep[];
  currentStepId: string | null;

  // method
  setIsCopilotOpen: (val: boolean) => void;
  setMode: (mode: 'chat' | 'workflow') => void;
  setWorkflowTitle: (title: string) => void;
  setWorkflowSteps: (steps: WorkflowStep[]) => void;
  setCurrentStepId: (stepId: string | null) => void;
  updateStepStatus: (stepId: string, status: StepNodeStatus) => void;
}

export const useCopilotStore = create<CopilotState>()(
  devtools((set) => ({
    isCopilotOpen: false,
    mode: 'chat',
    workflowTitle: '',
    workflowSteps: [],
    currentStepId: null,

    setIsCopilotOpen: (val: boolean) => set({ isCopilotOpen: val }),
    setMode: (mode: 'chat' | 'workflow') => set({ mode }),
    setWorkflowTitle: (title: string) => set({ workflowTitle: title }),
    setWorkflowSteps: (steps: WorkflowStep[]) => set({ workflowSteps: steps }),
    setCurrentStepId: (stepId: string | null) => set({ currentStepId: stepId }),
    updateStepStatus: (stepId: string, status: StepNodeStatus) =>
      set((state) => ({
        workflowSteps: state.workflowSteps.map((step) =>
          step.id === stepId ? { ...step, status } : step,
        ),
        currentStepId:
          status === StepNodeStatus.RUNNING
            ? stepId
            : state.currentStepId === stepId
              ? null
              : state.currentStepId,
      })),
  })),
);

export const useCopilotStoreShallow = <T>(selector: (state: CopilotState) => T) => {
  return useCopilotStore(useShallow(selector));
};
