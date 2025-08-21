import { Injectable, Logger } from '@nestjs/common';
import Handlebars from 'handlebars';
import type { WorkflowVariable as WorkflowVariableType } from '@refly/openapi-schema';

export interface WorkflowVariable {
  name: string;
  value: string[] | string;
  description?: string;
}

@Injectable()
export class WorkflowVariableService {
  private readonly logger = new Logger(WorkflowVariableService.name);

  /**
   * Process query with workflow variables using Handlebars
   * @param query - The original query string
   * @param variables - Array of workflow variables
   * @returns Processed query string
   */
  processQuery(query: string, variables: WorkflowVariable[] = []): string {
    if (!query || !variables.length) {
      return query;
    }

    // Convert variables array to object for Handlebars
    const variableMap = variables.reduce(
      (acc, variable) => {
        acc[variable.name] = Array.isArray(variable.value)
          ? variable.value.join(', ')
          : variable.value;
        return acc;
      },
      {} as Record<string, string>,
    );

    try {
      const template = Handlebars.compile(query);
      return template(variableMap);
    } catch (error) {
      // If template processing fails, return original query
      this.logger.warn('Failed to process query template:', error);
      return query;
    }
  }

  /**
   * Enhanced process query with workflow variables
   * - string: as before
   * - resource: return special marker for resource injection
   * - option: use defaultValue array first if value missing
   */
  processQueryWithTypes(
    query: string,
    variables: WorkflowVariableType[] = [],
  ): { query: string; resourceVars: WorkflowVariableType[] } {
    if (!query || !variables.length) {
      return { query, resourceVars: [] };
    }

    let processedQuery = query;
    const resourceVars: WorkflowVariableType[] = [];

    for (const variable of variables) {
      const value = variable.value;

      if (variable.variableType === 'resource') {
        // Mark for resource injection, remove from query
        resourceVars.push({ ...variable, value });
        // Remove {{name}} from query
        processedQuery = processedQuery.replace(new RegExp(`{{\s*${variable.name}\s*}}`, 'g'), '');
      } else {
        // string/option: convert array to string for template processing
        const stringValue = Array.isArray(value) ? value.join(', ') : (value ?? '');
        processedQuery = processedQuery.replace(
          new RegExp(`{{\s*${variable.name}\s*}}`, 'g'),
          stringValue,
        );
      }
    }
    return { query: processedQuery, resourceVars };
  }

  /**
   * Validate workflow variables
   * @param variables - Array of workflow variables
   * @returns Array of validation errors, empty if valid
   */
  validateVariables(variables: WorkflowVariable[]): string[] {
    const errors: string[] = [];
    const nameSet = new Set<string>();

    for (const variable of variables) {
      if (!variable.name) {
        errors.push('Variable name is required');
        continue;
      }

      if (nameSet.has(variable.name)) {
        errors.push(`Duplicate variable name: ${variable.name}`);
      } else {
        nameSet.add(variable.name);
      }

      if (!variable.name.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        errors.push(
          `Invalid variable name: ${variable.name}. Must start with letter or underscore and contain only letters, numbers, and underscores.`,
        );
      }

      if (variable.value === undefined || variable.value === null) {
        errors.push(`Variable value is required for: ${variable.name}`);
      }
    }

    return errors;
  }
}
