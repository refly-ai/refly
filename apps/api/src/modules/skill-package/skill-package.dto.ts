/**
 * DTOs for Skill Package API.
 */

// ===== Skill Package DTOs =====

export interface CreateSkillPackageDto {
  name: string;
  version: string;
  description?: string;
  icon?: SkillIconDto;
  triggers?: string[];
  tags?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface CreateSkillPackageCliDto extends CreateSkillPackageDto {
  workflowId?: string;
  workflowIds?: string[];
  workflowQuery?: string;
  workflowSpec?: {
    nodes?: Array<Record<string, unknown>>;
    edges?: Array<Record<string, unknown>>;
  };
  workflowName?: string;
  workflowDescription?: string;
  workflowVariables?: Array<Record<string, unknown>>;
  noWorkflow?: boolean;
}

export interface CreateSkillPackageCliResponse {
  skillId: string;
  name: string;
  status: string;
  createdAt: string;
  workflowId?: string;
  workflowIds?: string[];
  workflows?: Array<{
    workflowId: string;
    name?: string;
    description?: string;
  }>;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  /** Auto-created installation ID (creator is auto-installed) */
  installationId?: string;
}

export interface UpdateSkillPackageDto {
  name?: string;
  version?: string;
  description?: string;
  icon?: SkillIconDto;
  triggers?: string[];
  tags?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  isPublic?: boolean;
}

export interface SkillIconDto {
  type: 'emoji' | 'url' | 'icon';
  value: string;
}

export interface SkillPackageFilterDto {
  status?: 'draft' | 'published' | 'deprecated';
  mine?: boolean;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

export interface SearchSkillsDto {
  query: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

// ===== Workflow DTOs =====

export interface AddWorkflowDto {
  canvasId: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  isEntry?: boolean;
}

export interface UpdateDependenciesDto {
  dependencies: WorkflowDependencyDto[];
}

export interface WorkflowDependencyDto {
  dependencyWorkflowId: string;
  dependencyType: 'sequential' | 'conditional';
  condition?: string;
  inputMapping?: Record<string, unknown>;
  outputSelector?: OutputSelectorDto;
  mergeStrategy?: 'merge' | 'override' | 'custom';
  customMerge?: string;
}

export interface OutputSelectorDto {
  path?: string;
  template?: string;
}

// ===== Installation DTOs =====

export interface DownloadSkillDto {
  skillId: string;
  shareId?: string;
}

export interface InstallSkillDto {
  skillId: string;
  shareId?: string;
  force?: boolean; // Force reinstall if already installed
}

export interface InstallationFilterDto {
  status?: 'downloading' | 'downloaded' | 'initializing' | 'ready' | 'partial_failed' | 'failed';
  page?: number;
  pageSize?: number;
}

export interface UninstallOptionsDto {
  deleteWorkflows?: boolean;
}

export interface UpdateInstallationDto {
  name?: string;
  description?: string;
  workflowId?: string;
  triggers?: string[];
  tags?: string[];
  version?: string;
}

// ===== Execution DTOs =====

export interface RunSkillDto {
  input?: Record<string, unknown>;
  workflowId?: string; // skillWorkflowId to run specific workflow
  async?: boolean;
}

// ===== Response Types =====

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SkillPackageResponse {
  skillId: string;
  name: string;
  version: string;
  description?: string;
  uid: string;
  icon?: SkillIconDto;
  triggers: string[];
  tags: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  status: string;
  isPublic: boolean;
  coverStorageKey?: string;
  downloadCount: number;
  shareId?: string;
  createdAt: string;
  updatedAt: string;
  workflows?: SkillWorkflowResponse[];
  workflowId?: string; // Primary workflow ID for CLI usage
  // GitHub Registry fields
  githubPrNumber?: number;
  githubPrUrl?: string;
  githubSubmittedAt?: string;
}

export interface SkillWorkflowResponse {
  skillWorkflowId: string;
  skillId: string;
  name: string;
  description?: string;
  sourceCanvasId?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  isEntry: boolean;
  dependencies?: WorkflowDependencyResponse[];
}

export interface WorkflowDependencyResponse {
  dependencyWorkflowId: string;
  dependencyType: string;
  condition?: string;
  inputMapping?: Record<string, unknown>;
  outputSelector?: OutputSelectorDto;
  mergeStrategy?: string;
  customMerge?: string;
}

export interface SkillInstallationResponse {
  installationId: string;
  skillId: string;
  uid: string;
  status: string;
  workflowMapping?: WorkflowMappingRecord;
  userConfig?: Record<string, unknown>;
  errorMessage?: string;
  installedVersion: string;
  hasUpdate: boolean;
  availableVersion?: string;
  createdAt: string;
  updatedAt: string;
  skillPackage?: SkillPackageResponse;
}

export interface WorkflowMappingRecord {
  [skillWorkflowId: string]: {
    workflowId: string | null;
    status: 'pending' | 'ready' | 'failed';
    error?: string;
  };
}

export interface SkillExecutionResult {
  executionId: string;
  installationId: string;
  status: 'running' | 'completed' | 'failed';
  workflowExecutions: WorkflowExecutionInfo[];
  result?: Record<string, unknown>;
  error?: string;
}

export interface WorkflowExecutionInfo {
  skillWorkflowId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

// ===== Publish DTOs =====

export interface PublishSkillDto {
  skillContent: string;
}

export interface ReflySkillMeta {
  name: string;
  displayName?: string;
  description: string;
  skillId: string;
  workflowId: string;
  installationId?: string;
  triggers?: string[];
  tags?: string[];
  version?: string;
}
