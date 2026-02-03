/**
 * refly workflow variables - Manage workflow variable values
 *
 * Provides commands to list and set variable values for workflows.
 * Values are stored in the backend via canvas API.
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import {
  apiRequest,
  apiGetWorkflowVariables,
  apiUpdateWorkflowVariables,
  type WorkflowVariable,
} from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { getFileCategoryByMimeType } from '../../utils/file-type.js';

/**
 * File metadata returned from drive API
 */
interface FileMetadata {
  fileId: string;
  name: string;
  type: string;
  size?: number;
  storageKey?: string;
}

/**
 * Fetch file metadata from drive API
 */
async function getFileMetadata(fileId: string): Promise<FileMetadata | null> {
  try {
    return await apiRequest<FileMetadata>(`/v1/cli/drive/files/${fileId}?includeContent=false`);
  } catch {
    return null;
  }
}

/**
 * Parse --var key=value arguments into an object
 */
function parseVarArgs(varArgs: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const arg of varArgs) {
    const eqIndex = arg.indexOf('=');
    if (eqIndex === -1) {
      throw new CLIError(
        ErrorCodes.INVALID_INPUT,
        `Invalid --var format: "${arg}"`,
        undefined,
        'Use format: --var key=value',
      );
    }
    const key = arg.slice(0, eqIndex);
    const value = arg.slice(eqIndex + 1);
    result[key] = value;
  }

  return result;
}

/**
 * Format variable for display
 */
function formatVariable(v: WorkflowVariable): {
  name: string;
  variableId?: string;
  type: string;
  required: boolean;
  hasValue: boolean;
  value?: unknown;
  description?: string;
} {
  const hasValue = Array.isArray(v.value) && v.value.length > 0;

  return {
    name: v.name,
    variableId: v.variableId,
    type: v.variableType || 'string',
    required: v.required ?? false,
    hasValue,
    value: hasValue ? v.value : undefined,
    description: v.description,
  };
}

/**
 * List workflow variables with current values
 */
const variablesListCommand = new Command('list')
  .description('List workflow variables with current values')
  .argument('<workflowId>', 'Workflow ID (canvas ID)')
  .action(async (workflowId: string) => {
    try {
      const variables = await apiGetWorkflowVariables(workflowId);
      const formatted = variables.map(formatVariable);

      ok('workflow.variables.list', {
        workflowId,
        variables: formatted,
        count: variables.length,
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, {
          details: error.details,
          hint: error.hint,
          suggestedFix: error.suggestedFix,
        });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to list variables',
      );
    }
  });

/**
 * Get a single workflow variable by name
 */
const variablesGetCommand = new Command('get')
  .description('Get a single workflow variable by name')
  .argument('<workflowId>', 'Workflow ID (canvas ID)')
  .argument('<varName>', 'Variable name to get')
  .action(async (workflowId: string, varName: string) => {
    try {
      const variables = await apiGetWorkflowVariables(workflowId);
      const variable = variables.find((v) => v.name === varName || v.variableId === varName);

      if (!variable) {
        const availableNames = variables.map((v) => v.name).join(', ');
        fail(ErrorCodes.NOT_FOUND, `Variable not found: ${varName}`, {
          hint: `Available variables: ${availableNames}`,
        });
        return;
      }

      ok('workflow.variables.get', {
        workflowId,
        variable: formatVariable(variable),
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, {
          details: error.details,
          hint: error.hint,
          suggestedFix: error.suggestedFix,
        });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get variable',
      );
    }
  });

/**
 * Set/bind variable values
 */
