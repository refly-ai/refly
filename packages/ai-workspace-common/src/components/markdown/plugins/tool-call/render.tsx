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
import { Button, Typography } from 'antd';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useFetchDriveFiles } from '@refly-packages/ai-workspace-common/hooks/use-fetch-drive-files';

import { ArrowDown, ArrowUp, Cancelled, CheckCircleBroken } from 'refly-icons';
import { useListToolsetInventory } from '@refly-packages/ai-workspace-common/queries';

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

  // Extract tool name from props
  const toolName = props['data-tool-name'] ?? 'unknown';
  const toolsetKey = props['data-tool-toolset-key'] ?? 'unknown';
  const toolCallStatus =
    parseToolCallStatus(props['data-tool-call-status']) ?? ToolCallStatus.EXECUTING;

  // Format the content for parameters
  const parametersContent = useMemo(() => {
    try {
      const argsStr = props['data-tool-arguments'] ?? '{}';
      const args = JSON.parse(argsStr);
      return JSON.parse(args?.input ?? '{}');
    } catch {
      return {};
    }
  }, [props['data-tool-arguments']]);

  const parameterEntries = useMemo(() => {
    if (!parametersContent || typeof parametersContent !== 'object') {
      return [];
    }
    return Object.entries(parametersContent as Record<string, unknown>);
  }, [parametersContent]);

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

  // Extract fileIds from result data
  const fileIds = useMemo<string[]>(() => {
    if (resultData?.fileId) {
      return [String(resultData.fileId)];
    }

    if (Array.isArray(resultData?.files)) {
      return resultData.files.map((file) => String(file.fileId));
    }

    return [];
  }, [resultData]);

  // Fetch complete drive files data (including publicURL in share pages)
  const { data: allDriveFiles } = useFetchDriveFiles();

  // Match the complete file data from useFetchDriveFiles
  const filePreviewDriveFile = useMemo<DriveFile[]>(() => {
    if (fileIds.length === 0) {
      return [];
    }

    // Try to find files with complete data from allDriveFiles
    const matchedFiles = fileIds
      .map((fileId) => {
        const matchedFile = allDriveFiles.find((f) => f.fileId === fileId);
        if (matchedFile) {
          return matchedFile;
        }

        // Fallback: construct partial file data from resultData if not found in allDriveFiles
        if (resultData?.fileId === fileId) {
          return {
            fileId: String(resultData.fileId),
            canvasId: String(resultData.canvasId ?? ''),
            name: String(resultData.name ?? resultData.fileName ?? 'Drive file'),
            type: String(resultData.type ?? resultData.mimeType ?? 'application/octet-stream'),
          } as DriveFile;
        }

        if (Array.isArray(resultData?.files)) {
          const fileData = resultData.files.find((f) => String(f.fileId) === fileId);
          if (fileData) {
            return {
              fileId: String(fileData.fileId),
              canvasId: String(fileData.canvasId ?? ''),
              name: String(fileData.name ?? fileData.fileName ?? 'Drive file'),
              type: String(fileData.type ?? fileData.mimeType ?? 'application/octet-stream'),
            } as DriveFile;
          }
        }

        return null;
      })
      .filter((file): file is DriveFile => file !== null);

    return matchedFiles;
  }, [fileIds, allDriveFiles, resultData]);

  const shouldRenderFilePreview = useMemo(() => {
    return filePreviewDriveFile.length > 0;
  }, [filePreviewDriveFile]);

  const { data } = useListToolsetInventory({}, null, {
    enabled: true,
  });
  const toolsetDefinition = data?.data?.find((t) => t.key === toolsetKey);
  const toolsetName = toolsetDefinition?.labelDict?.[currentLanguage] ?? toolsetKey;

  return (
    <>
      <div className="rounded-lg overflow-hidden bg-refly-bg-control-z0 text-refly-text-0">
        {/* Header bar */}
        <div
          className="flex items-center justify-between p-3 gap-3 cursor-pointer select-none min-h-[48px]"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ToolsetIcon
              toolsetKey={toolsetKey}
              config={{ size: 18, className: 'flex-shrink-0', builtinClassName: '!w-4.5 !h-4.5' }}
            />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Paragraph
                className="!m-0 text-sm font-semibold truncate max-w-[50%] flex-shrink-0"
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
                <CheckCircleBroken size={12} color="var(--refly-primary-default)" />
                {durationText && (
                  <span className="ml-1 text-xs text-refly-text-2 leading-4">{durationText}</span>
                )}
              </div>
            )}
            {toolCallStatus === ToolCallStatus.FAILED && (
              <Cancelled size={12} color="var(--refly-func-danger-default)" />
            )}

            <Button
              type="text"
              size="small"
              className="!w-4 !h-4 !rounded-[4px]"
              icon={isCollapsed ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
              onClick={() => setIsCollapsed(!isCollapsed)}
            />
          </div>
        </div>

        {/* Content section */}
        {!isCollapsed && (
          <div className="py-2 flex flex-col gap-4">
            {/* Parameters section always shown */}
            {parameterEntries?.length > 0 && (
              <div className="px-3 pb-2 flex flex-col gap-2">
                <div className="leading-5">{t('components.markdown.parameters', 'Input')}</div>
                <div className="rounded-lg border-[0.5px] border-solid border-refly-fill-hover overflow-hidden bg-refly-fill-hover">
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
            {hasResult && (
              <div>
                <div className="px-3 leading-5">{t('components.markdown.result', 'Output')}</div>
                <div className="mx-4 my-2 rounded-lg bg-refly-fill-hover px-4 py-3 font-mono text-xs font-normal whitespace-pre-wrap text-refly-text-0 leading-[22px]">
                  {resultContent}
                </div>
              </div>
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
