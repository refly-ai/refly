import { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Divider, Tooltip } from 'antd';
import { Question } from 'refly-icons';
import { IContextItem } from '@refly/common-types';
import { EditChatInput } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/edit-chat-input';
import { ChatComposerRef } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-composer';
import { ModelSelector } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions/model-selector';
import { ConfigInfoDisplay } from './config-info-display';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { useAgentNodeManagement } from '@refly-packages/ai-workspace-common/hooks/canvas/use-agent-node-management';
import { useAgentConnections } from '@refly-packages/ai-workspace-common/hooks/canvas/use-agent-connections';
import Down from '../../../../assets/down.svg';

interface ConfigureTabProps {
  readonly?: boolean;
  query?: string | null;
  version: number;
  resultId: string;
  nodeId: string;
  canvasId: string;
  disabled: boolean;
}

const ConfigureTabComponent = ({
  query,
  version,
  resultId,
  nodeId,
  canvasId,
  disabled,
  readonly = false,
}: ConfigureTabProps) => {
  const { t } = useTranslation();
  const { handleUploadMultipleImages } = useUploadImage();
  const [dragging, setDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const chatComposerRef = useRef<ChatComposerRef>(null);
  const handleAddToolsAndContext = useCallback(() => {
    chatComposerRef.current?.insertAtSymbol?.();
  }, []);

  const {
    modelInfo,
    contextItems,
    selectedToolsets,
    setQuery,
    setModelInfo,
    setContextItems,
    setSelectedToolsets,
  } = useAgentNodeManagement(nodeId);

  const { getUpstreamAgentNodes, disconnectFromUpstreamAgent } = useAgentConnections();
  const upstreamAgentNodes = getUpstreamAgentNodes(nodeId);

  const removeUpstreamAgent = useCallback(
    (targetEntityId: string) => {
      disconnectFromUpstreamAgent(nodeId, targetEntityId);
    },
    [disconnectFromUpstreamAgent, nodeId],
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragging(false);
      dragCounterRef.current = 0;

      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length === 0) {
        return;
      }

      const newContextItems: IContextItem[] = [];
      const driveFiles = await handleUploadMultipleImages(files, canvasId ?? '');
      for (const driveFile of driveFiles ?? []) {
        if (!driveFile.fileId) {
          continue;
        }
        newContextItems.push({
          type: 'file',
          entityId: driveFile.fileId,
          title: driveFile.name,
        });
      }

      if (newContextItems.length > 0) {
        setContextItems((prevContextItems) => [...prevContextItems, ...newContextItems]);
      }
    },
    [canvasId, handleUploadMultipleImages, setContextItems],
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setDragging(false);
    }
  }, []);

  return (
    <div className="h-full flex flex-col gap-4 px-4 overflow-y-auto">
      <div>
        <div
          className="text-xs font-semibold leading-4 mb-2 flex items-center gap-1"
          style={{ fontFamily: 'PingFang SC', letterSpacing: 0 }}
        >
          <span>{t('agent.config.model')}</span>
          <Tooltip title={t('agent.config.modelDescription')}>
            <Question color="rgba(28, 31, 35, 0.6)" className="w-3 h-3 cursor-pointer" />
          </Tooltip>
        </div>

        <ModelSelector
          readonly={readonly}
          model={modelInfo ?? null}
          setModel={setModelInfo}
          size="medium"
          briefMode={false}
          variant="filled"
          trigger={['click']}
          contextItems={contextItems}
          disabled={disabled}
          defaultScene="agent"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col pb-4">
        <div
          className="text-xs font-semibold leading-4 mb-2 flex items-center justify-between"
          style={{ fontFamily: 'PingFang SC', letterSpacing: 0 }}
        >
          <div className="flex items-center gap-1">
            <span>{t('agent.config.prompt')}</span>
            <Tooltip title={t('agent.config.promptDescription')}>
              <Question color="rgba(28, 31, 35, 0.6)" className="w-3 h-3 cursor-pointer" />
            </Tooltip>
          </div>
          <Button
            type="default"
            size="small"
            className="text-xs !h-5 px-1 py-0.5 text-refly-text-1"
            onClick={handleAddToolsAndContext}
            disabled={readonly || disabled}
          >
            @ {t('agent.config.addToolsAndContext')}
          </Button>
        </div>

        <div
          className="rounded-lg pt-2 pb-3 px-3 relative bg-refly-bg-control-z0 flex-1 min-h-0 overflow-hidden flex flex-col"
          onDrop={!readonly ? handleDrop : undefined}
          onDragOver={!readonly ? handleDragOver : undefined}
          onDragEnter={!readonly ? handleDragEnter : undefined}
          onDragLeave={!readonly ? handleDragLeave : undefined}
        >
          {dragging && (
            <div className="absolute inset-0 border-solid border-[1px] border-refly-Card-Border bg-refly-primary-default/10 backdrop-blur-[10px] rounded-lg flex flex-col items-center justify-center z-10">
              <img src={Down} alt="down" className="w-[44px] mb-5" />
              <div className="text-sm font-bold text-center text-refly-text-0 leading-5">
                {t('common.dragAndDropFiles')}
              </div>
            </div>
          )}

          <div className="flex-none h-[50%] min-h-[100px] overflow-hidden">
            <EditChatInput
              ref={chatComposerRef}
              enabled
              resultId={resultId}
              nodeId={nodeId}
              version={version}
              readonly={disabled}
              setEditMode={() => {}}
              mentionPosition="bottom-start"
            />
          </div>

          <Divider className="my-4 flex-none" />

          <div className="flex-1 min-h-0 overflow-hidden">
            <ConfigInfoDisplay
              readonly={readonly}
              prompt={query ?? ''}
              selectedToolsets={selectedToolsets}
              contextItems={contextItems}
              setContextItems={setContextItems}
              setSelectedToolsets={setSelectedToolsets}
              setQuery={setQuery}
              upstreamAgentNodes={upstreamAgentNodes}
              removeUpstreamAgent={removeUpstreamAgent}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const ConfigureTab = memo(ConfigureTabComponent);
ConfigureTab.displayName = 'ConfigureTab';