const variablesSetCommand = new Command('set')
  .description('Set variable values for a workflow')
  .argument('<workflowId>', 'Workflow ID (canvas ID)')
  .option('--var <key=value...>', 'Variable value in key=value format (can be repeated)')
  .option('--input <json>', 'Variable values as JSON object')
  .option('--clear <name>', 'Clear value for a specific variable')
  .action(
    async (workflowId: string, options: { var?: string[]; input?: string; clear?: string }) => {
      try {
        // Get current variables
        const currentVars = await apiGetWorkflowVariables(workflowId);

        // Parse new values from --var and --input
        let newValues: Record<string, unknown> = {};

        // Parse --input first (lower priority)
        if (options.input) {
          try {
            const parsed = JSON.parse(options.input);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
              fail(ErrorCodes.INVALID_INPUT, 'Input must be a JSON object', {
                hint: 'Use format: \'{"varName": "value"}\'',
                suggestedFix: {
                  field: '--input',
                  format: 'json-object',
                  example: '{"varName": "value"}',
                },
              });
            }
            newValues = { ...parsed };
          } catch {
            fail(ErrorCodes.INVALID_INPUT, 'Invalid JSON in --input', {
              hint: 'Ensure the input is valid JSON',
              suggestedFix: {
                field: '--input',
                format: 'json-object',
                example: '{"varName": "value"}',
              },
            });
          }
        }

        // Parse --var (higher priority, overrides --input)
        if (options.var && options.var.length > 0) {
          const varBindings = parseVarArgs(options.var);
          newValues = { ...newValues, ...varBindings };
        }

        // Handle --clear
        if (options.clear) {
          newValues[options.clear] = null; // Mark for clearing
        }

        // Validate we have something to set
        if (Object.keys(newValues).length === 0) {
          fail(ErrorCodes.INVALID_INPUT, 'No variables specified', {
            hint: 'Use --var key=value, --input \'{"key": "value"}\', or --clear <name>',
          });
        }

        // Build updated variables array
        // First, fetch metadata for any file IDs
        const fileIds = Object.values(newValues).filter(
          (v): v is string => typeof v === 'string' && v.startsWith('df-'),
        );
        const fileMetadataMap = new Map<string, FileMetadata>();
        for (const fileId of fileIds) {
          const metadata = await getFileMetadata(fileId);
          if (metadata) {
            fileMetadataMap.set(fileId, metadata);
          }
        }

        const updatedVars: WorkflowVariable[] = currentVars.map((v) => {
          const name = v.name;
          if (name in newValues) {
            const newValue = newValues[name];

            // Handle clearing
            if (newValue === null) {
              return { ...v, value: [] };
            }

            // Handle string value -> convert to text format
            if (typeof newValue === 'string') {
              // Check if it looks like a fileId
              if (newValue.startsWith('df-')) {
                const metadata = fileMetadataMap.get(newValue);
                return {
                  ...v,
                  value: [
                    {
                      type: 'resource',
                      resource: {
                        fileId: newValue,
                        name: metadata?.name || '',
                        fileType: metadata ? getFileCategoryByMimeType(metadata.type) : 'document',
                        storageKey: metadata?.storageKey || '',
                      },
                    },
                  ],
                };
              }
              return {
                ...v,
                value: [{ type: 'text', text: newValue }],
              };
            }

            // Handle array value (pass through)
            if (Array.isArray(newValue)) {
              return { ...v, value: newValue };
            }

            return v;
          }
          return v;
        });

        // Check for unknown variables
        const definedNames = new Set(currentVars.map((v) => v.name));
        const unknownVars = Object.keys(newValues).filter((k) => !definedNames.has(k));
        if (unknownVars.length > 0) {
          fail(ErrorCodes.INVALID_INPUT, `Unknown variables: ${unknownVars.join(', ')}`, {
            hint: `Available variables: ${Array.from(definedNames).join(', ')}`,
          });
        }

        // Update via API
        const result = await apiUpdateWorkflowVariables(workflowId, updatedVars);

        ok('workflow.variables.set', {
          workflowId,
          updated: Object.keys(newValues),
          variables: result.map(formatVariable),
        });
      } catch (error) {
        if (error instanceof CLIError) {
          fail(error.code, error.message, {
            details: error.details,
            hint: error.hint,
            suggestedFix: error.suggestedFix,
          });
        }
        fail(
          ErrorCodes.INTERNAL_ERROR,
          error instanceof Error ? error.message : 'Failed to set variables',
        );
      }
    },
  );

/**
 * Workflow variables command group
 */
export const workflowVariablesCommand = new Command('variables')
  .description('Manage workflow variable values')
  .addCommand(variablesListCommand)
  .addCommand(variablesGetCommand)
  .addCommand(variablesSetCommand);
