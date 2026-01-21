/**
 * Skill Execution Plan Service - computes execution levels and DAG plan.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SkillExecutionError } from './skill-execution.errors';

export interface SkillWorkflowInfo {
  skillWorkflowId: string;
  name: string;
  dependencies?: Array<{
    dependencyWorkflowId: string;
    condition?: string;
    inputMapping?: string;
    outputSelector?: string;
    mergeStrategy?: string;
  }>;
}

export interface ExecutionLevel {
  level: number;
  workflows: SkillWorkflowInfo[];
}

export interface ExecutionPlan {
  levels: ExecutionLevel[];
  workflowLevelMap: Map<string, number>;
  dependencyMap: Map<string, string[]>;
  totalWorkflows: number;
}

@Injectable()
export class SkillExecutionPlanService {
  private readonly logger = new Logger(SkillExecutionPlanService.name);

  /**
   * Compute execution levels for parallel execution.
   * Workflows at the same level can execute in parallel.
   */
  computeExecutionLevels(workflows: SkillWorkflowInfo[]): ExecutionLevel[] {
    const levels = new Map<string, number>();
    const dependencies = new Map<string, string[]>();

    // Build dependency map
    for (const wf of workflows) {
      const deps = wf.dependencies?.map((d) => d.dependencyWorkflowId) ?? [];
      dependencies.set(wf.skillWorkflowId, deps);
    }

    // Entry workflows are level 0
    for (const wf of workflows) {
      const deps = dependencies.get(wf.skillWorkflowId) ?? [];
      if (deps.length === 0) {
        levels.set(wf.skillWorkflowId, 0);
      }
    }

    // Propagate levels using BFS-like iteration
    let changed = true;
    let iterations = 0;
    const maxIterations = workflows.length + 1;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (const wf of workflows) {
        if (levels.has(wf.skillWorkflowId)) continue;

        const deps = dependencies.get(wf.skillWorkflowId) ?? [];
        const depLevels: number[] = [];

        for (const dep of deps) {
          const depLevel = levels.get(dep);
          if (depLevel !== undefined) {
            depLevels.push(depLevel);
          }
        }

        if (depLevels.length === deps.length) {
          levels.set(wf.skillWorkflowId, Math.max(...depLevels) + 1);
          changed = true;
        }
      }
    }

    // Check for circular dependencies
    if (levels.size !== workflows.length) {
      const unresolved = workflows
        .filter((wf) => !levels.has(wf.skillWorkflowId))
        .map((wf) => wf.skillWorkflowId);
      throw SkillExecutionError.circularDependency(unresolved);
    }

    // Group by level
    const grouped = new Map<number, SkillWorkflowInfo[]>();
    for (const wf of workflows) {
      const level = levels.get(wf.skillWorkflowId) ?? 0;
      const group = grouped.get(level) ?? [];
      group.push(wf);
      grouped.set(level, group);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([level, wfs]) => ({ level, workflows: wfs }));
  }

  /**
   * Build a complete execution plan for a skill.
   */
  buildExecutionPlan(workflows: SkillWorkflowInfo[]): ExecutionPlan {
    const levels = this.computeExecutionLevels(workflows);

    // Build level map
    const workflowLevelMap = new Map<string, number>();
    for (const level of levels) {
      for (const wf of level.workflows) {
        workflowLevelMap.set(wf.skillWorkflowId, level.level);
      }
    }

    // Build dependency map
    const dependencyMap = new Map<string, string[]>();
    for (const wf of workflows) {
      const deps = wf.dependencies?.map((d) => d.dependencyWorkflowId) ?? [];
      dependencyMap.set(wf.skillWorkflowId, deps);
    }

    this.logger.log(`Built execution plan: ${levels.length} levels, ${workflows.length} workflows`);

    return {
      levels,
      workflowLevelMap,
      dependencyMap,
      totalWorkflows: workflows.length,
    };
  }

  /**
   * Get workflows that are ready to execute (all dependencies satisfied).
   */
  getReadyWorkflows(
    plan: ExecutionPlan,
    completedWorkflows: Set<string>,
    runningWorkflows: Set<string>,
  ): SkillWorkflowInfo[] {
    const ready: SkillWorkflowInfo[] = [];

    for (const level of plan.levels) {
      for (const wf of level.workflows) {
        // Skip if already running or completed
        if (completedWorkflows.has(wf.skillWorkflowId)) continue;
        if (runningWorkflows.has(wf.skillWorkflowId)) continue;

        // Check if all dependencies are completed
        const deps = plan.dependencyMap.get(wf.skillWorkflowId) ?? [];
        const allDepsComplete = deps.every((dep) => completedWorkflows.has(dep));

        if (allDepsComplete) {
          ready.push(wf);
        }
      }
    }

    return ready;
  }

  /**
   * Check if execution is complete (all workflows done or blocked).
   */
  isExecutionComplete(
    plan: ExecutionPlan,
    completedWorkflows: Set<string>,
    blockedWorkflows: Set<string>,
  ): boolean {
    const doneOrBlocked = completedWorkflows.size + blockedWorkflows.size;
    return doneOrBlocked >= plan.totalWorkflows;
  }

  /**
   * Mark dependent workflows as blocked when a workflow fails.
   */
  getBlockedWorkflows(
    plan: ExecutionPlan,
    failedWorkflowId: string,
    alreadyBlocked: Set<string>,
  ): string[] {
    const blocked: string[] = [];

    // Find all workflows that depend on the failed workflow
    for (const [workflowId, deps] of plan.dependencyMap) {
      if (alreadyBlocked.has(workflowId)) continue;
      if (deps.includes(failedWorkflowId)) {
        blocked.push(workflowId);
      }
    }

    // Recursively find workflows that depend on newly blocked ones
    const newBlocked = new Set(blocked);
    for (const blockedId of blocked) {
      const transitive = this.getBlockedWorkflows(
        plan,
        blockedId,
        new Set([...alreadyBlocked, ...newBlocked]),
      );
      for (const id of transitive) {
        if (!newBlocked.has(id)) {
          newBlocked.add(id);
          blocked.push(id);
        }
      }
    }

    return blocked;
  }
}
