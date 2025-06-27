import { memo, useCallback, useEffect, useMemo, useState, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { cn } from '@refly/utils/cn';
import {
  IconClose,
  IconExitWideMode,
  IconWideMode,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { Maximize2, Minimize2 } from 'lucide-react';
import { RefreshCw } from 'lucide-react';
import { LinearThreadContent } from './linear-thread';
import { LinearThreadMessage } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useContextUpdateByResultId } from '@refly-packages/ai-workspace-common/hooks/canvas/use-debounced-context-update';
import { LaunchPad } from '@refly-packages/ai-workspace-common/components/canvas/launchpad';
import { IContextItem } from '@refly/common-types';
import {
  useContextPanelStore,
  ContextTarget,
  useContextPanelStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import { IconAskAI } from '@refly-packages/ai-workspace-common/components/common/icon';
import { SkillTemplateConfig } from '@refly/openapi-schema';
import { contextEmitter } from '@refly-packages/ai-workspace-common/utils/event-emitter/context';

export interface ThreadContainerProps {
  className?: string;
  resultId?: string;
  standalone?: boolean;
  messages: LinearThreadMessage[];
  onAddMessage: (
    message: { id: string; resultId: string; nodeId: string; data?: any },
    query?: string,
    contextItems?: any[],
  ) => void;
  onClearConversation: () => void;
  onGenerateMessageIds: () => { resultId: string; nodeId: string };
  onClose?: () => void;
  tplConfig?: SkillTemplateConfig | null;
  onUpdateTplConfig?: (config: SkillTemplateConfig | null) => void;
}

const ThreadHeader = memo(
  ({
    onClose,
    onMaximize,
    isMaximized,
    onWideMode,
    isWideMode,
    onClearConversation,
  }: {
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
    onWideMode: () => void;
    isWideMode: boolean;
    onClearConversation: () => void;
  }) => {
    const { t } = useTranslation();

    return (
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary-600 shadow-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-medium flex items-center justify-center">
              <IconAskAI className="w-3 h-3" />
            </span>
          </div>
          <span className="text-sm font-medium leading-normal">
            {t('canvas.reflyPilot.title', { defaultValue: 'Ask AI' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="text"
            size="small"
            className="flex items-center text-gray-500 h-7 px-2"
            onClick={onClearConversation}
            icon={<RefreshCw className="w-3.5 h-3.5 mr-1" />}
          >
            {t('canvas.reflyPilot.newConversation', { defaultValue: 'New conversation' })}
          </Button>
          <Button
            type="text"
            size="small"
            className={`flex items-center justify-center p-0 w-7 h-7 ${isWideMode ? 'text-primary-600' : 'text-gray-500 hover:text-gray-600'} min-w-0`}
            onClick={onWideMode}
          >
            {isWideMode ? (
              <IconExitWideMode className="w-4 h-4" />
            ) : (
              <IconWideMode className="w-4 h-4" />
            )}
          </Button>
          <Button
            type="text"
            size="small"
            className={`flex items-center justify-center p-0 w-7 h-7 ${isMaximized ? 'text-primary-600' : 'text-gray-500 hover:text-gray-600'} min-w-0`}
            onClick={onMaximize}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button
            type="text"
            size="small"
            className="flex items-center justify-center p-0 w-7 h-7 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 min-w-0"
            onClick={onClose}
          >
            <IconClose className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  },
);

ThreadHeader.displayName = 'ThreadHeader';

export const ThreadContainer = memo(
  forwardRef<HTMLDivElement, ThreadContainerProps>((props, ref) => {
    const {
      className,
      resultId,
      messages,
      onAddMessage,
      onClearConversation,
      onGenerateMessageIds,
      onClose,
      tplConfig,
      onUpdateTplConfig,
    } = props;

    const [isMaximized, setIsMaximized] = useState(false);
    const [isWideMode, setIsWideMode] = useState(false);
    const [contentHeight, setContentHeight] = useState('auto');

    // Get context panel store to manage context items
    const { setContextItems, setActiveResultId } = useContextPanelStoreShallow((state) => ({
      setContextItems: state.setContextItems,
      setActiveResultId: state.setActiveResultId,
    }));

    // Use our custom hook instead of the local implementation
    const { debouncedUpdateContextItems } = useContextUpdateByResultId({
      resultId,
      setContextItems,
    });

    // Listen for context events for the global pilot
    useEffect(() => {
      const handleAddToContext = (data: { contextItem: IContextItem; resultId: string }) => {
        if (data.resultId === ContextTarget.Global) {
          const { contextItems } = useContextPanelStore.getState();
          setContextItems([...contextItems, data.contextItem]);
        }
      };

      // Register event listeners
      contextEmitter.on('addToContext', handleAddToContext);

      // Cleanup
      return () => {
        contextEmitter.off('addToContext', handleAddToContext);
      };
    }, [setActiveResultId]);

    // Add ESC key handler to exit fullscreen
    useEffect(() => {
      const handleEscKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isMaximized) {
          setIsMaximized(false);
        }
      };

      document.addEventListener('keydown', handleEscKey);

      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }, [isMaximized]);

    const handleClose = useCallback(() => {
      if (onClose) {
        onClose();
      }
    }, [onClose]);

    const handleMaximize = useCallback(() => {
      setIsMaximized(!isMaximized);
      if (isWideMode && !isMaximized) {
        setIsWideMode(false);
      }
    }, [isMaximized, isWideMode]);

    const handleWideMode = useCallback(() => {
      setIsWideMode(!isWideMode);
      if (isMaximized && !isWideMode) {
        setIsMaximized(false);
      }
    }, [isWideMode, isMaximized]);

    const containerStyles = useMemo(
      () => ({
        height: isMaximized ? '100vh' : 'calc(100vh - 72px)',
        width: isMaximized ? 'calc(100vw)' : isWideMode ? '840px' : '420px',
        position: isMaximized ? ('fixed' as const) : ('relative' as const),
        top: isMaximized ? 0 : null,
        right: isMaximized ? 0 : null,
        zIndex: isMaximized ? 50 : 10,
        transition: isMaximized
          ? 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          : 'all 50ms cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column' as const,
        borderRadius: isMaximized ? 0 : '0.5rem',
      }),
      [isMaximized, isWideMode],
    );

    const containerClassName = useMemo(
      () => `
        flex-shrink-0 
        bg-white dark:bg-gray-900
        border 
        border-gray-200 dark:border-gray-700
        flex 
        flex-col
        will-change-transform
        ${isMaximized ? 'fixed' : 'rounded-lg'}
      `,
      [isMaximized],
    );

    // Handle window resize and update dimensions
    useEffect(() => {
      const updateDimensions = () => {
        // Calculate available space
        const viewportHeight = window.innerHeight;
        const headerHeight = 52; // Header height
        const launchpadHeight = 180; // Approximate height of launchpad + margins
        const topOffset = isMaximized ? 0 : 72; // No offset when maximized

        // Calculate content height
        const availableHeight = viewportHeight - topOffset - headerHeight - launchpadHeight;

        if (messages.length === 0) {
          setContentHeight('auto');
        } else {
          // Make content area taller when maximized
          const minHeight = isMaximized ? 500 : 300;
          setContentHeight(`${Math.max(minHeight, availableHeight)}px`);
        }
      };

      // Initial calculation
      updateDimensions();

      // Listen for window resize
      window.addEventListener('resize', updateDimensions);

      return () => {
        window.removeEventListener('resize', updateDimensions);
      };
    }, [messages.length, isMaximized]);

    // Update context when resultId changes or component mounts
    useEffect(() => {
      if (resultId) {
        // Add delay to ensure edges have been properly updated in React Flow
        const timer = setTimeout(() => {
          debouncedUpdateContextItems();
        }, 150);

        return () => clearTimeout(timer);
      }
    }, [resultId, debouncedUpdateContextItems]);

    const outerContainerStyles = useMemo(
      () => ({
        marginLeft: 'auto', // Right-align the container to match NodePreview
      }),
      [],
    );

    return (
      <div
        ref={ref}
        className="border border-solid border-gray-100 rounded-lg bg-transparent dark:border-gray-800 "
        style={outerContainerStyles}
      >
        <div className={cn(containerClassName, className)} style={containerStyles}>
          <div>
            <ThreadHeader
              onClose={handleClose}
              onMaximize={handleMaximize}
              isMaximized={isMaximized}
              onWideMode={handleWideMode}
              isWideMode={isWideMode}
              onClearConversation={onClearConversation}
            />
          </div>

          <LinearThreadContent messages={messages} contentHeight={contentHeight} />

          <div className="mt-auto border-t border-gray-200 w-full max-w-[1024px] mx-auto dark:border-gray-700">
            <LaunchPad
              visible={true}
              inReflyPilot={true}
              onAddMessage={onAddMessage}
              onGenerateMessageIds={onGenerateMessageIds}
              className="w-full max-w-[1024px] mx-auto"
              tplConfig={tplConfig}
              onUpdateTplConfig={onUpdateTplConfig}
            />
          </div>
        </div>
      </div>
    );
  }),
);

ThreadContainer.displayName = 'ThreadContainer';
