import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DriveFile } from '@refly/openapi-schema';

import { MarkdownMode } from '../../types';
import { ToolCallStatus, parseToolCallStatus } from './types';
import { CopilotWorkflowPlan } from './copilot-workflow-plan';
import { WorkflowPlan } from '@refly/canvas-common';
import { safeParseJSON } from '@refly/utils/parse';
import { ProductCard } from './product-card';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';

// SVG icons for the component
const ExecutingIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400 animate-spin"
    style={{ animationDuration: '1.1s' }}
  >
    <circle cx="12" cy="12" r="10" className="opacity-30" />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

const CompletedIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-[18px] h-[18px] text-green-500 dark:text-green-400"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const FailedIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-[18px] h-[18px] text-red-500 dark:text-red-400"
  >
    <path d="M18 6 6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

interface ToolCallProps {
  'data-tool-name'?: string;
  'data-tool-call-id'?: string;
  'data-tool-call-status'?: string;
  'data-tool-created-at'?: string;
  'data-tool-updated-at'?: string;
  'data-tool-arguments'?: string;
  'data-tool-result'?: string;
  'data-tool-type'?: 'use' | 'result';
  'data-tool-image-base64-url'?: string;
  'data-tool-image-http-url'?: string;
  'data-tool-image-name'?: string;
  'data-tool-audio-http-url'?: string;
  'data-tool-audio-name'?: string;
  'data-tool-audio-format'?: string;
  'data-tool-video-http-url'?: string;
  'data-tool-video-name'?: string;
  'data-tool-video-format'?: string;
  'data-tool-error'?: string;
  id?: string;
  mode?: MarkdownMode;
}

/**
 * ToolCall component renders tool_use and tool_use_result tags as collapsible panels
 * similar to the Cursor MCP UI seen in the screenshot
 */
const ToolCall: React.FC<ToolCallProps> = (props) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Extract tool name from props
  const toolName = props['data-tool-name'] ?? 'unknown';
  const toolsetKey = props['data-tool-toolset-key'] ?? 'unknown';
  const toolCallStatus =
    parseToolCallStatus(props['data-tool-call-status']) ?? ToolCallStatus.EXECUTING;

  // Format the content for parameters
  const parametersContent = () => {
    try {
      const argsStr = props['data-tool-arguments'] ?? '{}';
      const args = JSON.parse(argsStr);
      return Object.keys(args).length
        ? JSON.stringify(args, null, 2)
        : t('components.markdown.noParameters', 'No parameters');
    } catch (_e) {
      return props['data-tool-arguments'] ?? t('components.markdown.noParameters', 'No parameters');
    }
  };

  // Format the content for result
  const resultContent = props['data-tool-error'] ?? props['data-tool-result'] ?? '';
  // Check if result exists
  const hasResult = !!resultContent || !!props['data-tool-error'];

  // Compute execution duration when timestamps are provided
  const durationText = useMemo(() => {
    const createdAtStr = props['data-tool-created-at'] ?? '0';
    const updatedAtStr = props['data-tool-updated-at'] ?? '0';
    const createdAt = Number(createdAtStr);
    const updatedAt = Number(updatedAtStr);
    if (
      !Number.isFinite(createdAt) ||
      !Number.isFinite(updatedAt) ||
      updatedAt <= 0 ||
      createdAt <= 0
    ) {
      return '';
    }
    const ms = Math.max(0, updatedAt - createdAt);
    if (ms < 1000) {
      return `${ms}ms`;
    }
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(2)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainSec = Math.floor(seconds % 60);
    return `${minutes}m ${remainSec}s`;
  }, [props['data-tool-created-at'], props['data-tool-updated-at']]);

  const isCopilotGenerateWorkflow = toolsetKey === 'copilot' && toolName === 'generate_workflow';
  if (isCopilotGenerateWorkflow) {
    const resultStr = props['data-tool-result'] ?? '{}';
    const structuredArgs = safeParseJSON(resultStr)?.data as WorkflowPlan;

    // Handle case when structuredArgs is undefined
    if (!structuredArgs) {
      return (
        <div className="border-t border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2">
          <div className="rounded-md bg-gray-100 dark:bg-gray-700 px-4 py-3 text-xs font-normal whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-[22px]">
            {toolCallStatus === ToolCallStatus.EXECUTING
              ? t('components.markdown.workflow.generating')
              : t('components.markdown.workflow.invalidData')}
          </div>
        </div>
      );
    }

    return <CopilotWorkflowPlan data={structuredArgs} />;
  }

  const resultData = safeParseJSON(resultContent)?.data as Record<string, unknown> | undefined;
  const filePreviewDriveFile = useMemo<DriveFile | null>(() => {
    if (!resultData?.fileId) return null;
    return {
      fileId: String(resultData.fileId),
      canvasId: String(resultData.canvasId ?? ''),
      name: String(resultData.name ?? resultData.fileName ?? 'Drive file'),
      type: String(resultData.type ?? resultData.mimeType ?? 'application/octet-stream'),
    };
  }, [resultData]);
  const shouldRenderFilePreview = Boolean(filePreviewDriveFile?.fileId);

  return (
    <>
      <div className="my-3 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 text-black dark:text-gray-100 shadow-refly-m">
        {/* Header bar */}
        <div
          className="flex items-center px-4 py-2 gap-2 cursor-pointer select-none min-h-[44px]"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <ToolsetIcon
            toolsetKey={toolsetKey}
            config={{ size: 16, className: 'flex-shrink-0', builtinClassName: '!w-4 !h-4' }}
          />
          <div className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {`${toolName}`}
          </div>
          {/* Status indicator */}
          {toolCallStatus === ToolCallStatus.EXECUTING && (
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              <ExecutingIcon />
            </span>
          )}
          {toolCallStatus === ToolCallStatus.COMPLETED && (
            <span className="ml-2 flex items-center">
              <CompletedIcon />
              {durationText && (
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  {durationText}
                </span>
              )}
            </span>
          )}
          {toolCallStatus === ToolCallStatus.FAILED && (
            <span className="ml-2 flex items-center">
              <FailedIcon />
            </span>
          )}
        </div>

        {/* Content section */}
        {!isCollapsed && (
          <div className="border-t border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2">
            {/* Parameters section always shown */}
            <div>
              <div className="px-5 py-1 text-gray-600 dark:text-gray-400 text-[13px] border-b border-gray-300 dark:border-gray-600 font-normal">
                {t('components.markdown.parameters', 'Parameters:')}
              </div>
              {/* Parameter content block with background, rounded corners, margin and padding */}
              <div className="mx-4 my-2 rounded-md bg-gray-100 dark:bg-gray-700 px-4 py-3 font-mono text-xs font-normal whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-[22px]">
                {parametersContent()}
              </div>
            </div>
            {/* Result section only if hasResult */}
            {hasResult && (
              <div>
                <div className="px-5 py-1 text-gray-600 dark:text-gray-400 text-[13px] border-b border-gray-300 dark:border-gray-600 font-normal">
                  {t('components.markdown.result', 'Result:')}
                </div>
                {/* Result content block with background, rounded corners, margin and padding */}
                <div className="mx-4 my-2 rounded-md bg-gray-100 dark:bg-gray-700 px-4 py-3 font-mono text-xs font-normal whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-[22px]">
                  {resultContent}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {shouldRenderFilePreview && <ProductCard file={filePreviewDriveFile} />}
    </>
  );
};

// Use React.memo to prevent unnecessary re-renders
export default React.memo(ToolCall);
