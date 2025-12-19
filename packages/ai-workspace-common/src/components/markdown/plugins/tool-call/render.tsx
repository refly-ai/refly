import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DriveFile } from '@refly/openapi-schema';

import { MarkdownMode } from '../../types';
import { ToolCallStatus, parseToolCallStatus } from './types';
import { CopilotWorkflowPlan } from './copilot-workflow-plan';
import { WorkflowPlan } from '@refly/canvas-common';
import { safeParseJSON } from '@refly/utils/parse';
import { InternalToolRenderer } from './internal-tool-renderers';
import { ProductCard } from './product-card';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { Button, Typography } from 'antd';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';

import { ArrowDown, ArrowUp, Cancelled, CheckCircleBroken } from 'refly-icons';
import {
  useListToolsetInventory,
  useGetToolCallResult,
} from '@refly-packages/ai-workspace-common/queries';
import cn from 'classnames';

const { Paragraph } = Typography;

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
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language || 'en';
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Extract tool call ID
  const toolCallId = props['data-tool-call-id'];

  // Check if we need to fetch data from API
  const shouldFetchData = useMemo(() => {
    return (
      toolCallId &&
      (!props['data-tool-name'] ||
        !props['data-tool-call-status'] ||
        !props['data-tool-arguments'] ||
        (!props['data-tool-result'] && !props['data-tool-error']))
    );
  }, [
    toolCallId,
    props['data-tool-name'],
    props['data-tool-call-status'],
    props['data-tool-arguments'],
    props['data-tool-result'],
    props['data-tool-error'],
  ]);

  // Fetch tool call result when needed
  const { data: fetchedData, isLoading: isFetchingData } = useGetToolCallResult(
    {
      query: { toolCallId: toolCallId ?? '' },
    },
    undefined,
    {
      enabled: shouldFetchData && !!toolCallId && !isCollapsed,
    },
  );

  // Extract tool name from props or fetched data
  const toolName = props['data-tool-name'] ?? fetchedData?.data?.result?.toolName ?? 'unknown';
  const toolsetId =
    props['data-tool-toolset-id'] ?? fetchedData?.data?.result?.toolsetId ?? 'unknown';
  const toolsetKey = props['data-tool-toolset-key'] ?? toolsetId;
  const toolCallStatus =
    parseToolCallStatus(props['data-tool-call-status']) ??
    parseToolCallStatus(fetchedData?.data?.result?.status) ??
    ToolCallStatus.EXECUTING;

  // Format the content for parameters
  const parametersContent = useMemo(() => {
    // First try props data
    if (props['data-tool-arguments']) {
      try {
        const argsStr = props['data-tool-arguments'];
        const args = JSON.parse(argsStr);
        return JSON.parse(args?.input ?? '{}');
      } catch {
        // Fall through to API data
      }
    }

    // Fall back to API data
    if (fetchedData?.data?.result?.input) {
      return fetchedData.data.result.input;
    }

    return {};
  }, [props['data-tool-arguments'], fetchedData?.data?.result?.input]);

  const parameterEntries = useMemo(() => {
    if (!parametersContent || typeof parametersContent !== 'object') {
      return [];
    }
    return Object.entries(parametersContent as Record<string, unknown>);
  }, [parametersContent]);

  const errorMessage = useMemo(() => {
    if (props['data-tool-error']) {
      return props['data-tool-error'];
    }
    if (fetchedData?.data?.result?.error) {
      return fetchedData.data.result.error;
    }
    return null;
  }, [props['data-tool-error'], fetchedData?.data?.result?.error]);

  // Format the content for result
  const resultContent = useMemo(() => {
    let rawResult: string | undefined;

    // First try props data
    if (props['data-tool-result']) {
      rawResult = props['data-tool-result'];
    } else if (fetchedData?.data?.result?.error) {
      // Fall back to API data - error
      return fetchedData.data.result.error;
    } else if (fetchedData?.data?.result?.output) {
      // Fall back to API data - output
      rawResult =
        typeof fetchedData.data.result.output === 'string'
          ? fetchedData.data.result.output
          : JSON.stringify(fetchedData.data.result.output, null, 2);
    }

    if (!rawResult) {
      return '';
    }

    // Try to parse and re-stringify to get proper formatting
    // This handles the case where the result is a double-escaped JSON string
    try {
      const parsed = JSON.parse(rawResult);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If parsing fails, return the raw result as-is
      return rawResult;
    }
  }, [
    props['data-tool-error'],
    props['data-tool-result'],
    fetchedData?.data?.result?.error,
    fetchedData?.data?.result?.output,
  ]);

  // Check if result exists
  const hasResult = !!resultContent;

  // Parse result content as object for internal tool renderers
  const resultContentParsed = useMemo(() => {
    if (!resultContent || typeof resultContent !== 'string') {
      return {};
    }
    try {
      const parsed = JSON.parse(resultContent);
      // Handle nested data structure (e.g., { data: { fileName: '...' } })
      return parsed?.data ?? parsed ?? {};
    } catch {
      return {};
    }
  }, [resultContent]);

  // Compute execution duration when timestamps are provided
  const durationText = useMemo(() => {
    let createdAt: number;
    let updatedAt: number;

    // First try props data
    if (props['data-tool-created-at'] && props['data-tool-updated-at']) {
      createdAt = Number(props['data-tool-created-at']);
      updatedAt = Number(props['data-tool-updated-at']);
    } else if (fetchedData?.data?.result?.createdAt && fetchedData?.data?.result?.updatedAt) {
      // Fall back to API data
      createdAt = fetchedData.data.result.createdAt;
      updatedAt = fetchedData.data.result.updatedAt;
    } else {
      return '';
    }

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
  }, [
    props['data-tool-created-at'],
    props['data-tool-updated-at'],
    fetchedData?.data?.result?.createdAt,
    fetchedData?.data?.result?.updatedAt,
  ]);

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

  const filePreviewDriveFile = useMemo<DriveFile[]>(() => {
    const result = safeParseJSON(resultContent);
    const resultData = result?.data as Record<string, unknown> | undefined;
    const files = result?.files ?? resultData?.files;

    if (Array.isArray(files) && files.length > 0) {
      return files.map((file) => ({
        fileId: String(file.fileId),
        canvasId: String(file.canvasId ?? ''),
        name: String(file.name ?? file.fileName ?? 'Drive file'),
        type: String(file.type ?? file.mimeType ?? 'application/octet-stream'),
      }));
    }

    if (resultData?.fileId) {
      return [
        {
          fileId: String(resultData.fileId),
          canvasId: String(resultData.canvasId ?? ''),
          name: String(resultData.name ?? resultData.fileName ?? 'Drive file'),
          type: String(resultData.type ?? resultData.mimeType ?? 'application/octet-stream'),
        },
      ];
    }

    return [];
  }, [resultContent]);

  const shouldRenderFilePreview = useMemo(() => {
    return filePreviewDriveFile.length > 0;
  }, [filePreviewDriveFile]);

  const { data } = useListToolsetInventory({}, null, {
    enabled: true,
  });
  const toolsetDefinition = data?.data?.find((t) => t.key === toolsetKey);
  const toolsetName = toolsetDefinition?.labelDict?.[currentLanguage] ?? toolsetKey;

  // Compact rendering for internal/system-level tools (read_file, list_files)
  const isInternalTool = toolsetDefinition?.internal === true;
  if (isInternalTool) {
    return (
      <InternalToolRenderer
        toolsetKey={toolsetKey}
        toolsetName={toolsetName}
        toolCallStatus={toolCallStatus}
        parametersContent={parametersContent as Record<string, unknown>}
        resultContent={resultContentParsed}
      />
    );
  }

  return (
    <>
      <div className="rounded-lg overflow-hidden bg-refly-bg-control-z0 text-refly-text-0">
        {/* Header bar */}
        <div
          className="flex items-center justify-between p-3 gap-3 cursor-pointer select-none min-h-[48px] transition-all duration-200"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ToolsetIcon
              toolsetKey={toolsetKey}
              config={{ size: 18, className: 'flex-shrink-0', builtinClassName: '!w-4.5 !h-4.5' }}
            />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Paragraph
                className={cn(
                  '!m-0 text-sm font-semibold truncate flex-shrink-0',
                  !toolsetDefinition?.builtin ? 'max-w-[50%]' : 'max-w-[100%]',
                )}
                ellipsis={{
                  rows: 1,
                  tooltip: {
                    title: <div className="max-h-[200px] overflow-y-auto">{toolsetName}</div>,
                    placement: 'bottom',
                    arrow: false,
                  },
                }}
              >
                {toolsetName}
              </Paragraph>
              {!toolsetDefinition?.builtin && (
                <Paragraph
                  className="!m-0 text-xs text-refly-text-2 truncate flex-1 min-w-0"
                  ellipsis={{
                    rows: 1,
                    tooltip: {
                      title: <div className="max-h-[200px] overflow-y-auto">{toolName}</div>,
                      placement: 'bottom',
                      arrow: false,
                    },
                  }}
                >
                  {toolName}
                </Paragraph>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Status indicator */}
            {toolCallStatus === ToolCallStatus.EXECUTING && (
              <Spin size="small" className="text-refly-text-2" />
            )}
            {toolCallStatus === ToolCallStatus.COMPLETED && (
              <div className="flex items-center">
                <CheckCircleBroken size={14} color="var(--refly-primary-default)" />
                {durationText && (
                  <span className="ml-1 text-xs text-refly-text-2 leading-4">{durationText}</span>
                )}
              </div>
            )}
            {toolCallStatus === ToolCallStatus.FAILED && (
              <div className="flex items-center">
                <Cancelled size={14} color="var(--refly-func-danger-default)" />
                {durationText && (
                  <span className="ml-1 text-xs text-refly-text-2 leading-4">{durationText}</span>
                )}
              </div>
            )}

            <Button
              type="text"
              size="small"
              icon={isCollapsed ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
              onClick={() => setIsCollapsed(!isCollapsed)}
            />
          </div>
        </div>

        {/* Content section */}
        {!isCollapsed && (
          <div className="py-2 flex flex-col gap-4">
            {isFetchingData ? (
              <div className="px-3 py-4 flex items-center justify-center">
                <Spin size="small" className="mr-2" />
                <span className="text-xs text-refly-text-2">
                  {t('components.markdown.loadingToolCall', 'Loading tool call details...')}
                </span>
              </div>
            ) : (
              <>
                {errorMessage && (
                  <div>
                    <div className="px-3 leading-5">
                      {t('components.markdown.failureReason', 'Failure Reason')}
                    </div>
                    <div className="mx-3 my-2 rounded-lg bg-refly-fill-hover px-4 py-3 font-mono text-xs font-normal whitespace-pre-wrap text-refly-text-1 leading-[22px] overflow-x-auto">
                      {errorMessage}
                    </div>
                  </div>
                )}

                {/* Parameters section always shown */}
                {parameterEntries?.length > 0 && (
                  <div className="px-3 pb-2 flex flex-col gap-2">
                    <div className="leading-5">{t('components.markdown.parameters', 'Input')}</div>
                    <div className="rounded-lg border-[0.5px] border-solid border-refly-fill-hover bg-refly-fill-hover max-h-[300px] overflow-y-auto">
                      <div className="grid grid-cols-[120px_1fr] text-[10px] leading-[14px] text-refly-text-3">
                        <div className="px-3 py-2">
                          {t('components.markdown.parameterName', 'Name')}
                        </div>
                        <div className="px-3 py-2 border-[0.5px] border-solid border-r-0 border-y-0 border-refly-tertiary-hover">
                          {t('components.markdown.parameterValue', 'Value')}
                        </div>
                      </div>
                      {parameterEntries.map(([key, value]) => (
                        <div
                          key={key}
                          className="grid grid-cols-[120px_1fr] border-[0.5px] border-solid border-b-0 border-x-0 border-refly-tertiary-hover text-xs text-refly-text-0 leading-4"
                        >
                          <div className="px-3 py-2 break-all">{key}</div>
                          <div className="px-3 py-2 border-[0.5px] border-solid border-r-0 border-y-0 border-refly-tertiary-hover whitespace-pre-wrap break-all">
                            {typeof value === 'object'
                              ? JSON.stringify(value ?? {}, null, 2)
                              : String(value ?? '')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Result section only if hasResult */}
                {hasResult ? (
                  <div>
                    <div className="px-3 leading-5">
                      {t('components.markdown.result', 'Output')}
                    </div>
                    <div className="max-h-[300px] overflow-y-auto mx-4 my-2 rounded-lg bg-refly-fill-hover px-4 py-3 font-mono text-xs font-normal whitespace-pre-wrap break-all text-refly-text-0 leading-[22px]">
                      {resultContent}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-4 flex items-center justify-center">
                    <span className="text-xs text-refly-text-2">
                      {t('components.markdown.noToolCallResult', 'No tool call result')}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {shouldRenderFilePreview &&
        filePreviewDriveFile.map((file) => (
          <ProductCard key={file.fileId} file={file} source="card" classNames="mt-3" />
        ))}
    </>
  );
};

// Use React.memo to prevent unnecessary re-renders
export default React.memo(ToolCall);
