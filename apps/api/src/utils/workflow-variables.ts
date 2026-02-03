import type { WorkflowVariable } from '@refly/openapi-schema';

export const mergeVariablesWithCanvas = (
  canvasVariables: WorkflowVariable[] = [],
  runtimeVariables: WorkflowVariable[] = [],
): WorkflowVariable[] => {
  if (!canvasVariables.length) {
    // Filter out unnamed runtime variables before returning
    return runtimeVariables.filter((v) => v?.name);
  }

  const canvasByName = new Map(
    canvasVariables
      .filter((variable) => variable?.name)
      .map((variable) => [variable.name!, variable]),
  );
  const mergedByName = new Map<string, WorkflowVariable>();

  for (const runtimeVar of runtimeVariables) {
    if (!runtimeVar?.name) continue;
    const existing = canvasByName.get(runtimeVar.name);
    if (existing) {
      mergedByName.set(runtimeVar.name, {
        ...existing,
        ...runtimeVar,
        variableId: existing.variableId ?? runtimeVar.variableId,
        variableType: existing.variableType ?? runtimeVar.variableType,
      });
    } else {
      mergedByName.set(runtimeVar.name, runtimeVar);
    }
  }

  for (const existing of canvasVariables) {
    if (!existing?.name) continue;
    if (!mergedByName.has(existing.name)) {
      mergedByName.set(existing.name, existing);
    }
  }

  return Array.from(mergedByName.values());
};
