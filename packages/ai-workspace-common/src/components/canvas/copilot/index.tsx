import { memo, useCallback, useRef, useState } from 'react';
import { Attachment } from 'refly-icons';
import { useTranslation } from 'react-i18next';

import { ChatBox } from './chat-box';
import { Greeting } from './greeting';
import { SessionDetail } from './session-detail';
import { CopilotHeader } from './copilot-header';

import { useCopilotStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { cn } from '@refly/utils/cn';

interface CopilotProps {
  copilotWidth: number;
  setCopilotWidth: (width: number) => void;
}

export const Copilot = memo(({ copilotWidth, setCopilotWidth }: CopilotProps) => {
  const { t } = useTranslation();
  const { canvasId } = useCanvasContext();
  const [query, setQuery] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { currentSessionId: sessionId } = useCopilotStoreShallow((state) => ({
    currentSessionId: state.currentSessionId[canvasId] ?? null,
  }));

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  // Ref to call ChatBox's file upload handler
  const fileUploadHandlerRef = useRef<((files: File[]) => Promise<void>) | null>(null);
  // Track if file upload is disabled (limit reached)
  const [isUploadDisabled, setIsUploadDisabled] = useState(false);

  const [isUserScrollingUp, setIsUserScrollingUp] = useState(false);
  const handleScrollBottom = useCallback(() => {
    setIsUserScrollingUp(false);
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current?.scrollHeight,
      behavior: 'instant',
    });
  }, [setIsUserScrollingUp, scrollContainerRef]);

  const handleQueryClick = useCallback((query: string) => {
    setQuery(query);
  }, []);

  // Drag-and-drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && fileUploadHandlerRef.current) {
      await fileUploadHandlerRef.current(files);
    }
  }, []);

  // Register file upload handler from ChatBox
  const registerFileUploadHandler = useCallback((handler: (files: File[]) => Promise<void>) => {
    fileUploadHandlerRef.current = handler;
  }, []);

  // Callback for ChatBox to report upload disabled status
  const handleUploadDisabledChange = useCallback((disabled: boolean) => {
    setIsUploadDisabled(disabled);
  }, []);

  return (
    <div
      className="relative w-full h-full overflow-hidden flex flex-col bg-refly-bg-body"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <CopilotHeader
        canvasId={canvasId}
        sessionId={sessionId}
        copilotWidth={copilotWidth}
        setCopilotWidth={setCopilotWidth}
      />
      <div className="z-[1] absolute top-0 left-0 right-0 h-[80px] bg-gradient-to-b from-refly-bg-body to-transparent pointer-events-none" />

      <div ref={scrollContainerRef} className="flex-grow overflow-y-auto pt-[56px]">
        {sessionId ? (
          <SessionDetail
            sessionId={sessionId}
            setQuery={setQuery}
            scrollContainerRef={scrollContainerRef}
            isUserScrollingUp={isUserScrollingUp}
            setIsUserScrollingUp={setIsUserScrollingUp}
          />
        ) : (
          <Greeting onQueryClick={handleQueryClick} />
        )}
      </div>

      <div className="w-full p-3 pt-2">
        <ChatBox
          canvasId={canvasId}
          query={query}
          setQuery={setQuery}
          onSendMessage={handleScrollBottom}
          onRegisterFileUploadHandler={registerFileUploadHandler}
          onUploadDisabledChange={handleUploadDisabledChange}
        />
      </div>

      {/* Dropzone overlay */}
      {isDragging && (
        <div
          className={cn(
            'absolute inset-3 z-50 rounded-xl',
            'border-2 border-dashed',
            'flex flex-col items-center justify-center gap-3',
            isUploadDisabled
              ? 'border-[#C7CACD] bg-[rgba(28,31,35,0.1)] backdrop-blur-[25px]'
              : 'border-[#00A870] bg-[#00A870]/10 backdrop-blur-sm',
          )}
        >
          <Attachment size={32} color={isUploadDisabled ? '#1C1F23' : '#00A870'} />
          <div className="text-base font-medium text-[#1C1F23]">
            {t('copilot.dropFilesToUpload')}
          </div>
          <div className="text-sm text-black/50">{t('copilot.maxUploadSize')}</div>
        </div>
      )}
    </div>
  );
});

Copilot.displayName = 'Copilot';
