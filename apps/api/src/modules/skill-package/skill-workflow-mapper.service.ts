/**
 * Skill Workflow Mapper Service - handles data mapping between workflows.
 */

import { Injectable, Logger } from '@nestjs/common';
import { safeParseJSON } from '@refly/utils';

export type MergeStrategy = 'merge' | 'override' | 'custom';

export interface InputMapping {
  [targetKey: string]: string; // JSONPath or dot-notation path from source
}

export interface OutputSelector {
  path: string; // JSONPath or dot-notation path to extract
  default?: unknown; // Default value if path not found
}

@Injectable()
export class SkillWorkflowMapperService {
  private readonly logger = new Logger(SkillWorkflowMapperService.name);

  /**
   * Apply output selector to extract specific data from workflow output.
   */
  applyOutputSelector(
    output: Record<string, unknown>,
    selector?: OutputSelector | string,
  ): unknown {
    if (!selector) {
      return output;
    }

    const selectorConfig: OutputSelector =
      typeof selector === 'string' ? (safeParseJSON(selector) ?? { path: '' }) : selector;

    if (!selectorConfig.path) {
      return output;
    }

    try {
      const result = this.getValueByPath(output, selectorConfig.path);
      return result !== undefined ? result : selectorConfig.default;
    } catch (_error) {
      this.logger.warn(`Output selector failed for path: ${selectorConfig.path}`);
      return selectorConfig.default;
    }
  }

  /**
   * Apply input mapping to transform data for dependent workflow.
   */
  applyInputMapping(
    sourceData: Record<string, unknown>,
    mapping?: InputMapping | string,
  ): Record<string, unknown> {
    if (!mapping) {
      return sourceData;
    }

    const mappingConfig: InputMapping =
      typeof mapping === 'string' ? (safeParseJSON(mapping) ?? {}) : mapping;

    const result: Record<string, unknown> = {};

    for (const [targetKey, sourcePath] of Object.entries(mappingConfig)) {
      try {
        const value = this.getValueByPath(sourceData, sourcePath);
        if (value !== undefined) {
          this.setValueByPath(result, targetKey, value);
        }
      } catch (_error) {
        this.logger.warn(`Input mapping failed for ${sourcePath} -> ${targetKey}`);
      }
    }

    return result;
  }

  /**
   * Merge inputs from multiple sources based on strategy.
   */
  mergeInputs(
    baseInput: Record<string, unknown>,
    dependencyOutputs: Array<{ workflowId: string; output: Record<string, unknown> }>,
    strategy: MergeStrategy = 'merge',
  ): Record<string, unknown> {
    switch (strategy) {
      case 'override':
        // Last output completely overrides base
        if (dependencyOutputs.length === 0) {
          return baseInput;
        }
        return { ...dependencyOutputs[dependencyOutputs.length - 1].output };

      case 'merge': {
        // Deep merge all outputs into base
        let merged = { ...baseInput };
        for (const dep of dependencyOutputs) {
          merged = this.deepMerge(merged, dep.output);
        }
        return merged;
      }

      case 'custom':
        // Return structured object with access to all sources
        return {
          _base: baseInput,
          _dependencies: Object.fromEntries(dependencyOutputs.map((d) => [d.workflowId, d.output])),
        };

      default:
        return baseInput;
    }
  }

  /**
   * Process full data mapping for a workflow execution.
   */
  processDataMapping(
    workflowId: string,
    baseInput: Record<string, unknown>,
    dependencyOutputs: Map<string, Record<string, unknown>>,
    dependencyConfigs: Array<{
      dependencyWorkflowId: string;
      outputSelector?: string;
      inputMapping?: string;
      mergeStrategy?: string;
    }>,
  ): Record<string, unknown> {
    const mappedOutputs: Array<{ workflowId: string; output: Record<string, unknown> }> = [];

    for (const config of dependencyConfigs) {
      const rawOutput = dependencyOutputs.get(config.dependencyWorkflowId);
      if (!rawOutput) {
        this.logger.warn(
          `Missing output for dependency ${config.dependencyWorkflowId} of workflow ${workflowId}`,
        );
        continue;
      }

      // Apply output selector
      const selectedOutput = this.applyOutputSelector(rawOutput, config.outputSelector);
      const outputData =
        typeof selectedOutput === 'object' && selectedOutput !== null
          ? (selectedOutput as Record<string, unknown>)
          : { value: selectedOutput };

      // Apply input mapping
      const mappedOutput = this.applyInputMapping(outputData, config.inputMapping);

      mappedOutputs.push({
        workflowId: config.dependencyWorkflowId,
        output: mappedOutput,
      });
    }

    // Determine merge strategy (use first dependency's strategy if not specified)
    const mergeStrategy = (dependencyConfigs[0]?.mergeStrategy as MergeStrategy) || 'merge';

    return this.mergeInputs(baseInput, mappedOutputs, mergeStrategy);
  }

  /**
   * Get value from object by dot-notation path.
   */
  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array index notation: field[0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, indexStr] = arrayMatch;
        const index = Number.parseInt(indexStr, 10);
        current = (current as Record<string, unknown>)[key];
        if (Array.isArray(current)) {
          current = current[index];
        } else {
          return undefined;
        }
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }

    return current;
  }

  /**
   * Set value in object by dot-notation path.
   */
  private setValueByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Deep merge two objects.
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      const targetValue = result[key];
      const sourceValue = source[key];

      if (
        targetValue &&
        sourceValue &&
        typeof targetValue === 'object' &&
        typeof sourceValue === 'object' &&
        !Array.isArray(targetValue) &&
        !Array.isArray(sourceValue)
      ) {
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>,
        );
      } else {
        result[key] = sourceValue;
      }
    }

    return result;
  }
}
