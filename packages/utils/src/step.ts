import { ActionStep, Artifact, ActionResult } from '@refly/openapi-schema';
import { aggregateTokenUsage } from './models';

const STEP_ORDER = {
  analyzeQuery: 0,
  analyzeContext: 10,
  webSearch: 15,
  librarySearch: 16,
  generateTitle: 20,
  generateDocument: 30,
  generateCodeArtifact: 30,
  answerQuestion: 50,
};

export const sortSteps = (steps: ActionStep[]): ActionStep[] => {
  return steps.sort((a, b) => {
    const aOrder = STEP_ORDER[a.name] ?? 0;
    const bOrder = STEP_ORDER[b.name] ?? 0;

    return aOrder - bOrder;
  });
};

// Merge two step arrays by step.name with sensible field-level merges
// Note: We choose the longer string for content fields to avoid regressions with stale payloads
// and aggregate tokenUsage rather than overwriting.
export const mergeStepsByName = (
  oldSteps?: ActionStep[],
  newSteps?: ActionStep[],
): ActionStep[] => {
  const oldMap = new Map<string, ActionStep>();
  const result: ActionStep[] = [];

  if (Array.isArray(oldSteps)) {
    for (const s of oldSteps) {
      if (!s?.name) continue;
      oldMap.set(s.name, { ...s });
    }
  }

  if (Array.isArray(newSteps)) {
    for (const incoming of newSteps) {
      if (!incoming?.name) continue;
      const prev = oldMap.get(incoming.name);

      const mergedArtifacts = (() => {
        const a: Artifact[] = Array.isArray(prev?.artifacts) ? [...(prev?.artifacts || [])] : [];
        const b: Artifact[] = Array.isArray(incoming?.artifacts) ? incoming.artifacts || [] : [];
        if (!b.length) return a;
        const idToIndex = new Map<string, number>();
        a.forEach((art, idx) => {
          const id = (art as any)?.entityId as string | undefined;
          if (id) idToIndex.set(id, idx);
        });
        for (const item of b) {
          const id = (item as any)?.entityId as string | undefined;
          if (id && idToIndex.has(id)) {
            a[idToIndex.get(id)!] = item;
          } else {
            a.push(item);
          }
        }
        return a;
      })();

      const mergeStringsKeepLongest = (lhs?: string, rhs?: string): string | undefined => {
        if (lhs == null) return rhs;
        if (rhs == null) return lhs;
        return rhs.length >= lhs.length ? rhs : lhs;
      };

      const mergedLogs = [...((prev?.logs ?? []) as any[]), ...((incoming?.logs ?? []) as any[])];

      const mergedTokenUsage = (() => {
        const lhs = prev?.tokenUsage ?? [];
        const rhs = incoming?.tokenUsage ?? [];
        if (!lhs.length && !rhs.length) return undefined;
        return aggregateTokenUsage([...(lhs || []), ...(rhs || [])]);
      })();

      const mergedStructuredData = {
        ...(prev?.structuredData ?? {}),
        ...(incoming?.structuredData ?? {}),
      } as Record<string, unknown>;

      const merged: ActionStep = {
        name: incoming.name,
        content: mergeStringsKeepLongest(prev?.content, incoming?.content),
        reasoningContent: mergeStringsKeepLongest(
          prev?.reasoningContent,
          incoming?.reasoningContent,
        ),
        artifacts: mergedArtifacts,
        structuredData: mergedStructuredData,
        logs: mergedLogs,
        tokenUsage: mergedTokenUsage,
      };

      oldMap.set(incoming.name, merged);
    }
  }

  // Keep original order where possible; append any new-only steps at the end in input order
  const oldOrder = Array.isArray(oldSteps) ? oldSteps.map((s) => s.name) : [];
  const allNames = new Set<string>([...oldOrder, ...(newSteps?.map((s) => s.name) || [])]);
  for (const name of allNames) {
    const s = oldMap.get(name);
    if (s) result.push(s);
  }
  return result;
};

// Merge incoming ActionResult into existing using atomic field-level merges
export const mergeActionResults = (
  oldResult: ActionResult | undefined,
  incoming: Partial<ActionResult>,
): ActionResult => {
  const newVersion = incoming.version ?? oldResult?.version ?? 0;
  const oldVersion = oldResult?.version ?? 0;
  const version = newVersion >= oldVersion ? newVersion : oldVersion;

  const oldStatus = oldResult?.status;
  const newStatus = incoming.status ?? oldStatus;
  const shouldKeepOldStatus =
    (incoming.version ?? oldVersion) === oldVersion &&
    (oldStatus === 'finish' || oldStatus === 'failed') &&
    newStatus === 'executing';
  const status = shouldKeepOldStatus ? oldStatus : newStatus;

  const steps = mergeStepsByName(oldResult?.steps, incoming?.steps);

  const mergeArrayUnique = <T>(a?: T[], b?: T[]) => {
    if (!Array.isArray(a) && !Array.isArray(b)) return undefined;
    const arr = [...(a ?? []), ...(b ?? [])];
    return arr;
  };

  return {
    resultId: (incoming.resultId ?? oldResult?.resultId) as string,
    version,
    title: incoming.title ?? oldResult?.title,
    input: incoming.input ?? oldResult?.input,
    tier: incoming.tier ?? oldResult?.tier,
    status,
    type: incoming.type ?? oldResult?.type,
    modelInfo: incoming.modelInfo ?? oldResult?.modelInfo,
    targetType: incoming.targetType ?? oldResult?.targetType,
    targetId: incoming.targetId ?? oldResult?.targetId,
    actionMeta: incoming.actionMeta ?? oldResult?.actionMeta,
    context: incoming.context ?? oldResult?.context,
    tplConfig: incoming.tplConfig ?? oldResult?.tplConfig,
    runtimeConfig: incoming.runtimeConfig ?? oldResult?.runtimeConfig,
    history: mergeArrayUnique(oldResult?.history, incoming.history),
    steps,
    errors: mergeArrayUnique(oldResult?.errors, incoming.errors),
    toolsets: mergeArrayUnique(oldResult?.toolsets, incoming.toolsets),
    outputUrl: incoming.outputUrl ?? oldResult?.outputUrl,
    storageKey: incoming.storageKey ?? oldResult?.storageKey,
    pilotStepId: incoming.pilotStepId ?? oldResult?.pilotStepId,
    pilotSessionId: incoming.pilotSessionId ?? oldResult?.pilotSessionId,
    workflowExecutionId: incoming.workflowExecutionId ?? oldResult?.workflowExecutionId,
    workflowNodeExecutionId: incoming.workflowNodeExecutionId ?? oldResult?.workflowNodeExecutionId,
    createdAt: incoming.createdAt ?? oldResult?.createdAt,
    updatedAt: incoming.updatedAt ?? oldResult?.updatedAt,
  };
};
