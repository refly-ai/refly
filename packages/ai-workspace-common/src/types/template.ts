/**
 * Template Library Types
 * 定义工作流模板的数据结构
 */

export interface TemplateStep {
  order: number;
  title: string;
  description: string;
  estimatedTime?: string;
  dependencies?: string[];
  tools?: string[];
  prompt?: string;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'email' | 'time' | 'url' | 'number' | 'boolean' | 'option';
  description: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: string[]; // For option type
}

export interface TemplateProvider {
  name: string;
  icon?: string;
  url?: string;
  description?: string;
}

export interface WorkflowTemplate {
  id: string;
  title: string;
  description: string;
  categories: string[];

  // 工作流步骤
  steps: TemplateStep[];

  // 所需变量
  variables: TemplateVariable[];

  // 涉及的服务和工具
  providers: TemplateProvider[];

  // 元数据
  metadata: {
    estimatedDuration: string;
    complexity: 'beginner' | 'intermediate' | 'advanced';
    popularity: number;
    tags: string[];
    sourceUrl?: string;
    createdAt: string;
    updatedAt: string;
  };

  // 触发关键词
  triggerKeywords: string[];
}

export interface TemplateLibrary {
  version: string;
  lastUpdated: string;
  totalTemplates: number;
  templates: WorkflowTemplate[];
  categories: string[];
}

// 模板搜索和过滤选项
export interface TemplateSearchOptions {
  query?: string;
  categories?: string[];
  providers?: string[];
  complexity?: string[];
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface TemplateSearchResult {
  templates: WorkflowTemplate[];
  total: number;
  hasMore: boolean;
}

// 模板触发检测
export interface TemplateTriggerResult {
  triggered: boolean;
  template: WorkflowTemplate | null;
  confidence: number;
  matchedKeywords: string[];
}
