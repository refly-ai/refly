import { useMemo } from 'react';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import type { WorkflowVariable } from '@refly/openapi-schema';
import { MentionCommonData } from '@refly/utils/query-processor';

/**
 * Hook to find a variable by its variableId from the workflow variables.
 *
 * @param variableId The ID of the variable to find
 * @returns The found WorkflowVariable or undefined
 */
export const useFindLatestVariableMetions = (variableMentions?: MentionCommonData[]) => {
  const { canvasId, shareData } = useCanvasContext();
  const { data: variables } = useVariablesManagement(canvasId);

  // Get workflow variables from shareData if available (for share page),
  // otherwise fallback to variables from variables management
  const workflowVariables = useMemo(
    () => (shareData?.variables ?? variables) as WorkflowVariable[],
    [shareData?.variables, variables],
  );

  const sourceVariables = useMemo(() => {
    if (!variableMentions || variableMentions.length === 0) return [];
    const latestVariables = workflowVariables.filter((v) => {
      return variableMentions.some((m) => m.id === v.variableId);
    });
    return latestVariables;
  }, [workflowVariables, variableMentions]);

  const latestVariables = useMemo(() => {
    if (!variableMentions || variableMentions.length === 0) return [];
    const latestVariables = variableMentions.map((v) => {
      const variable = workflowVariables.find((variable) => variable.variableId === v.id);
      return variable ? { ...v, name: variable.name } : v;
    });
    return latestVariables;
  }, [workflowVariables, variableMentions]);

  return { latestVariables, sourceVariables };
};
