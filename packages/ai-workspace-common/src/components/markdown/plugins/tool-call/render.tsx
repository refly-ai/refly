import { ToolOutlined } from '@ant-design/icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MarkdownMode } from '../../types';
import { ToolCallStatus, parseToolCallStatus } from './types';
import { CopilotWorkflowPlan } from '@refly-packages/ai-workspace-common/components/markdown/plugins/tool-call/copilot-workflow-plan';

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
  const toolName = props['data-tool-name'] || 'unknown';
  const toolsetKey = props['data-tool-toolset-key'] || 'unknown';

  const isCopilotGenerateWorkflow = toolsetKey === 'copilot' && toolName === 'generate_workflow';
  if (isCopilotGenerateWorkflow) {
    const argsStr = props['data-tool-arguments'] || '{}';
    const structuredArgs = JSON.parse(JSON.parse(argsStr).input);
    return <CopilotWorkflowPlan data={structuredArgs} />;
  }

  // Format the content for parameters
  const parametersContent = () => {
    try {
      const argsStr = props['data-tool-arguments'] || '{}';
      const args = JSON.parse(argsStr);
      return Object.keys(args).length
        ? JSON.stringify(args, null, 2)
        : t('components.markdown.noParameters', 'No parameters');
    } catch (_e) {
      return props['data-tool-arguments'] || t('components.markdown.noParameters', 'No parameters');
    }
  };

  // Format the content for result
  const resultContent = props['data-tool-error'] || props['data-tool-result'] || '';
  // Check if result exists
  const hasResult = !!resultContent || !!props['data-tool-error'];
  const toolCallStatus =
    parseToolCallStatus(props['data-tool-call-status']) ?? ToolCallStatus.EXECUTING;

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

  return (
    <>
      <div className="my-3 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 text-black dark:text-gray-100 font-mono shadow-refly-m">
        {/* Header bar */}
        <div
          className="flex items-center px-4 py-2 cursor-pointer select-none bg-gray-50 dark:bg-gray-700 min-h-[44px]"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {/* ToolOutlined now serves as the toggle icon with rotation */}
          <ToolOutlined
            className="text-gray-500 dark:text-gray-400"
            style={{
              fontSize: '16px',
              marginRight: '12px', // Adjusted margin for spacing
              transition: 'transform 0.2s ease-in-out',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          />
          {/* Tool name displayed as the main text in the header */}
          <div className="flex-1 text-[15px] font-medium tracking-tight text-gray-900 dark:text-gray-100">
            {`${toolsetKey} | ${toolName}`}
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
    </>
  );
};

// Use React.memo to prevent unnecessary re-renders
export default React.memo(ToolCall);
