import { WorkflowVariable } from '@refly/openapi-schema';
import { CanvasContentItem } from '../canvas/canvas.dto';
// Re-export WorkflowVariable type from openapi-schema
export { WorkflowVariable } from '@refly/openapi-schema';

export interface HistoricalData {
  extractionHistory: ExtractionHistoryRecord[];
  canvasPatterns: string[];
}

// Variable extraction options
export interface VariableExtractionOptions {
  mode?: 'direct' | 'candidate';
  sessionId?: string;
  triggerType?: string;
}

// Save history record options
export interface SaveHistoryOptions {
  mode: string;
  model?: string;
  triggerType?: string;
}

// Save candidate record options
export interface SaveCandidateOptions {
  modelName?: string;
  triggerType?: string;
}

// Core return type
export interface VariableExtractionResult {
  originalPrompt: string; // Original user input
  processedPrompt: string; // Processed prompt (with variable references)
  variables: WorkflowVariable[]; // Extracted variable list
  reusedVariables: VariableReuse[]; // Reused variable information
  sessionId?: string; // Session ID in candidate mode
  extractionConfidence?: number; // Extraction confidence
}

// Variable reuse information
export interface VariableReuse {
  detectedText: string; // Text expression detected in original text
  reusedVariableName: string; // Reused variable name
  confidence: number; // Confidence level
  reason: string; // Reuse reason
}

// APP template generation result
export interface AppTemplateResult {
  templateContent: string; // Template with placeholders
  variables: WorkflowVariable[]; // Related variable list
  metadata: {
    extractedAt: number; // Template generation timestamp (for version control)
    variableCount: number; // Total variable count (for frontend statistics display)
    promptCount?: number; // Original prompt count (for quality assessment)
    canvasComplexity?: string; // Canvas complexity (simple/medium/complex, affects template display)
    workflowType?: string; // Workflow type (for template classification and display)
    templateVersion?: number; // Template version number (supports template iteration)
    workflowTitle?: string; // Workflow title for display
    workflowDescription?: string; // Workflow description
    estimatedExecutionTime?: string; // Estimated execution time
    skillTags?: string[]; // Skill tags for categorization
    skillResponses?: CanvasNode[];
  };
}

// Context data structure definition
export interface ExtractionContext {
  canvasData: CanvasData;
  variables: WorkflowVariable[];
  contentItems: CanvasContentItem[];
  skillResponses: CanvasNode[];
  analysis: CanvasAnalysis;
  extractionContext: ExtractionContextMetadata;
}

// Canvas data structure
export interface CanvasData {
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
  workflow?: WorkflowData;
  title?: string; // Canvas title
  description?: string; // Canvas description
}

// Canvas node
export interface CanvasNode {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
}

// Canvas edge
export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
}

// Workflow data
export interface WorkflowData {
  variables?: WorkflowVariable[];
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
}

// Use Canvas service's CanvasContentItem type
export { CanvasContentItem } from '../canvas/canvas.dto';

// Canvas analysis result
export interface CanvasAnalysis {
  complexity: number; // Complexity score 0-100
  nodeCount: number; // Node count
  variableCount: number; // Variable count
  resourceCount: number; // Resource count
  workflowType?: string; // Workflow type
  primarySkills?: string[]; // Primary skills
}

// Canvas context information - for prompt construction
export interface CanvasContext {
  nodeCount: number; // Canvas node count
  complexity: number; // Complexity score 0-100
  resourceCount: number; // Resource count
  workflowType?: string; // Workflow type
  primarySkills?: string[]; // Primary skills
  lastExtractionTime?: Date; // Last extraction time
  recentVariablePatterns?: string[]; // Recent variable patterns
}

// Extraction context metadata
export interface ExtractionContextMetadata {
  lastExtractionTime?: Date; // Last extraction time
  recentVariablePatterns: string[]; // Recent variable patterns
}

// User workflow preferences
export interface UserWorkflowPreferences {
  preferredVariableTypes?: string[];
  commonWorkflowPatterns?: string[];
  extractionHistory?: ExtractionHistoryItem[];
}

// Extraction history item
export interface ExtractionHistoryItem {
  timestamp: Date;
  prompt: string;
  extractedVariables: string[];
  confidence: number;
}

// Candidate record type
export interface CandidateRecord {
  sessionId: string;
  canvasId: string;
  uid: string;
  originalPrompt: string;
  extractedVariables: WorkflowVariable[];
  reusedVariables: VariableReuse[];
  applied: boolean;
  createdAt: Date;
}

// LLM extraction response type
export interface LLMExtractionResponse {
  variables: ExtractedVariable[];
  processedPrompt: string;
  confidence: number;
  reasoning?: string;
}

// Extracted variable
export interface ExtractedVariable {
  name: string;
  value: string;
  description?: string;
  variableType: 'string' | 'option' | 'resource';
  confidence: number;
  source: 'llm_extraction' | 'variable_reuse' | 'context_analysis';
}

// Quality assessment result
export interface QualityMetrics {
  overallScore: number; // Overall score 0-100
  variableCompleteness: number; // Variable completeness
  promptClarity: number; // Prompt clarity
  contextRelevance: number; // Context relevance
  suggestions: string[]; // Improvement suggestions
}

// Historical data interface
export interface HistoricalData {
  extractionHistory: ExtractionHistoryRecord[];
  canvasPatterns: string[];
}

// Extraction history record
export interface ExtractionHistoryRecord {
  extractedVariables: string;
  status: string;
  createdAt: Date;
}

// Content item type
export interface CanvasContentItemWithType {
  id: string;
  type: string;
  title: string;
  content?: string;
}

// Prompt example interface for testing and reference
export interface PromptExample {
  id: string;
  scenario: string;
  complexity: 'Simple' | 'Complex';
  originalPrompt: string;
  extractedVariables: {
    name: string;
    value: string;
    description: string;
    variableType: 'string' | 'option' | 'resource';
  }[];
  processedPrompt: string;
}
