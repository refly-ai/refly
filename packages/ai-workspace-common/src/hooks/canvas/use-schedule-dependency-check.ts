import { useEffect, useCallback, useRef } from 'react';
import { useCanvasResourcesPanelStoreShallow, useUserStoreShallow } from '@refly/stores';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import {
  useListSchedules,
  useListUserTools,
  useGetCanvasData,
  useGetCreditUsageByCanvasId,
} from '@refly-packages/ai-workspace-common/queries';
import { useRequiredInputsCheck } from '@refly-packages/ai-workspace-common/components/canvas/tools-dependency';
import { extractToolsetsWithNodes } from '@refly/canvas-common';
import type { WorkflowSchedule, GenericToolset, UserTool } from '@refly/openapi-schema';

/**
 * Check if a toolset is authorized/installed
 * - External OAuth tools: need authorization (check userTools.authorized)
 * - Other tools (builtin, non-OAuth): always available, no installation needed
 */
const isToolsetAuthorized = (toolset: GenericToolset, userTools: UserTool[]): boolean => {
  // MCP servers need to be checked separately
  if (toolset.type === 'mcp') {
    return userTools.some((t) => t.toolset?.name === toolset.name);
  }

  // Builtin tools are always available
  if (toolset.builtin) {
    return true;
  }

  // Find matching user tool by key
  const matchingUserTool = userTools.find((t) => t.key === toolset.toolset?.key);

  // If not in userTools list, user hasn't installed/authorized this tool
  if (!matchingUserTool) {
    return false;
  }

  // For external OAuth tools, check authorized status
  return matchingUserTool.authorized ?? false;
};

interface ScheduleDependencyCheckProps {
  canvasId: string;
  enabled?: boolean;
}

/**
 * Custom hook to check schedule dependencies when user enters a canvas
 * If schedule is enabled but has dependency issues, automatically opens dependency panel
 */
export const useScheduleDependencyCheck = ({
  canvasId,
  enabled = true,
}: ScheduleDependencyCheckProps) => {
  const hasCheckedRef = useRef<boolean>(false);
  const previousCanvasIdRef = useRef<string | null>(null);

  // Get user login status
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  // Get tools dependency store for triggering popover
  const { setToolsDependencyOpen, setToolsDependencyHighlight } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      setToolsDependencyOpen: state.setToolsDependencyOpen,
      setToolsDependencyHighlight: state.setToolsDependencyHighlight,
    }));

  // Get canvas data for dependency checks
  const { data: canvasResponse, isLoading: canvasLoading } = useGetCanvasData(
    { query: { canvasId } },
    [],
    {
      enabled: !!canvasId && isLogin && enabled,
      refetchOnWindowFocus: false,
    },
  );

  // Get user tools for dependency checks
  const { data: userToolsData, isLoading: toolsLoading } = useListUserTools({}, [], {
    enabled: isLogin && enabled,
    refetchOnWindowFocus: false,
  });

  // Get credit balance for dependency checks
  const { creditBalance, isBalanceSuccess } = useSubscriptionUsage();

  // Get credit usage estimation for this canvas
  const { data: creditUsageData, isLoading: creditLoading } = useGetCreditUsageByCanvasId(
    {
      query: { canvasId },
    },
    undefined,
    {
      enabled: !!canvasId && isLogin && enabled,
      refetchOnWindowFocus: false,
    },
  );

  // Get required inputs check
  const { count: requiredInputsCount } = useRequiredInputsCheck(canvasId);

  // API mutations for schedule fetching
  const listSchedulesMutation = useListSchedules();

  // Check if canvas has enabled schedule and dependency errors
  const checkScheduleDependencies = useCallback(async () => {
    if (!canvasId || !isLogin || !enabled) {
      return;
    }

    if (canvasLoading || toolsLoading || creditLoading) {
      return;
    }

    if (!canvasResponse?.data?.nodes || !userToolsData?.data) {
      return;
    }

    if (!isBalanceSuccess) {
      return;
    }

    try {
      // Fetch schedule for this canvas
      const result = await listSchedulesMutation.mutateAsync({
        body: {
          canvasId: canvasId,
          page: 1,
          pageSize: 1,
        },
      });

      // Parse schedule data
      let schedules: WorkflowSchedule[] = [];
      if (result.data && typeof result.data === 'object' && 'data' in result.data) {
        const nestedData = (result.data as any).data;
        schedules = nestedData?.items || [];
      } else if (Array.isArray(result.data)) {
        schedules = result.data;
      }

      const currentSchedule = schedules.length > 0 ? schedules[0] : null;

      // Only check if schedule is enabled
      if (!currentSchedule?.isEnabled) {
        return;
      }

      const nodes = canvasResponse.data.nodes;
      const userTools = userToolsData.data;

      // Check for uninstalled tools
      const toolsetsWithNodes = extractToolsetsWithNodes(nodes);
      const uninstalledTools = toolsetsWithNodes.filter((tool) => {
        const isAuthorized = isToolsetAuthorized(tool.toolset, userTools);
        return !isAuthorized;
      });
      const hasUninstalledTools = uninstalledTools.length > 0;

      // Check for credit insufficiency
      const estimatedCreditUsage = creditUsageData?.data?.total ?? 0;
      const isCreditInsufficient =
        isBalanceSuccess &&
        Number.isFinite(estimatedCreditUsage) &&
        estimatedCreditUsage > 0 &&
        creditBalance < estimatedCreditUsage;

      // Check for unfilled required inputs
      const hasUnfilledRequiredInputs = requiredInputsCount > 0;

      const hasDependencyError =
        hasUninstalledTools || isCreditInsufficient || hasUnfilledRequiredInputs;

      // If there are dependency errors, open the dependency panel
      if (hasDependencyError) {
        setToolsDependencyOpen(canvasId, true);
        setToolsDependencyHighlight(canvasId, true);
      }
    } catch (error) {
      console.error('Error checking schedule dependencies:', error);
    }
  }, [
    canvasId,
    isLogin,
    enabled,
    canvasLoading,
    toolsLoading,
    creditLoading,
    canvasResponse?.data?.nodes,
    userToolsData?.data,
    isBalanceSuccess,
    creditUsageData?.data?.total,
    creditBalance,
    requiredInputsCount,
    listSchedulesMutation,
    setToolsDependencyOpen,
    setToolsDependencyHighlight,
  ]);

  // Reset check flag when canvas changes
  useEffect(() => {
    if (previousCanvasIdRef.current !== canvasId) {
      hasCheckedRef.current = false;
      previousCanvasIdRef.current = canvasId;
    }
  }, [canvasId]);

  // Run dependency check when canvas data is loaded and conditions are met
  useEffect(() => {
    // Only check once per canvas visit
    if (hasCheckedRef.current) {
      return;
    }

    // Wait for all data to be loaded
    if (canvasLoading || toolsLoading || creditLoading) {
      return;
    }

    // Ensure we have required data
    if (!canvasResponse?.data?.nodes || !userToolsData?.data || !isBalanceSuccess) {
      return;
    }

    // Mark as checked and run the dependency check immediately
    hasCheckedRef.current = true;

    // Run check immediately instead of using setTimeout to avoid cleanup issues
    checkScheduleDependencies();
  }, [
    canvasLoading,
    toolsLoading,
    creditLoading,
    canvasResponse?.data?.nodes,
    userToolsData?.data,
    isBalanceSuccess,
    checkScheduleDependencies,
  ]);

  return {
    isLoading: canvasLoading || toolsLoading || creditLoading,
    checkScheduleDependencies,
  };
};
