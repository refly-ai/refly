/**
 * Progress plan types for dynamic stage planning and execution tracking
 */

import { GenericToolset } from '@refly/openapi-schema';
import { CanvasContentItem } from '../canvas/canvas.dto';

export interface ProgressSubtask {
  id: string;
  name: string;
  query: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  resultId?: string;
  createdAt?: string;
  completedAt?: string;
  errorMessage?: string;
  context?: string;
  scope?: string;
  outputRequirements?: string;
}

export interface ProgressStage {
  id: string;
  name: string;
  description: string;
  objectives: string[];
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  subtasks: ProgressSubtask[];
  toolCategories: string[]; // Recommended tool categories for this stage
  priority: number; // Stage priority (1 = highest)
  stageProgress?: number; // Stage progress percentage (0-100)
  summary?: string; // Summary of the stage
}

export interface ProgressPlan {
  stages: ProgressStage[];
  currentStageIndex: number;
  overallProgress: number; // 0-100 percentage
  lastUpdated: string;
  planningLogic: string; // Description of how stages were planned
  userIntent: string; // Analyzed user intent
  estimatedTotalEpochs: number; // Estimated epochs needed based on plan
}

export interface ProgressPlanWithSubtasks extends ProgressPlan {
  currentStageSubtasks: ProgressSubtask[];
  planningContext: {
    isInitialPlan: boolean;
    previousExecutionSummary?: string;
    userIntent: string;
    currentStageIndex: number;
  };
}

export interface IntentAnalysisResult {
  userIntent: string;
  taskComplexity: 'simple' | 'medium' | 'complex';
  requiredStages: Array<{
    name: string;
    description: string;
    objectives: string[];
    toolCategories: string[];
    priority: number;
    estimatedEpochs: number;
  }>;
  planningLogic: string;
  estimatedTotalEpochs: number;
}

export interface StageExecutionContext {
  userQuestion: string;
  currentStage: ProgressStage;
  completedStages: ProgressStage[];
  pendingStages: ProgressStage[];
  availableTools: GenericToolset[]; // Tool information for stage execution
  canvasContent: CanvasContentItem[]; // Canvas content for context
}

// Extended PilotSession type with progress field
export interface PilotSessionWithProgress {
  pk: bigint;
  sessionId: string;
  uid: string;
  currentEpoch: number;
  maxEpoch: number;
  title: string;
  input: string;
  progress?: string; // JSON string of ProgressPlan
  modelName?: string;
  targetType?: string;
  targetId?: string;
  providerItemId?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// Extended PilotStep type with mode field
export interface PilotStepWithMode {
  stepId: string;
  name: string;
  epoch: number;
  entityId?: string;
  entityType?: string;
  status: string;
  rawOutput?: string;
  mode?: string; // 'subtask' | 'summary'
  createdAt?: Date;
  updatedAt?: Date;
}

// Extended ActionResult type with output field
export interface ActionResultWithOutput {
  resultId: string;
  title: string;
  input: string;
  output?: string;
  errors?: string;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}
