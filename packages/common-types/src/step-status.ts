export enum StepNodeStatus {
  PENDING = 'pending', // 未开始 - 空圆框
  RUNNING = 'running', // 运行中 - 绿色箭头
  COMPLETED = 'completed', // 完成 - 绿色勾
}

export interface StepNodeState {
  id: string;
  title: string;
  description: string;
  status: StepNodeStatus;
  order: number;
  nodeId: string;
  prompt: string;
  executionTime?: number;
  error?: string;
  estimatedTime?: string;
  dependencies?: string[];
}

export interface CopilotWorkflowStep {
  id: string;
  order: number;
  title: string;
  description: string;
  status: StepNodeStatus;
  nodeId: string;
  prompt: string;
  estimatedTime: string;
  dependencies?: string[];
  model?: string;
}

export interface CopilotWorkflow {
  id: string;
  title: string;
  description: string;
  steps: CopilotWorkflowStep[];
  config?: {
    title: string;
    description: string;
    triggerKeywords: string[];
    variables: Array<{
      name: string;
      type: 'text' | 'email' | 'time';
      description: string;
      required: boolean;
      placeholder: string;
    }>;
  };
}
